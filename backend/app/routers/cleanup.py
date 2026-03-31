from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from app.auth import get_current_user_id
from app.rate_limit import limiter
from app.models.schemas import CleanupRequest, CaptionsResponse, CaptionUpdateBody, FixAllRequest
from app.services.supabase_client import get_supabase
from app.services.pipeline import run_ai_cleanup, run_fix_all

router = APIRouter()


def _verify_lecture_ownership(lecture_id: str, user_id: str):
    sb = get_supabase()
    result = sb.table("lectures").select("id").eq("id", lecture_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lecture not found")


@router.post("/run")
@limiter.limit("20/hour")
async def trigger_cleanup(
    request_obj: Request,
    request: CleanupRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    _verify_lecture_ownership(request.lecture_id, user_id)
    background_tasks.add_task(run_ai_cleanup, request.lecture_id, request.mode.value, request.syllabus_context)
    return {"status": "cleanup_started", "lecture_id": request.lecture_id}


@router.post("/fix-all")
@limiter.limit("20/hour")
async def trigger_fix_all(
    request_obj: Request,
    request: FixAllRequest,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    _verify_lecture_ownership(request.lecture_id, user_id)
    background_tasks.add_task(
        run_fix_all,
        request.lecture_id,
        request.mode.value,
        request.fix_grammar,
        request.fix_formatting,
        request.fix_speakers,
        request.syllabus_context,
    )
    return {"status": "fix_all_started", "lecture_id": request.lecture_id}


@router.get("/{lecture_id}/captions", response_model=CaptionsResponse)
async def get_captions(lecture_id: str, user_id: str = Depends(get_current_user_id)):
    _verify_lecture_ownership(lecture_id, user_id)
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
async def update_caption(
    lecture_id: str,
    caption_id: str,
    body: CaptionUpdateBody,
    user_id: str = Depends(get_current_user_id),
):
    _verify_lecture_ownership(lecture_id, user_id)
    sb = get_supabase()
    result = (
        sb.table("captions")
        .update({"cleaned_text": body.text})
        .eq("id", caption_id)
        .eq("lecture_id", lecture_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Caption not found")
    sb.table("lectures").update({"reviewed_at": None}).eq("id", lecture_id).execute()
    return {"updated": True}
