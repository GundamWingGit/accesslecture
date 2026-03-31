from fastapi import APIRouter, Depends, HTTPException
from app.auth import get_current_user_id
from app.models.schemas import TranscriptResponse
from app.services.supabase_client import get_supabase

router = APIRouter()


def _verify_lecture_ownership(lecture_id: str, user_id: str):
    sb = get_supabase()
    result = sb.table("lectures").select("id").eq("id", lecture_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lecture not found")


@router.get("/{lecture_id}", response_model=TranscriptResponse)
async def get_transcript(lecture_id: str, user_id: str = Depends(get_current_user_id)):
    _verify_lecture_ownership(lecture_id, user_id)
    sb = get_supabase()
    result = sb.table("transcripts").select("*").eq("lecture_id", lecture_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Transcript not found")
    row = result.data[0]
    return TranscriptResponse(
        lecture_id=row["lecture_id"],
        segments=row.get("segments", []),
        raw_text=row.get("raw_text", ""),
        cleaned_text=row.get("cleaned_text"),
        speaker_map=row.get("speaker_map", {}),
    )


@router.put("/{lecture_id}/speaker-map")
async def update_speaker_map(
    lecture_id: str,
    speaker_map: dict[str, str],
    user_id: str = Depends(get_current_user_id),
):
    _verify_lecture_ownership(lecture_id, user_id)
    sb = get_supabase()
    result = sb.table("transcripts").update({"speaker_map": speaker_map}).eq("lecture_id", lecture_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Transcript not found")
    return {"updated": True, "speaker_map": speaker_map}
