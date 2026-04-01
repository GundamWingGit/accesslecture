import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Parse bucket + object path from a Supabase public object URL.
 */
export function parseSupabasePublicObjectUrl(
  url: string
): { bucket: string; path: string } | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
    if (!m) return null;
    return { bucket: m[1], path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

/**
 * Remove uploaded audio/video objects referenced by lecture URLs (deduped).
 */
export async function removeLectureStorageObjects(
  sb: SupabaseClient,
  audioUrl: string | null | undefined,
  videoUrl: string | null | undefined
): Promise<void> {
  const seen = new Set<string>();
  for (const url of [audioUrl, videoUrl]) {
    if (!url || typeof url !== "string") continue;
    const parsed = parseSupabasePublicObjectUrl(url);
    if (!parsed) continue;
    const key = `${parsed.bucket}\0${parsed.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const { error } = await sb.storage.from(parsed.bucket).remove([parsed.path]);
    if (error) {
      console.warn(
        `[lecture-delete] storage remove ${parsed.bucket}/${parsed.path}:`,
        error.message
      );
    }
  }
}
