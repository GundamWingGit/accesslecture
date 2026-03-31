"""
Backward-compatible facade — delegates to the active VisualAnalysisProvider.

Do not add logic here. All visual analysis logic lives in providers/.
"""


def detect_on_screen_text(video_path: str) -> list[dict]:
    from app.services.providers import get_visual_analysis_provider
    return get_visual_analysis_provider().detect_text(video_path)


def group_slide_text(detections: list[dict], gap_ms: int = 3000) -> list[dict]:
    from app.services.providers import get_visual_analysis_provider
    return get_visual_analysis_provider().group_slides(detections, gap_ms)
