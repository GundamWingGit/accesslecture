from fastapi import APIRouter, HTTPException
from app.models.schemas import CleanupRequest, CaptionsResponse, FixAllRequest
from app.services.supabase_client import get_supabase
from app.workers.tasks import run_ai_cleanup, run_fix_all

router = APIRouter()


@router.post("/run")
async def trigger_cleanup(request: CleanupRequest):
    run_ai_cleanup.delay(request.lecture_id, request.mode.value, request.syllabus_context)
    return {"status": "cleanup_started", "lecture_id": request.lecture_id}


@router.post("/fix-all")
async def trigger_fix_all(request: FixAllRequest):
    run_fix_all.delay(
        request.lecture_id,
        request.mode.value,
        request.fix_grammar,
        request.fix_formatting,
        request.fix_speakers,
        request.syllabus_context,
    )
    return {"status": "fix_all_started", "lecture_id": request.lecture_id}


@router.get("/{lecture_id}/captions", response_model=CaptionsResponse)
async def get_captions(lecture_id: str):
    sb = get_supabase()
    result = (
        sb.table("captions")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("sequence")
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Captions not found")

    lecture = sb.table("lectures").select("compliance_mode").eq("id", lecture_id).execute()
    mode = lecture.data[0]["compliance_mode"] if lecture.data else "clean"

    return CaptionsResponse(
        lecture_id=lecture_id,
        captions=result.data,
        compliance_mode=mode,
    )


@router.put("/{lecture_id}/captions/{caption_id}")
async def update_caption(lecture_id: str, caption_id: str, text: str):
    sb = get_supabase()
    result = (
        sb.table("captions")
        .update({"cleaned_text": text})
        .eq("id", caption_id)
        .eq("lecture_id", lecture_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Caption not found")
    return {"updated": True}
