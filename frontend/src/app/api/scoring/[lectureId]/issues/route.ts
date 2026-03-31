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
      .select("dimensions")
      .eq("lecture_id", lectureId)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!data?.length) return error("No scoring data found", 404);

    const issues: Array<Record<string, unknown>> = [];
    let counter = 0;
    for (const dim of data[0].dimensions ?? []) {
      for (const issueText of dim.issues ?? []) {
        counter++;
        issues.push({
          id: `issue-${counter}`,
          type: dim.id,
          severity: "warning",
          caption_id: null,
          message: issueText,
          suggestion: "",
          auto_fixable: ["formatting", "accuracy"].includes(dim.id),
        });
      }
    }
    return json(issues);
  });
}
