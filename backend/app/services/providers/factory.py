"""
Provider factory — reads config and returns the correct concrete provider.

To swap a component in Phase 2, change the env var and add the new provider class.
The pipeline code never changes.

Config keys:
    TRANSCRIPTION_PROVIDER   = "gemini" (future: "speech_to_text", "faster_whisper")
    VISUAL_ANALYSIS_PROVIDER = "gemini" (future: "video_intelligence")
    CLEANUP_PROVIDER         = "gemini"
"""
from __future__ import annotations

import logging
from functools import lru_cache

from app.config import get_settings
from app.services.providers.base import (
    TranscriptionProvider,
    VisualAnalysisProvider,
    CleanupProvider,
)

logger = logging.getLogger(__name__)

# Registry: provider_name → callable that returns an instance
_TRANSCRIPTION_REGISTRY: dict[str, type[TranscriptionProvider]] = {}
_VISUAL_REGISTRY: dict[str, type[VisualAnalysisProvider]] = {}
_CLEANUP_REGISTRY: dict[str, type[CleanupProvider]] = {}


def _ensure_registry():
    """Lazy-populate registries on first use."""
    if _TRANSCRIPTION_REGISTRY:
        return

    from app.services.providers.gemini import (
        GeminiTranscriptionProvider,
        GeminiVisualAnalysisProvider,
        GeminiCleanupProvider,
    )

    _TRANSCRIPTION_REGISTRY["gemini"] = GeminiTranscriptionProvider
    _VISUAL_REGISTRY["gemini"] = GeminiVisualAnalysisProvider
    _CLEANUP_REGISTRY["gemini"] = GeminiCleanupProvider

    # Phase 2 example (uncomment when ready):
    # from app.services.providers.speech_to_text import SpeechToTextTranscriptionProvider
    # _TRANSCRIPTION_REGISTRY["speech_to_text"] = SpeechToTextTranscriptionProvider
    #
    # from app.services.providers.video_intel import VideoIntelligenceVisualProvider
    # _VISUAL_REGISTRY["video_intelligence"] = VideoIntelligenceVisualProvider


@lru_cache
def get_transcription_provider() -> TranscriptionProvider:
    _ensure_registry()
    settings = get_settings()
    name = settings.transcription_provider
    cls = _TRANSCRIPTION_REGISTRY.get(name)
    if cls is None:
        raise ValueError(
            f"Unknown transcription provider '{name}'. "
            f"Available: {list(_TRANSCRIPTION_REGISTRY)}"
        )
    logger.info("Using transcription provider: %s", name)
    return cls()


@lru_cache
def get_visual_analysis_provider() -> VisualAnalysisProvider:
    _ensure_registry()
    settings = get_settings()
    name = settings.visual_analysis_provider
    cls = _VISUAL_REGISTRY.get(name)
    if cls is None:
        raise ValueError(
            f"Unknown visual analysis provider '{name}'. "
            f"Available: {list(_VISUAL_REGISTRY)}"
        )
    logger.info("Using visual analysis provider: %s", name)
    return cls()


@lru_cache
def get_cleanup_provider() -> CleanupProvider:
    _ensure_registry()
    settings = get_settings()
    name = settings.cleanup_provider
    cls = _CLEANUP_REGISTRY.get(name)
    if cls is None:
        raise ValueError(
            f"Unknown cleanup provider '{name}'. "
            f"Available: {list(_CLEANUP_REGISTRY)}"
        )
    logger.info("Using cleanup provider: %s", name)
    return cls()
