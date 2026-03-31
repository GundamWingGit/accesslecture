"""
Backward-compatible facade — delegates to the active CleanupProvider.

Do not add logic here. All AI cleanup/reasoning logic lives in providers/.
"""


def cleanup_transcript_segment(
    text: str,
    mode: str = "clean",
    speaker: str | None = None,
    syllabus_context: str | None = None,
) -> str:
    from app.services.providers import get_cleanup_provider
    return get_cleanup_provider().cleanup_segment(text, mode, speaker, syllabus_context)


def detect_visual_references(text: str) -> list[dict]:
    from app.services.providers import get_cleanup_provider
    return get_cleanup_provider().detect_visual_references(text)


async def extract_vocabulary_from_syllabus(syllabus_text: str) -> list[str]:
    from app.services.providers import get_cleanup_provider
    return get_cleanup_provider().extract_vocabulary(syllabus_text)


def generate_accessibility_suggestions(
    score: float,
    issues: list[dict],
) -> list[dict]:
    from app.services.providers import get_cleanup_provider
    return get_cleanup_provider().generate_suggestions(score, issues)
