"""
Backward-compatible facade.

Speaker diarization is now built into the TranscriptionProvider.
This file exists only for backward compatibility.
"""
import logging
from app.models.schemas import TranscriptSegment

logger = logging.getLogger(__name__)


def diarize_audio(audio_path: str) -> list[dict]:
    """No-op — diarization is integrated into the transcription provider."""
    logger.debug("Diarization handled inline by transcription provider")
    return []


def assign_speakers_to_segments(
    segments: list[TranscriptSegment],
    speaker_turns: list[dict],
) -> list[TranscriptSegment]:
    """Pass-through when speaker_turns is empty (providers handle labels inline)."""
    if not speaker_turns:
        return segments

    for seg in segments:
        best_speaker = None
        best_overlap = 0
        for turn in speaker_turns:
            overlap = max(0, min(seg.end_ms, turn["end_ms"]) - max(seg.start_ms, turn["start_ms"]))
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = turn["speaker"]
        seg.speaker = best_speaker

    return segments
