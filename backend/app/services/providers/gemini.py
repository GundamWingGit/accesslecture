"""
Gemini-backed implementations of all three provider interfaces.

Phase 1 MVP: Gemini 2.5 Flash handles transcription, visual analysis,
and cleanup/reasoning through its multimodal capabilities.

All Gemini-specific logic is contained here — the pipeline never touches it.
"""
from __future__ import annotations

import json
import logging
import os

from google import genai
from app.config import get_settings
from app.models.schemas import TranscriptSegment, WordTimestamp
from app.services.providers.base import (
    TranscriptionProvider,
    VisualAnalysisProvider,
    CleanupProvider,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Shared Gemini client (singleton)
# ---------------------------------------------------------------------------

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        settings = get_settings()
        if settings.use_vertex_ai:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = (
                settings.google_application_credentials
            )
            _client = genai.Client(
                vertexai=True,
                project=settings.gcp_project_id,
                location=settings.gcp_location,
            )
            logger.info(
                "Initialized Vertex AI Gemini client for project %s",
                settings.gcp_project_id,
            )
        else:
            _client = genai.Client(api_key=settings.google_api_key)
            logger.info("Initialized Gemini client with API key")
    return _client


def _parse_json(raw: str) -> dict | list:
    """Strip optional markdown fences and parse JSON."""
    text = raw.strip()
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]
    return json.loads(text)


# ---------------------------------------------------------------------------
# Transcription
# ---------------------------------------------------------------------------

_TRANSCRIPTION_SYSTEM = """\
You are a precise lecture transcription engine. Given an audio recording,
produce a complete verbatim transcription with timestamps and speaker labels.

Return a JSON object with this exact schema:
{
  "language": "en",
  "duration_seconds": <float>,
  "segments": [
    {
      "start_seconds": <float>,
      "end_seconds": <float>,
      "text": "<exact spoken text with punctuation>",
      "speaker": "SPEAKER_0" | "SPEAKER_1" | null,
      "words": [
        {"word": "<word>", "start_seconds": <float>, "end_seconds": <float>}
      ]
    }
  ]
}

Rules:
1. Transcribe EVERY word spoken — do not summarize or skip.
2. Use accurate punctuation and capitalization.
3. Assign speaker labels (SPEAKER_0, SPEAKER_1, …) when multiple speakers are present.
   Single-speaker recordings → always SPEAKER_0.
4. Timestamps must be precise to 0.1 s.
5. Segments should be 5-30 s long, split at natural sentence/phrase boundaries.
6. Include word-level timestamps in the words array.
7. Return ONLY valid JSON — no markdown fences, no explanation."""


class GeminiTranscriptionProvider(TranscriptionProvider):

    def transcribe(self, audio_path: str) -> tuple[list[TranscriptSegment], dict]:
        settings = get_settings()
        client = _get_client()

        file_size_mb = os.path.getsize(audio_path) / (1024 * 1024)
        logger.info(
            "Transcribing %.1f MB audio with Gemini (%s)",
            file_size_mb,
            settings.gemini_model,
        )

        with open(audio_path, "rb") as f:
            audio_bytes = f.read()

        mime = _audio_mime(audio_path)

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
                genai.types.Part.from_bytes(data=audio_bytes, mime_type=mime),
                "Transcribe this audio recording completely with timestamps and speaker labels.",
            ],
            config=genai.types.GenerateContentConfig(
                system_instruction=_TRANSCRIPTION_SYSTEM,
                temperature=0.1,
                max_output_tokens=65536,
            ),
        )

        data = _parse_json(response.text)
        return _build_segments(data)


# ---------------------------------------------------------------------------
# Visual analysis
# ---------------------------------------------------------------------------

