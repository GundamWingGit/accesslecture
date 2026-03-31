import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth, verifyLectureOwnership } from "@/lib/server/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  const { lectureId } = await params;
  return withAuth(request, async (userId) => {
    if (!(await verifyLectureOwnership(lectureId, userId)))
      return error("Lecture not found", 404);

    const sb = getSupabase();
    const { data } = await sb
      .from("transcripts")
      .select("*")
      .eq("lecture_id", lectureId);
    if (!data?.length) return error("Transcript not found", 404);
    const row = data[0];
    return json({
      lecture_id: row.lecture_id,
      segments: row.segments ?? [],
      raw_text: row.raw_text ?? "",
      cleaned_text: row.cleaned_text ?? null,
      speaker_map: row.speaker_map ?? {},
    });
  });
}
