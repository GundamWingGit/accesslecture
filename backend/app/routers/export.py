from fastapi import APIRouter, HTTPException
from fastapi.responses import PlainTextResponse, Response
from app.models.schemas import ExportFormat, ExportRequest
from app.services.supabase_client import get_supabase
from app.services.caption_formatter import CaptionFormatter
from app.services.lms_export import LMSExporter

router = APIRouter()


@router.post("/{lecture_id}")
async def export_lecture(lecture_id: str, request: ExportRequest):
    sb = get_supabase()
    captions_result = (
        sb.table("captions")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("sequence")
        .execute()
    )
    if not captions_result.data:
        raise HTTPException(status_code=404, detail="No captions found")

    lecture_result = sb.table("lectures").select("title").eq("id", lecture_id).execute()
    title = lecture_result.data[0]["title"] if lecture_result.data else "lecture"

    formatter = CaptionFormatter()
    exports = {}

    use_cleaned = request.use_cleaned
    for fmt in request.formats:
        if fmt == ExportFormat.VTT:
            exports["vtt"] = formatter.to_vtt(captions_result.data, use_cleaned)
        elif fmt == ExportFormat.SRT:
            exports["srt"] = formatter.to_srt(captions_result.data, use_cleaned)
        elif fmt == ExportFormat.TXT:
            exports["txt"] = formatter.to_txt(captions_result.data, use_cleaned)
        elif fmt == ExportFormat.JSON:
            exports["json"] = captions_result.data

    return {"title": title, "exports": exports}


@router.get("/{lecture_id}/vtt")
async def export_vtt(lecture_id: str, cleaned: bool = True):
    sb = get_supabase()
    result = (
        sb.table("captions")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("sequence")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No captions found")

    formatter = CaptionFormatter()
    vtt_content = formatter.to_vtt(result.data, cleaned)
    return PlainTextResponse(content=vtt_content, media_type="text/vtt")


@router.get("/{lecture_id}/srt")
async def export_srt(lecture_id: str, cleaned: bool = True):
    sb = get_supabase()
    result = (
        sb.table("captions")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("sequence")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No captions found")

    formatter = CaptionFormatter()
    srt_content = formatter.to_srt(result.data, cleaned)
    return PlainTextResponse(content=srt_content, media_type="text/plain")


@router.get("/{lecture_id}/canvas-package")
async def export_canvas_package(lecture_id: str, cleaned: bool = True):
    """Export a Canvas-ready ZIP package with captions, transcript, and report."""
    sb = get_supabase()

    lecture = sb.table("lectures").select("title").eq("id", lecture_id).execute()
    if not lecture.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    title = lecture.data[0]["title"]

    captions = (
        sb.table("captions")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("sequence")
        .execute()
    )
    if not captions.data:
        raise HTTPException(status_code=404, detail="No captions found")

    formatter = CaptionFormatter()
    transcript = formatter.to_txt(captions.data, cleaned)

    score_result = (
        sb.table("accessibility_scores")
        .select("overall, rating, dimensions")
        .eq("lecture_id", lecture_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    score_data = score_result.data[0] if score_result.data else None

    exporter = LMSExporter()
    zip_bytes = exporter.create_canvas_package(
        lecture_title=title,
        captions=captions.data,
        transcript_text=transcript,
        score_data=score_data,
        use_cleaned=cleaned,
    )

    safe_title = "".join(c if c.isalnum() or c in " -_" else "" for c in title).strip()
    return Response(
        content=zip_bytes,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{safe_title}_canvas_package.zip"'},
    )