_VISUAL_SYSTEM = """\
You are a slide/screen text extraction engine for lecture accessibility.
Analyze this lecture video and extract ALL text visible on screen
(slides, whiteboard, projected content, terminal/code, diagrams, etc.).

Return a JSON array of objects:
[
  {
    "start_seconds": <float>,
    "end_seconds": <float>,
    "texts": ["line 1 of visible text", "line 2", …],
    "description": "<brief description: slide title, diagram, code block, etc.>"
  }
]

Rules:
1. Group by visual state — a new entry each time the screen content changes.
2. Include ALL readable text, even partial.
3. The description helps someone who cannot see the screen understand context.
4. Return ONLY valid JSON — no markdown fences."""


class GeminiVisualAnalysisProvider(VisualAnalysisProvider):

    def detect_text(self, video_path: str) -> list[dict]:
        settings = get_settings()
        client = _get_client()

        file_size_mb = os.path.getsize(video_path) / (1024 * 1024)
        logger.info(
            "Running visual text detection on %.1f MB video with Gemini",
            file_size_mb,
        )

        with open(video_path, "rb") as f:
            video_bytes = f.read()

        mime = _video_mime(video_path)

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
                genai.types.Part.from_bytes(data=video_bytes, mime_type=mime),
                "Extract all on-screen text from this lecture video with timestamps.",
            ],
            config=genai.types.GenerateContentConfig(
                system_instruction=_VISUAL_SYSTEM,
                temperature=0.1,
                max_output_tokens=32768,
            ),
        )

        try:
            slides = _parse_json(response.text)
        except (json.JSONDecodeError, IndexError):
            logger.warning("Failed to parse visual analysis JSON: %s", response.text[:300])
            return []

        detections: list[dict] = []
        for slide in slides:
            start_ms = int(slide["start_seconds"] * 1000)
            end_ms = int(slide["end_seconds"] * 1000)
            for text_line in slide.get("texts", []):
                if len(text_line.strip()) >= 3:
                    detections.append({
                        "text": text_line.strip(),
                        "start_ms": start_ms,
                        "end_ms": end_ms,
                        "confidence": 0.9,
                        "description": slide.get("description", ""),
                    })

        detections.sort(key=lambda d: d["start_ms"])
        logger.info(
            "Detected %d text elements across %d slides", len(detections), len(slides)
        )
        return detections


# ---------------------------------------------------------------------------
# Cleanup / reasoning
# ---------------------------------------------------------------------------

