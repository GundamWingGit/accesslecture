from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.supabase_client import get_supabase

router = APIRouter()


class CourseCreate(BaseModel):
    name: str
    syllabus_text: str | None = None
    vocabulary: list[str] = []


class CourseResponse(BaseModel):
    id: str
    name: str
    syllabus_text: str | None = None
    vocabulary: list[str] = []


@router.post("/", response_model=CourseResponse)
async def create_course(course: CourseCreate):
    sb = get_supabase()
    result = sb.table("courses").insert({
        "name": course.name,
        "syllabus_text": course.syllabus_text,
        "vocabulary": course.vocabulary,
    }).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Failed to create course")
    return CourseResponse(**result.data[0])


@router.get("/", response_model=list[CourseResponse])
async def list_courses():
    sb = get_supabase()
    result = sb.table("courses").select("*").order("created_at", desc=True).execute()
    return [CourseResponse(**row) for row in result.data]


@router.get("/{course_id}", response_model=CourseResponse)
async def get_course(course_id: str):
    sb = get_supabase()
    result = sb.table("courses").select("*").eq("id", course_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found")
    return CourseResponse(**result.data[0])


@router.put("/{course_id}/vocabulary")
async def update_vocabulary(course_id: str, vocabulary: list[str]):
    sb = get_supabase()
    result = sb.table("courses").update({"vocabulary": vocabulary}).eq("id", course_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"updated": True}


@router.put("/{course_id}/syllabus")
async def update_syllabus(course_id: str, syllabus_text: str):
    """Upload syllabus text to improve AI caption accuracy for course-specific terminology."""
    sb = get_supabase()

    # Extract vocabulary from syllabus using simple heuristics
    from app.services.llm_service import extract_vocabulary_from_syllabus
    vocab = await extract_vocabulary_from_syllabus(syllabus_text)

    result = sb.table("courses").update({
        "syllabus_text": syllabus_text,
        "vocabulary": vocab,
    }).eq("id", course_id).execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Course not found")
    return {"updated": True, "vocabulary_extracted": len(vocab)}
