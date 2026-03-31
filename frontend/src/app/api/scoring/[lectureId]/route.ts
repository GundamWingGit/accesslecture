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
      .from("accessibility_scores")
      .select("*")
      .eq("lecture_id", lectureId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!data?.length) return error("Score not found. Run scoring first.", 404);
    const row = data[0];
    return json({
      overall: row.overall,
      rating: row.rating,
      dimensions: row.dimensions ?? [],
    });
  });
}