class GeminiCleanupProvider(CleanupProvider):

    def cleanup_segment(
        self,
        text: str,
        mode: str = "clean",
        speaker: str | None = None,
        syllabus_context: str | None = None,
    ) -> str:
        settings = get_settings()
        client = _get_client()

        if mode == "verbatim":
            system = (
                "You are a caption editor for educational accessibility compliance. "
                "Fix ONLY clear transcription errors (misspelled words, garbled text). "
                "PRESERVE all filler words (um, uh, like, you know), false starts, and "
                "repeated words exactly as spoken. Do NOT change grammar or sentence structure. "
                "Return ONLY the corrected text, nothing else."
            )
        else:
            system = (
                "You are a caption editor for educational accessibility compliance. "
                "Clean up this transcript segment by: "
                "1) Removing filler words (um, uh, like, you know, basically, right, so) "
                "2) Fixing grammar and punctuation "
                "3) Removing false starts and repeated words "
                "4) Improving readability while preserving the original meaning exactly "
                "5) Keeping all technical terms, proper nouns, and key concepts intact "
                "Return ONLY the cleaned text, nothing else. Do not add any explanation."
            )

        user_prompt = f"Clean this transcript segment:\n\n{text}"
        if syllabus_context:
            user_prompt += (
                "\n\nCourse vocabulary context "
                "(use this to correctly spell technical terms):\n"
                f"{syllabus_context[:2000]}"
            )
        if speaker:
            user_prompt += f"\n\nSpeaker: {speaker}"

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=user_prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.1,
                max_output_tokens=2048,
            ),
        )
        return response.text.strip()

    def detect_visual_references(self, text: str) -> list[dict]:
        settings = get_settings()
        client = _get_client()

        system = (
            "You are an accessibility expert analyzing lecture captions. "
            "Identify phrases where the speaker references visual content that would "
            "not be accessible to someone who cannot see the screen (slides, graphs, "
            "diagrams, whiteboard). "
            "Return a JSON array of {\"phrase\": str, \"suggestion\": str}. "
            "If none found, return []. Return ONLY valid JSON."
        )

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=f"Analyze this caption text for visual references:\n\n{text}",
            config=genai.types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.1,
                max_output_tokens=2048,
            ),
        )

        try:
            return _parse_json(response.text)
        except (json.JSONDecodeError, IndexError):
            logger.warning("Failed to parse visual reference response")
            return []

    def extract_vocabulary(self, syllabus_text: str) -> list[str]:
        settings = get_settings()
        client = _get_client()

        system = (
            "You are an academic vocabulary extractor. Given a course syllabus, "
            "extract all technical terms, proper nouns, specialized vocabulary, "
            "acronyms, and key concepts that a transcription system might misspell. "
            "Return a JSON array of strings. Return ONLY valid JSON."
        )

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=f"Extract vocabulary from this syllabus:\n\n{syllabus_text[:5000]}",
            config=genai.types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.1,
                max_output_tokens=2048,
            ),
        )

        try:
            vocab = _parse_json(response.text)
            return vocab if isinstance(vocab, list) else []
        except (json.JSONDecodeError, IndexError):
            logger.warning("Failed to parse vocabulary extraction response")
            return []

    def generate_suggestions(
        self,
        score: float,
        issues: list[dict],
    ) -> list[dict]:
        settings = get_settings()
        client = _get_client()

        system = (
            "You are an accessibility advisor for educational content. "
            "Given an accessibility score and list of issues, provide 3-5 concise, "
            "actionable suggestions. Each has 'title', 'description', 'priority' "
            "(high/medium/low). Return ONLY valid JSON array."
        )

        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=f"Score: {score}%\nIssues: {json.dumps(issues)}",
            config=genai.types.GenerateContentConfig(
                system_instruction=system,
                temperature=0.3,
                max_output_tokens=1024,
            ),
        )

        try:
            return _parse_json(response.text)
        except (json.JSONDecodeError, IndexError):
            logger.warning("Failed to parse AI suggestions")
            return []


# ---------------------------------------------------------------------------
# Helpers (private to this module)
# ---------------------------------------------------------------------------

def _audio_mime(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return {
        "mp3": "audio/mpeg",
        "m4a": "audio/mp4",
        "webm": "audio/webm",
        "ogg": "audio/ogg",
        "flac": "audio/flac",
    }.get(ext, "audio/wav")


def _video_mime(path: str) -> str:
    ext = path.rsplit(".", 1)[-1].lower() if "." in path else ""
    return {
        "webm": "video/webm",
        "mov": "video/quicktime",
        "avi": "video/x-msvideo",
    }.get(ext, "video/mp4")


def _build_segments(data: dict) -> tuple[list[TranscriptSegment], dict]:
    """Convert parsed Gemini JSON into TranscriptSegment list + info dict."""
    segments: list[TranscriptSegment] = []
    total_duration = data.get("duration_seconds", 0.0)

    for i, seg_data in enumerate(data.get("segments", [])):
        start_ms = int(seg_data["start_seconds"] * 1000)
        end_ms = int(seg_data["end_seconds"] * 1000)
        total_duration = max(total_duration, seg_data["end_seconds"])

        words: list[WordTimestamp] = []
        for w in seg_data.get("words", []):
            words.append(
                WordTimestamp(
                    word=w["word"],
                    start_ms=int(w["start_seconds"] * 1000),
                    end_ms=int(w["end_seconds"] * 1000),
                    speaker=seg_data.get("speaker"),
                    confidence=0.92,
                )
            )

        segments.append(
            TranscriptSegment(
                id=f"seg-{i}",
                start_ms=start_ms,
                end_ms=end_ms,
                text=seg_data["text"],
                speaker=seg_data.get("speaker"),
                words=words,
            )
        )

    info = {
        "language": data.get("language", "en"),
        "language_probability": 0.99,
        "duration_seconds": total_duration,
    }
    return segments, info
