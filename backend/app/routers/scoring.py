from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request
from app.auth import get_current_user_id
from app.rate_limit import limiter
from app.models.schemas import AccessibilityScore, IssueItem, VisualReferenceFlag
from app.services.supabase_client import get_supabase
from app.services.pipeline import run_accessibility_scoring

router = APIRouter()


def _verify_lecture_ownership(lecture_id: str, user_id: str):
    sb = get_supabase()
    result = sb.table("lectures").select("id").eq("id", lecture_id).eq("user_id", user_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Lecture not found")


@router.post("/{lecture_id}/run")
@limiter.limit("20/hour")
async def trigger_scoring(
    request: Request,
    lecture_id: str,
    background_tasks: BackgroundTasks,
    user_id: str = Depends(get_current_user_id),
):
    _verify_lecture_ownership(lecture_id, user_id)
    background_tasks.add_task(run_accessibility_scoring, lecture_id)
    return {"status": "scoring_started", "lecture_id": lecture_id}


@router.get("/{lecture_id}", response_model=AccessibilityScore)
async def get_score(lecture_id: str, user_id: str = Depends(get_current_user_id)):
    _verify_lecture_ownership(lecture_id, user_id)
    sb = get_supabase()
    result = (
        sb.table("accessibility_scores")
        .select("*")
        .eq("lecture_id", lecture_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Score not found. Run scoring first.")
    row = result.data[0]
    return AccessibilityScore(
        overall=row["overall"],
        rating=row["rating"],
        dimensions=row.get("dimensions", []),
    )


@router.get("/{lecture_id}/issues", response_model=list[IssueItem])
async def get_issues(lecture_id: str, user_id: str = Depends(get_current_user_id)):
    _verify_lecture_ownership(lecture_id, user_id)
    sb = get_supabase()
    result = (
        sb.table("accessibility_scores")
        .select("dimensions")
        .eq("lecture_id", lecture_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No scoring data found")

    issues: list[IssueItem] = []
    issue_counter = 0
    for dim in result.data[0].get("dimensions", []):
        for issue_text in dim.get("issues", []):
            issue_counter += 1
            issues.append(
                IssueItem(
                    id=f"issue-{issue_counter}",
                    type=dim["id"],
                    severity="warning",
                    caption_id=None,
                    message=issue_text,
                    auto_fixable=dim["id"] in ("formatting", "accuracy"),
                )
            )
    return issues


@router.get("/{lecture_id}/visual-references", response_model=list[VisualReferenceFlag])
async def get_visual_references(lecture_id: str, user_id: str = Depends(get_current_user_id)):
    _verify_lecture_ownership(lecture_id, user_id)
    sb = get_supabase()
    result = (
        sb.table("accessibility_scores")
        .select("visual_references")
        .eq("lecture_id", lecture_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data or not result.data[0].get("visual_references"):
        return []
    return [VisualReferenceFlag(**vr) for vr in result.data[0]["visual_references"]]
