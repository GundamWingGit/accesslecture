import logging
import json
import os
from google import genai
from app.config import get_settings

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def get_gemini_client() -> genai.Client:
    global _client
    if _client is None:
        settings = get_settings()
        if settings.use_vertex_ai:
            os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = settings.google_application_credentials
            _client = genai.Client(
                vertexai=True,
                project=settings.gcp_project_id,
                location=settings.gcp_location,
            )
            logger.info(f"Initialized Vertex AI client for project {settings.gcp_project_id}")
        else:
            _client = genai.Client(api_key=settings.google_api_key)
            logger.info("Initialized Google AI client with API key")
    return _client


def cleanup_transcript_segment(
    text: str,
    mode: str = "clean",
    speaker: str | None = None,
    syllabus_context: str | None = None,
) -> str:
    """
    Clean up a transcript segment using Gemini.

    mode='verbatim': Only fix clear transcription errors
    mode='clean': Remove filler, fix grammar, improve readability
    """
    settings = get_settings()
    client = get_gemini_client()

    if mode == "verbatim":
        system_prompt = (
            "You are a caption editor for educational accessibility compliance. "
            "Fix ONLY clear transcription errors (misspelled words, garbled text). "
            "PRESERVE all filler words (um, uh, like, you know), false starts, and "
            "repeated words exactly as spoken. Do NOT change grammar or sentence structure. "
            "Return ONLY the corrected text, nothing else."
        )
    else:
        system_prompt = (
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
            f"\n\nCourse vocabulary context (use this to correctly spell technical terms):\n"
            f"{syllabus_context[:2000]}"
        )

    if speaker:
        user_prompt += f"\n\nSpeaker: {speaker}"

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=user_prompt,
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.1,
            max_output_tokens=2048,
        ),
    )

    return response.text.strip()


def detect_visual_references(text: str) -> list[dict]:
    """Detect phrases that reference visual content not accessible to screen readers."""
    settings = get_settings()
    client = get_gemini_client()

    system_prompt = (
        "You are an accessibility expert analyzing lecture captions. "
        "Identify phrases where the speaker references visual content that would not "
        "be accessible to someone who cannot see the screen (e.g., slides, graphs, "
        "diagrams, whiteboard content). "
        "Return a JSON array of objects with 'phrase' and 'suggestion' keys. "
        "The suggestion should describe what additional context is needed. "
        "If no visual references are found, return an empty array []. "
        "Return ONLY valid JSON, no other text."
    )

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=f"Analyze this caption text for visual references:\n\n{text}",
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.1,
            max_output_tokens=2048,
        ),
    )

    try:
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        logger.warning(f"Failed to parse visual reference detection response: {response.text[:200]}")
        return []


async def extract_vocabulary_from_syllabus(syllabus_text: str) -> list[str]:
    """Extract key technical terms and proper nouns from syllabus text."""
    settings = get_settings()
    client = get_gemini_client()

    system_prompt = (
        "You are an academic vocabulary extractor. Given a course syllabus, "
        "extract all technical terms, proper nouns, specialized vocabulary, "
        "acronyms, and key concepts that a transcription system might misspell. "
        "Return a JSON array of strings. Include the correct spelling of each term. "
        "Return ONLY valid JSON, no other text."
    )

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=f"Extract vocabulary from this syllabus:\n\n{syllabus_text[:5000]}",
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.1,
            max_output_tokens=2048,
        ),
    )

    try:
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
        vocab = json.loads(raw)
        return vocab if isinstance(vocab, list) else []
    except (json.JSONDecodeError, IndexError):
        logger.warning("Failed to parse vocabulary extraction response")
        return []


def generate_accessibility_suggestions(
    score: float,
    issues: list[dict],
) -> list[dict]:
    """Generate actionable suggestions based on accessibility score and issues."""
    settings = get_settings()
    client = get_gemini_client()

    system_prompt = (
        "You are an accessibility advisor for educational content. "
        "Given an accessibility score and list of issues, provide 3-5 concise, "
        "actionable suggestions to improve compliance. Each suggestion should "
        "have a 'title', 'description', and 'priority' (high/medium/low). "
        "Return ONLY valid JSON array, no other text."
    )

    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=f"Score: {score}%\nIssues: {json.dumps(issues)}",
        config=genai.types.GenerateContentConfig(
            system_instruction=system_prompt,
            temperature=0.3,
            max_output_tokens=1024,
        ),
    )

    try:
        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0]
        return json.loads(raw)
    except (json.JSONDecodeError, IndexError):
        logger.warning("Failed to parse AI suggestions")
        return []
