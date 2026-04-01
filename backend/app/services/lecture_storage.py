"""Remove Supabase Storage objects referenced by lecture media URLs."""

from __future__ import annotations

import logging
import re
from urllib.parse import unquote

logger = logging.getLogger(__name__)

_PUBLIC_OBJECT_RE = re.compile(r"/storage/v1/object/public/([^/]+)/(.+)$")


def parse_supabase_public_object_url(url: str) -> tuple[str, str] | None:
    m = _PUBLIC_OBJECT_RE.search(url)
    if not m:
        return None
    return m.group(1), unquote(m.group(2))


def remove_lecture_storage_objects(sb, audio_url: str | None, video_url: str | None) -> None:
    seen: set[str] = set()
    for url in (audio_url, video_url):
        if not url:
            continue
        parsed = parse_supabase_public_object_url(url)
        if not parsed:
            continue
        bucket, path = parsed
        key = f"{bucket}\0{path}"
        if key in seen:
            continue
        seen.add(key)
        try:
            sb.storage.from_(bucket).remove([path])
        except Exception as e:
            logger.warning("storage remove %s/%s: %s", bucket, path, e)
