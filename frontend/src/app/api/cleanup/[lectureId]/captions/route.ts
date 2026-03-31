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
      .from("captions")
      .select("*")
      .eq("lecture_id", lectureId)
      .order("sequence");
    if (!data?.length) return error("Captions not found", 404);

    const { data: lecture } = await sb
      .from("lectures")
      .select("compliance_mode")
      .eq("id", lectureId);
    const mode = lecture?.[0]?.compliance_mode ?? "clean";

    return json({ lecture_id: lectureId, captions: data, compliance_mode: mode });
  });
}
