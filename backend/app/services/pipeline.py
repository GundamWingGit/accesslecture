"""
Processing pipeline for AccessLecture.

All AI operations go through the provider abstraction layer —
no provider-specific imports appear here.  Swapping transcription
from Gemini to Cloud Speech-to-Text (Phase 2) requires zero changes
in this file; only the config value changes.

These are plain functions invoked via FastAPI BackgroundTasks.
"""
import logging
import os
import tempfile

import httpx

from app.models.schemas import LectureStatus
from app.services.supabase_client import get_supabase

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _update_lecture_status(
    lecture_id: str,
    status: str,
    progress_pct: float = 0,
    message: str = "",
):
    sb = get_supabase()
    sb.table("lectures").update({
        "status": status,
        "progress_pct": progress_pct,
        "progress_message": message,
    }).eq("id", lecture_id).execute()


def _download_file(url: str) -> str:
    """Download a URL to a temp file and return the path."""
    suffix = ".wav"
    for ext in (".mp3", ".m4a", ".mp4", ".webm", ".mov"):
        if ext in url:
            suffix = ext
            break

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    with httpx.Client(timeout=300) as client:
        with client.stream("GET", url) as resp:
            resp.raise_for_status()
            for chunk in resp.iter_bytes(chunk_size=8192):
                tmp.write(chunk)
    tmp.close()
    return tmp.name


def _safe_unlink(*paths: str | None):
    for p in paths:
        if p:
            try:
                os.unlink(p)
            except OSError:
                pass


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def process_lecture_pipeline(lecture_id: str):
    """
    End-to-end lecture processing:
      1. Download media
      2. Transcribe + diarize   (TranscriptionProvider)
      3. Detect on-screen text  (VisualAnalysisProvider)
      4. Generate compliant captions
      5. AI cleanup             (CleanupProvider)
      6. Score accessibility
    """
    audio_path: str | None = None
    video_path: str | None = None

    try:
        from app.config import get_settings
        from app.services.providers import (
            get_transcription_provider,
            get_visual_analysis_provider,
        )

        settings = get_settings()
        sb = get_supabase()

        lecture = sb.table("lectures").select("*").eq("id", lecture_id).execute()
        if not lecture.data:
            logger.error("Lecture %s not found", lecture_id)
            return

        lecture_data = lecture.data[0]
        audio_url = lecture_data["audio_url"]
        video_url = lecture_data.get("video_url")
        compliance_mode = lecture_data.get("compliance_mode", "clean")

        # ---- 1. Download audio ----
        _update_lecture_status(lecture_id, LectureStatus.TRANSCRIBING.value, 5, "Downloading audio…")
        audio_path = _download_file(audio_url)

        # ---- 2. Transcribe + diarize ----
        _update_lecture_status(lecture_id, LectureStatus.TRANSCRIBING.value, 10, "Transcribing audio…")
        transcriber = get_transcription_provider()
        segments, info = transcriber.transcribe(audio_path)

        duration_seconds = info.get("duration_seconds", 0)
        sb.table("lectures").update({"duration_seconds": duration_seconds}).eq("id", lecture_id).execute()
        _update_lecture_status(lecture_id, LectureStatus.TRANSCRIBING.value, 45, "Transcription complete")

        # ---- 3. Visual analysis (optional) ----
        slide_texts: list[dict] = []
        if settings.enable_video_ocr and video_url:
            try:
                _update_lecture_status(lecture_id, LectureStatus.TRANSCRIBING.value, 50, "Detecting on-screen text…")
                video_path = _download_file(video_url)
                visual = get_visual_analysis_provider()
                raw_detections = visual.detect_text(video_path)
                slide_texts = visual.group_slides(raw_detections)
                logger.info("Detected %d slide groups from video", len(slide_texts))
            except Exception as e:
                logger.warning("Video analysis failed (non-fatal): %s", e)

        # ---- Store transcript + OCR data ----
        raw_text = " ".join(seg.text for seg in segments)
        sb.table("transcripts").upsert({
            "lecture_id": lecture_id,
            "segments": [seg.model_dump() for seg in segments],
            "raw_text": raw_text,
            "speaker_map": {},
            "slide_texts": slide_texts,
        }, on_conflict="lecture_id").execute()

        # ---- 4. Generate captions ----
        _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 60, "Generating captions…")
        from app.services.caption_formatter import CaptionFormatter
        formatter = CaptionFormatter()
        captions = formatter.segments_to_captions(segments)

        for cap in captions:
            sb.table("captions").insert({
                "id": cap.id,
                "lecture_id": lecture_id,
                "sequence": cap.sequence,
                "start_ms": cap.start_ms,
                "end_ms": cap.end_ms,
                "original_text": cap.original_text,
                "speaker": cap.speaker,
                "min_confidence": cap.min_confidence,
            }).execute()

        # ---- 5. AI cleanup ----
        _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 70, "Running AI cleanup…")
        _run_cleanup_on_captions(lecture_id, compliance_mode)
        _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 85, "AI cleanup complete")

        # ---- 6. Score accessibility ----
        _update_lecture_status(lecture_id, LectureStatus.SCORING.value, 90, "Scoring accessibility…")
        _run_scoring(lecture_id, duration_seconds)

        _update_lecture_status(lecture_id, LectureStatus.COMPLETED.value, 100, "Processing complete!")

    except Exception as e:
        logger.exception("Pipeline failed for lecture %s", lecture_id)
        _update_lecture_status(lecture_id, LectureStatus.FAILED.value, 0, str(e)[:500])
    finally:
        _safe_unlink(audio_path, video_path)


# ---------------------------------------------------------------------------
# Reusable sub-steps
# ---------------------------------------------------------------------------

