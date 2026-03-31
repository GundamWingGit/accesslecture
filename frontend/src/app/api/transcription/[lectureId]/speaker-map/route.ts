import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth, verifyLectureOwnership } from "@/lib/server/api-helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  const { lectureId } = await params;
  return withAuth(request, async (userId) => {
    if (!(await verifyLectureOwnership(lectureId, userId)))
      return error("Lecture not found", 404);

    const speakerMap = await request.json();
    const sb = getSupabase();
    const { data } = await sb
      .from("transcripts")
      .update({ speaker_map: speakerMap })
      .eq("lecture_id", lectureId)
      .select();
    if (!data?.length) return error("Transcript not found", 404);
    return json({ updated: true, speaker_map: speakerMap });
  });
}
