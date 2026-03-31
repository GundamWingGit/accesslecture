"""
Backward-compatible facade — delegates to the active TranscriptionProvider.

Do not add logic here. All transcription logic lives in providers/.
"""
from app.models.schemas import TranscriptSegment


def transcribe_audio(audio_path: str) -> tuple[list[TranscriptSegment], dict]:
    from app.services.providers import get_transcription_provider
    return get_transcription_provider().transcribe(audio_path)
