import logging
from app.config import get_settings
from app.models.schemas import TranscriptSegment

logger = logging.getLogger(__name__)

_pipeline = None


def get_diarization_pipeline():
    from pyannote.audio import Pipeline
    global _pipeline
    if _pipeline is None:
        settings = get_settings()
        logger.info("Loading pyannote speaker diarization pipeline")
        _pipeline = Pipeline.from_pretrained(
            "pyannote/speaker-diarization-3.1",
            use_auth_token=settings.hf_token,
        )
        import torch
        if torch.cuda.is_available():
            _pipeline.to(torch.device("cuda"))
    return _pipeline


def diarize_audio(audio_path: str) -> list[dict]:
    """
    Run speaker diarization on audio file.
    Returns list of {start_ms, end_ms, speaker} dicts.
    """
    pipeline = get_diarization_pipeline()
    diarization = pipeline(audio_path)

    speaker_turns = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        speaker_turns.append({
            "start_ms": int(turn.start * 1000),
            "end_ms": int(turn.end * 1000),
            "speaker": speaker,
        })

    return speaker_turns


def assign_speakers_to_segments(
    segments: list[TranscriptSegment],
    speaker_turns: list[dict],
) -> list[TranscriptSegment]:
    """
    Assign speaker labels to transcript segments based on overlap
    with diarization output.
    """
    for seg in segments:
        seg_mid = (seg.start_ms + seg.end_ms) / 2
        best_speaker = None
        best_overlap = 0

        for turn in speaker_turns:
            overlap_start = max(seg.start_ms, turn["start_ms"])
            overlap_end = min(seg.end_ms, turn["end_ms"])
            overlap = max(0, overlap_end - overlap_start)

            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = turn["speaker"]

        seg.speaker = best_speaker

        for word in seg.words:
            word_mid = (word.start_ms + word.end_ms) / 2
            for turn in speaker_turns:
                if turn["start_ms"] <= word_mid <= turn["end_ms"]:
                    word.speaker = turn["speaker"]
                    break

    return segments
