import logging
from app.config import get_settings
from app.models.schemas import TranscriptSegment, WordTimestamp

logger = logging.getLogger(__name__)

_model = None


def get_whisper_model():
    from faster_whisper import WhisperModel
    global _model
    if _model is None:
        settings = get_settings()
        device = settings.whisper_device
        if device == "auto":
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = settings.whisper_compute_type
        if device == "cpu":
            compute_type = "int8"
        logger.info(f"Loading Whisper model {settings.whisper_model_size} on {device} ({compute_type})")
        _model = WhisperModel(
            settings.whisper_model_size,
            device=device,
            compute_type=compute_type,
        )
    return _model


def transcribe_audio(audio_path: str) -> tuple[list[TranscriptSegment], dict]:
    """
    Transcribe audio file and return segments with word-level timestamps.
    Returns (segments, info_dict).
    """
    model = get_whisper_model()
    segments_iter, info = model.transcribe(
        audio_path,
        beam_size=5,
        word_timestamps=True,
        vad_filter=True,
        vad_parameters=dict(
            min_silence_duration_ms=500,
            speech_pad_ms=200,
        ),
    )

    segments: list[TranscriptSegment] = []
    for i, seg in enumerate(segments_iter):
        words = []
        if seg.words:
            for w in seg.words:
                words.append(WordTimestamp(
                    word=w.word.strip(),
                    start_ms=int(w.start * 1000),
                    end_ms=int(w.end * 1000),
                    confidence=w.probability,
                ))

        segments.append(TranscriptSegment(
            id=f"seg-{i}",
            start_ms=int(seg.start * 1000),
            end_ms=int(seg.end * 1000),
            text=seg.text.strip(),
            words=words,
        ))

    info_dict = {
        "language": info.language,
        "language_probability": info.language_probability,
        "duration_seconds": info.duration,
    }

    return segments, info_dict
