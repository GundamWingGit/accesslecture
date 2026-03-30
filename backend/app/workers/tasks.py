import logging
import tempfile
import httpx
from celery import shared_task
from app.services.supabase_client import get_supabase
from app.models.schemas import LectureStatus

logger = logging.getLogger(__name__)


def _update_lecture_status(lecture_id: str, status: str, progress_pct: float = 0, message: str = ""):
    sb = get_supabase()
    sb.table("lectures").update({
        "status": status,
        "progress_pct": progress_pct,
        "progress_message": message,
    }).eq("id", lecture_id).execute()


@shared_task(bind=True, max_retries=2)
def process_lecture_pipeline(self, lecture_id: str):
    """
    Main processing pipeline:
    1. Download audio from storage
    2. Transcribe with faster-whisper
    3. Diarize speakers with pyannote
    4. Generate compliant captions
    5. Run AI cleanup
    6. Score accessibility
    """
    try:
        sb = get_supabase()
        lecture = sb.table("lectures").select("*").eq("id", lecture_id).execute()
        if not lecture.data:
            logger.error(f"Lecture {lecture_id} not found")
            return

        lecture_data = lecture.data[0]
        audio_url = lecture_data["audio_url"]
        compliance_mode = lecture_data.get("compliance_mode", "clean")

        # Step 1: Download audio
        _update_lecture_status(lecture_id, LectureStatus.TRANSCRIBING.value, 5, "Downloading audio...")
        audio_path = _download_audio(audio_url)

        # Step 2: Transcribe
        _update_lecture_status(lecture_id, LectureStatus.TRANSCRIBING.value, 15, "Transcribing audio...")
        from app.services.whisper_service import transcribe_audio
        segments, info = transcribe_audio(audio_path)

        _update_lecture_status(lecture_id, LectureStatus.TRANSCRIBING.value, 45, "Transcription complete")

        duration_seconds = info.get("duration_seconds", 0)
        sb.table("lectures").update({"duration_seconds": duration_seconds}).eq("id", lecture_id).execute()

        # Step 3: Diarize
        _update_lecture_status(lecture_id, LectureStatus.DIARIZING.value, 50, "Identifying speakers...")
        from app.services.diarization import diarize_audio, assign_speakers_to_segments
        speaker_turns = diarize_audio(audio_path)
        segments = assign_speakers_to_segments(segments, speaker_turns)

        _update_lecture_status(lecture_id, LectureStatus.DIARIZING.value, 65, "Speaker identification complete")

        # Store transcript
        raw_text = " ".join(seg.text for seg in segments)
        sb.table("transcripts").upsert({
            "lecture_id": lecture_id,
            "segments": [seg.model_dump() for seg in segments],
            "raw_text": raw_text,
            "speaker_map": {},
        }, on_conflict="lecture_id").execute()

        # Step 4: Generate captions
        _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 70, "Generating captions...")
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
            }).execute()

        # Step 5: AI Cleanup
        _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 75, "Running AI cleanup...")
        _run_cleanup_on_captions(lecture_id, compliance_mode)

        _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 85, "AI cleanup complete")

        # Step 6: Score
        _update_lecture_status(lecture_id, LectureStatus.SCORING.value, 90, "Scoring accessibility...")
        _run_scoring(lecture_id, duration_seconds)

        _update_lecture_status(lecture_id, LectureStatus.COMPLETED.value, 100, "Processing complete!")

    except Exception as e:
        logger.exception(f"Pipeline failed for lecture {lecture_id}")
        _update_lecture_status(lecture_id, LectureStatus.FAILED.value, 0, str(e)[:500])
        raise self.retry(exc=e, countdown=60)
    finally:
        import os
        if 'audio_path' in locals():
            try:
                os.unlink(audio_path)
            except OSError:
                pass


def _download_audio(audio_url: str) -> str:
    """Download audio from URL to a temp file."""
    suffix = ".wav"
    if ".mp3" in audio_url:
        suffix = ".mp3"
    elif ".m4a" in audio_url:
        suffix = ".m4a"

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix)
    with httpx.Client(timeout=300) as client:
        with client.stream("GET", audio_url) as resp:
            resp.raise_for_status()
            for chunk in resp.iter_bytes(chunk_size=8192):
                tmp.write(chunk)
    tmp.close()
    return tmp.name


def _run_cleanup_on_captions(lecture_id: str, mode: str):
    """Run AI cleanup on all captions for a lecture."""
    from app.services.llm_service import cleanup_transcript_segment

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
            cleaned = cleanup_transcript_segment(
                text=cap["original_text"],
                mode=mode,
                speaker=cap.get("speaker"),
            )
            sb.table("captions").update({"cleaned_text": cleaned}).eq("id", cap["id"]).execute()
        except Exception as e:
            logger.warning(f"Cleanup failed for caption {cap['id']}: {e}")
            sb.table("captions").update({"cleaned_text": cap["original_text"]}).eq("id", cap["id"]).execute()


def _run_scoring(lecture_id: str, duration_seconds: float | None = None):
    """Run compliance scoring on captions."""
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


@shared_task
def run_ai_cleanup(lecture_id: str, mode: str = "clean", syllabus_context: str | None = None):
    _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 50, "Running AI cleanup...")
    from app.services.llm_service import cleanup_transcript_segment

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
            cleaned = cleanup_transcript_segment(
                text=cap["original_text"],
                mode=mode,
                speaker=cap.get("speaker"),
                syllabus_context=syllabus_context,
            )
            sb.table("captions").update({"cleaned_text": cleaned}).eq("id", cap["id"]).execute()
        except Exception as e:
            logger.warning(f"Cleanup failed for caption {cap['id']}: {e}")

    _update_lecture_status(lecture_id, LectureStatus.COMPLETED.value, 100, "Cleanup complete")


@shared_task
def run_fix_all(
    lecture_id: str,
    mode: str = "clean",
    fix_grammar: bool = True,
    fix_formatting: bool = True,
    fix_speakers: bool = True,
    syllabus_context: str | None = None,
):
    _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 10, "Running Fix All...")

    if fix_grammar:
        _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 30, "Fixing grammar and filler...")
        _run_cleanup_on_captions(lecture_id, mode)

    if fix_formatting:
        _update_lecture_status(lecture_id, LectureStatus.CLEANING.value, 60, "Fixing formatting...")
        _fix_caption_formatting(lecture_id)

    _update_lecture_status(lecture_id, LectureStatus.SCORING.value, 80, "Re-scoring...")
    sb = get_supabase()
    lecture = sb.table("lectures").select("duration_seconds").eq("id", lecture_id).execute()
    duration = lecture.data[0].get("duration_seconds") if lecture.data else None
    _run_scoring(lecture_id, duration)

    _update_lecture_status(lecture_id, LectureStatus.COMPLETED.value, 100, "Fix All complete!")


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
        needs_fix = False

        for line in lines:
            if len(line) > formatter.max_line_length:
                needs_fix = True
                break
        if len(lines) > formatter.max_lines:
            needs_fix = True

        if needs_fix:
            chunks = formatter._split_into_caption_chunks(text.replace("\n", " "))
            if chunks:
                sb.table("captions").update({"cleaned_text": chunks[0]}).eq("id", cap["id"]).execute()


@shared_task
def run_accessibility_scoring(lecture_id: str):
    sb = get_supabase()
    lecture = sb.table("lectures").select("duration_seconds").eq("id", lecture_id).execute()
    duration = lecture.data[0].get("duration_seconds") if lecture.data else None
    _run_scoring(lecture_id, duration)
