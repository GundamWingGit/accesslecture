from fastapi import APIRouter, HTTPException
from app.models.schemas import (
    LectureCreate,
    LectureResponse,
    LectureStatus,
    ProcessingProgress,
)
from app.services.supabase_client import get_supabase
from app.workers.tasks import process_lecture_pipeline

router = APIRouter()


@router.post("/", response_model=LectureResponse)
async def create_lecture(lecture: LectureCreate):
    sb = get_supabase()
    data = {
        "title": lecture.title,
        "audio_url": lecture.audio_url,
        "status": LectureStatus.UPLOADED.value,
        "compliance_mode": lecture.compliance_mode.value,
        "course_id": lecture.course_id,
    }
    result = sb.table("lectures").insert(data).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create lecture record")
    row = result.data[0]
    process_lecture_pipeline.delay(row["id"])
    return LectureResponse(**row)


@router.get("/{lecture_id}", response_model=LectureResponse)
async def get_lecture(lecture_id: str):
    sb = get_supabase()
    result = sb.table("lectures").select("*").eq("id", lecture_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    return LectureResponse(**result.data[0])


@router.get("/", response_model=list[LectureResponse])
async def list_lectures():
    sb = get_supabase()
    result = sb.table("lectures").select("*").order("created_at", desc=True).execute()
    return [LectureResponse(**row) for row in result.data]


@router.get("/{lecture_id}/progress", response_model=ProcessingProgress)
async def get_progress(lecture_id: str):
    sb = get_supabase()
    result = sb.table("lectures").select("id, status, progress_pct, progress_message").eq("id", lecture_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lecture not found")
    row = result.data[0]
    return ProcessingProgress(
        lecture_id=row["id"],
        status=row["status"],
        progress_pct=row.get("progress_pct", 0),
        message=row.get("progress_message", ""),
    )


@router.delete("/{lecture_id}")
async def delete_lecture(lecture_id: str):
    sb = get_supabase()
    sb.table("captions").delete().eq("lecture_id", lecture_id).execute()
    sb.table("transcripts").delete().eq("lecture_id", lecture_id).execute()
    sb.table("accessibility_scores").delete().eq("lecture_id", lecture_id).execute()
    sb.table("lectures").delete().eq("id", lecture_id).execute()
    return {"deleted": True}
