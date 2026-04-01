import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth } from "@/lib/server/api-helpers";
import { removeLectureStorageObjects } from "@/lib/server/lecture-delete";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, async (userId) => {
    const sb = getSupabase();
    const { data } = await sb
      .from("lectures")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId);
    if (!data?.length) return error("Lecture not found", 404);
    return json(data[0]);
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, async (userId) => {
    const sb = getSupabase();
    const { data: rows } = await sb
      .from("lectures")
      .select("id, audio_url, video_url")
      .eq("id", id)
      .eq("user_id", userId);
    if (!rows?.length) return error("Lecture not found", 404);

    const row = rows[0];
    await removeLectureStorageObjects(sb, row.audio_url, row.video_url);

    await sb.from("captions").delete().eq("lecture_id", id);
    await sb.from("transcripts").delete().eq("lecture_id", id);
    await sb.from("accessibility_scores").delete().eq("lecture_id", id);
    await sb.from("lectures").delete().eq("id", id);

    const { data: profile } = await sb
      .from("user_profiles")
      .select("plan, lectures_this_month")
      .eq("id", userId)
      .maybeSingle();

    if (
      profile &&
      !["pro", "institution"].includes(profile.plan ?? "free") &&
      (profile.lectures_this_month ?? 0) > 0
    ) {
      await sb
        .from("user_profiles")
        .update({
          lectures_this_month: Math.max(0, (profile.lectures_this_month ?? 0) - 1),
        })
        .eq("id", userId);
    }

    return json({ deleted: true });
  });
}
