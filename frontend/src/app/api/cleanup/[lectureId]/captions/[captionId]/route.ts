import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth, verifyLectureOwnership } from "@/lib/server/api-helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ lectureId: string; captionId: string }> }
) {
  const { lectureId, captionId } = await params;
  return withAuth(request, async (userId) => {
    if (!(await verifyLectureOwnership(lectureId, userId)))
      return error("Lecture not found", 404);

    const body = await request.json();
    const sb = getSupabase();
    const { data } = await sb
      .from("captions")
      .update({ cleaned_text: body.text })
      .eq("id", captionId)
      .eq("lecture_id", lectureId)
      .select();
    if (!data?.length) return error("Caption not found", 404);

    await sb.from("lectures").update({ reviewed_at: null }).eq("id", lectureId);
    return json({ updated: true });
  });
}
