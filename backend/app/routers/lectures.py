from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from app.auth import get_current_user_id
from app.config import get_settings
from app.rate_limit import limiter
from app.models.schemas import (
    LectureCreate,
    LectureResponse,
    LectureStatus,
    ProcessingProgress,
)
from app.services.supabase_client import get_supabase
from app.services.pipeline import process_lecture_pipeline

router = APIRouter()


def _check_plan_limits(user_id: str):
    """Enforce free-plan lecture limit. Pro/institution users are unlimited."""
    sb = get_supabase()
    settings = get_settings()
    result = sb.table("user_profiles").select("*").eq("id", user_id).execute()
    if not result.data:
        sb.table("user_profiles").insert({"id": user_id}).execute()
        result = sb.table("user_profiles").select("*").eq("id", user_id).execute()

    profile = result.data[0]
    if profile.get("plan") in ("pro", "institution"):
        return

    month_reset = profile.get("month_reset_at")
    now = datetime.now(timezone.utc)
    if month_reset:
        reset_dt = datetime.fromisoformat(month_reset.replace("Z", "+00:00"))
        if (now - reset_dt).days >= 30:
            sb.table("user_profiles").update({
                "lectures_this_month": 0,
                "month_reset_at": now.isoformat(),
            }).eq("id", user_id).execute()
            return

    count = profile.get("lectures_this_month", 0)
    if count >= settings.free_lectures_per_month:
        raise HTTPException(
            status_code=403,
            detail=f"Free plan limit reached ({settings.free_lectures_per_month} lectures/month). Upgrade to Pro for unlimited uploads.",
        )


@router.post("/", response_model=LectureResponse)
@limiter.limit("10/hour")
async def create_lecture(
    request: Request,
    lecture: LectureCreate,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    _check_plan_limits(user_id)
    sb = get_supabase()
    data = {
        "title": lecture.title,
        "audio_url": lecture.audio_url,
        "video_url": lecture.video_url,
        "status": LectureStatus.UPLOADED.value,
        "compliance_mode": lecture.compliance_mode.value,
        "course_id": lecture.course_id,
        "user_id": user_id,
    }
    result = sb.table("lectures").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create lecture record")
    row = result.data[0]

    sb.table("user_profiles").update({
        "lectures_this_month": sb.table("user_profiles").select("lectures_this_month").eq("id", user_id).execute().data[0].get("lectures_this_month", 0) + 1,
    }).eq("id", user_id).execute()

    background_tasks.add_task(process_lecture_pipeline, row["id"])
    return LectureResponse(**row)


@router.get("/{lecture_id}", response_model=LectureResponse)
async def get_lecture(lecture_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = (
        sb.table("lectures")
        .select("*")
        .eq("id", lecture_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return LectureResponse(**result.data[0])


@router.get("/", response_model=list[LectureResponse])
async def list_lectures(user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = (
        sb.table("lectures")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return [LectureResponse(**row) for row in result.data]


@router.get("/{lecture_id}/progress", response_model=ProcessingProgress)
async def get_progress(lecture_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = (
        sb.table("lectures")
        .select("id, status, progress_pct, progress_message")
        .eq("id", lecture_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    row = result.data[0]
    return ProcessingProgress(
        lecture_id=row["id"],
        status=row["status"],
        progress_pct=row.get("progress_pct", 0),
        message=row.get("progress_message", ""),
    )


@router.post("/{lecture_id}/confirm-review")
async def confirm_review(lecture_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    result = (
        sb.table("lectures")
        .update({"reviewed_at": "now()"})
        .eq("id", lecture_id)
        .eq("user_id", user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return {"reviewed_at": result.data[0].get("reviewed_at")}


@router.delete("/{lecture_id}")
async def delete_lecture(lecture_id: str, user_id: str = Depends(get_current_user_id)):
    sb = get_supabase()
    # Verify ownership first
    check = sb.table("lectures").select("id").eq("id", lecture_id).eq("user_id", user_id).execute()
    if not check.data:
        raise HTTPException(status_code=404, detail="Lecture not found")

    sb.table("captions").delete().eq("lecture_id", lecture_id).execute()
    sb.table("transcripts").delete().eq("lecture_id", lecture_id).execute()
    sb.table("accessibility_scores").delete().eq("lecture_id", lecture_id).execute()
    sb.table("lectures").delete().eq("id", lecture_id).execute()
    return {"deleted": True}
