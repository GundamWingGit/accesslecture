"""
Abstract provider interfaces for the AccessLecture processing pipeline.

Each interface defines a single responsibility:
  - TranscriptionProvider:  audio → timestamped transcript with speaker labels
  - VisualAnalysisProvider: video → on-screen text / slide detections
  - CleanupProvider:        text  → cleaned captions, vocabulary, suggestions

Phase 1: All three are backed by Gemini (gemini.py).
Phase 2: Swap transcription → Cloud Speech-to-Text, visual → Video Intelligence,
         keep Gemini for cleanup/reasoning.  Change one config value per swap.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from app.models.schemas import TranscriptSegment


class TranscriptionProvider(ABC):
    """Converts audio into timestamped transcript segments with speaker labels."""

    @abstractmethod
    def transcribe(self, audio_path: str) -> tuple[list[TranscriptSegment], dict]:
        """
        Transcribe an audio file.

        Returns:
            segments: List of TranscriptSegment with timestamps, text, speaker, words.
            info: Dict with at least {"language": str, "duration_seconds": float}.
        """
        ...


class VisualAnalysisProvider(ABC):
    """Detects on-screen text and visual content in lecture videos."""

    @abstractmethod
    def detect_text(self, video_path: str) -> list[dict]:
        """
        Extract on-screen text from a video file.

        Returns list of dicts, each with:
            {"text": str, "start_ms": int, "end_ms": int, "confidence": float,
             "description": str}
        sorted by start_ms.
        """
        ...

    def group_slides(self, detections: list[dict], gap_ms: int = 3000) -> list[dict]:
        """
        Group raw detections into logical slide/screen states.

        Returns:
            [{"start_ms": int, "end_ms": int, "texts": [str, ...],
              "description": str}]
        """
        if not detections:
            return []

        slides: list[dict] = []
        current: dict = {
            "start_ms": detections[0]["start_ms"],
            "end_ms": detections[0]["end_ms"],
            "texts": [detections[0]["text"]],
            "description": detections[0].get("description", ""),
        }

        for det in detections[1:]:
            if det["start_ms"] - current["end_ms"] <= gap_ms:
                current["end_ms"] = max(current["end_ms"], det["end_ms"])
                if det["text"] not in current["texts"]:
                    current["texts"].append(det["text"])
            else:
                slides.append(current)
                current = {
                    "start_ms": det["start_ms"],
                    "end_ms": det["end_ms"],
                    "texts": [det["text"]],
                    "description": det.get("description", ""),
                }

        slides.append(current)
        return slides


class CleanupProvider(ABC):
    """AI-powered caption cleanup, vocabulary extraction, and suggestion generation."""

    @abstractmethod
    def cleanup_segment(
        self,
        text: str,
        mode: str = "clean",
        speaker: str | None = None,
        syllabus_context: str | None = None,
    ) -> str:
        """
        Clean up a transcript segment.

        mode='verbatim': Fix only clear transcription errors.
        mode='clean':    Remove filler, fix grammar, improve readability.

        Returns the cleaned text.
        """
        ...

    @abstractmethod
    def detect_visual_references(self, text: str) -> list[dict]:
        """
        Detect phrases referencing visual content inaccessible to screen readers.

        Returns list of {"phrase": str, "suggestion": str}.
        """
        ...

    @abstractmethod
    def extract_vocabulary(self, syllabus_text: str) -> list[str]:
        """
        Extract technical terms and proper nouns from syllabus text.

        Returns list of vocabulary strings.
        """
        ...

    @abstractmethod
    def generate_suggestions(
        self,
        score: float,
        issues: list[dict],
    ) -> list[dict]:
        """
        Generate actionable accessibility improvement suggestions.

        Returns list of {"title": str, "description": str, "priority": str}.
        """
        ...
