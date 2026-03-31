"""
Provider abstraction layer for the AccessLecture processing pipeline.

Usage:
    from app.services.providers import get_transcription_provider
    provider = get_transcription_provider()
    segments, info = provider.transcribe(audio_path)
"""
from app.services.providers.base import (
    TranscriptionProvider,
    VisualAnalysisProvider,
    CleanupProvider,
)
from app.services.providers.factory import (
    get_transcription_provider,
    get_visual_analysis_provider,
    get_cleanup_provider,
)

__all__ = [
    "TranscriptionProvider",
    "VisualAnalysisProvider",
    "CleanupProvider",
    "get_transcription_provider",
    "get_visual_analysis_provider",
    "get_cleanup_provider",
]
