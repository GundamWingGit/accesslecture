import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth, verifyLectureOwnership } from "@/lib/server/api-helpers";
import { toVtt, toSrt, toTxt } from "@/lib/server/caption-formatter";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  const { lectureId } = await params;
  return withAuth(request, async (userId) => {
    if (!(await verifyLectureOwnership(lectureId, userId)))
      return error("Lecture not found", 404);

    const body = await request.json();
    const sb = getSupabase();
    const { data: captions } = await sb
      .from("captions")
      .select("*")
      .eq("lecture_id", lectureId)
      .order("sequence");
    if (!captions?.length) return error("No captions found", 404);

    const { data: lecture } = await sb
      .from("lectures")
      .select("title")
      .eq("id", lectureId);
    const title = lecture?.[0]?.title ?? "lecture";

    const useCleaned = body.use_cleaned ?? true;
    const exports: Record<string, unknown> = {};
    for (const fmt of body.formats ?? ["vtt", "srt", "txt"]) {
      if (fmt === "vtt") exports.vtt = toVtt(captions, useCleaned);
      else if (fmt === "srt") exports.srt = toSrt(captions, useCleaned);
      else if (fmt === "txt") exports.txt = toTxt(captions, useCleaned);
      else if (fmt === "json") exports.json = captions;
    }

    return json({ title, exports });
  });
}