def _run_cleanup_on_captions(lecture_id: str, mode: str):
    """Run AI cleanup on all captions for a lecture via the CleanupProvider."""
    from app.services.providers import get_cleanup_provider
    cleaner = get_cleanup_provider()

    sb = get_supabase()
    captions = (
        sb.table("captions")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("sequence")
        .execute()
    )

    for cap in captions.data:
        try:
            cleaned = cleaner.cleanup_segment(
                text=cap["original_text"],
                mode=mode,
                speaker=cap.get("speaker"),
            )
            sb.table("captions").update({"cleaned_text": cleaned}).eq("id", cap["id"]).execute()
        except Exception as e:
            logger.warning("Cleanup failed for caption %s: %s", cap["id"], e)
            sb.table("captions").update({"cleaned_text": cap["original_text"]}).eq("id", cap["id"]).execute()


def _run_scoring(lecture_id: str, duration_seconds: float | None = None):
    """Run compliance scoring on captions (provider-agnostic, pure logic)."""
    from app.services.compliance_scorer import ComplianceScorer

    sb = get_supabase()
    captions = (
        sb.table("captions")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("sequence")
        .execute()
    )

    scorer = ComplianceScorer()
    score = scorer.score_captions(captions.data, duration_seconds)
    visual_refs = scorer.detect_all_visual_references(captions.data)

    sb.table("accessibility_scores").insert({
        "lecture_id": lecture_id,
        "overall": score.overall,
        "rating": score.rating,
        "dimensions": [d.model_dump() for d in score.dimensions],
        "visual_references": [vr.model_dump() for vr in visual_refs],
    }).execute()


def _fix_caption_formatting(lecture_id: str):
    """Re-format captions to comply with line length and line count limits."""
    from app.services.caption_formatter import CaptionFormatter

    sb = get_supabase()
    formatter = CaptionFormatter()

    captions = (
        sb.table("captions")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("sequence")
        .execute()
    )

    for cap in captions.data:
        text = cap.get("cleaned_text") or cap["original_text"]
        lines = text.split("\n")
        needs_fix = any(len(line) > formatter.max_line_length for line in lines) or (
            len(lines) > formatter.max_lines
        )

        if needs_fix:
            chunks = formatter._split_into_caption_chunks(text.replace("\n", " "))
            if chunks:
                sb.table("captions").update({"cleaned_text": chunks[0]}).eq("id", cap["id"]).execute()


# ---------------------------------------------------------------------------
# Standalone operations (called from API endpoints via BackgroundTasks)
# ---------------------------------------------------------------------------

def run_ai_cleanup(
    lecture_id: str,
    mode: str = "clean",
    syllabus_context: str | None = None,
):
    _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 50, "Running AI cleanup…")

    from app.services.providers import get_cleanup_provider
    cleaner = get_cleanup_provider()

    sb = get_supabase()
    captions = (
        sb.table("captions")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("sequence")
        .execute()
    )

    for cap in captions.data:
        try:
            cleaned = cleaner.cleanup_segment(
                text=cap["original_text"],
                mode=mode,
                speaker=cap.get("speaker"),
                syllabus_context=syllabus_context,
            )
            sb.table("captions").update({"cleaned_text": cleaned}).eq("id", cap["id"]).execute()
        except Exception as e:
            logger.warning("Cleanup failed for caption %s: %s", cap["id"], e)

    _update_lecture_status(lecture_id, LectureStatus.COMPLETED.value, 100, "Cleanup complete")


def run_fix_all(
    lecture_id: str,
    mode: str = "clean",
    fix_grammar: bool = True,
    fix_formatting: bool = True,
    fix_speakers: bool = True,
    syllabus_context: str | None = None,
):
    _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 10, "Running Fix All…")

    if fix_grammar:
        _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 30, "Fixing grammar and filler…")
        _run_cleanup_on_captions(lecture_id, mode)

    if fix_formatting:
        _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 60, "Fixing formatting…")
        _fix_caption_formatting(lecture_id)

    _update_lecture_status(lecture_id, LectureStatus.SCORING.value, 80, "Re-scoring…")
    sb = get_supabase()
    lecture = sb.table("lectures").select("duration_seconds").eq("id", lecture_id).execute()
    duration = lecture.data[0].get("duration_seconds") if lecture.data else None
    _run_scoring(lecture_id, duration)

    _update_lecture_status(lecture_id, LectureStatus.COMPLETED.value, 100, "Fix All complete!")


def run_accessibility_scoring(lecture_id: str):
    sb = get_supabase()
    lecture = sb.table("lectures").select("duration_seconds").eq("id", lecture_id).execute()
    duration = lecture.data[0].get("duration_seconds") if lecture.data else None
    _run_scoring(lecture_id, duration)


def run_video_ocr(lecture_id: str, video_url: str):
    """Standalone video OCR via the VisualAnalysisProvider."""
    _update_lecture_status(lecture_id, LectureStatus.TRANSCRIBING.value, 50, "Running video OCR…")

    video_path = None
    try:
        video_path = _download_file(video_url)

        from app.services.providers import get_visual_analysis_provider
        visual = get_visual_analysis_provider()
        raw_detections = visual.detect_text(video_path)
        slide_texts = visual.group_slides(raw_detections)

        sb = get_supabase()
        sb.table("transcripts").update({
            "slide_texts": slide_texts,
        }).eq("lecture_id", lecture_id).execute()

        _update_lecture_status(lecture_id, LectureStatus.COMPLETED.value, 100, "Video OCR complete")
    except Exception as e:
        logger.exception("Video OCR failed for lecture %s", lecture_id)
        _update_lecture_status(lecture_id, LectureStatus.FAILED.value, 0, str(e)[:500])
    finally:
        _safe_unlink(video_path)
