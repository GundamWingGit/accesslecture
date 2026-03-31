import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { error, withTokenAuth } from "@/lib/server/api-helpers";
import { toTxt } from "@/lib/server/caption-formatter";
import { createCanvasPackage } from "@/lib/server/lms-export";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  const { lectureId } = await params;
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token") ?? "";
  const cleaned = searchParams.get("cleaned") !== "false";

  return withTokenAuth(token, async (userId) => {
    const sb = getSupabase();
    const { data: lectureData } = await sb.from("lectures").select("title").eq("id", lectureId).eq("user_id", userId);
    if (!lectureData?.length) return error("Lecture not found", 404);
    const title = lectureData[0].title;

    const { data: captions } = await sb.from("captions").select("*").eq("lecture_id", lectureId).order("sequence");
    if (!captions?.length) return error("No captions found", 404);

    const transcript = toTxt(captions, cleaned);

    const { data: scoreRows } = await sb
      .from("accessibility_scores")
      .select("overall, rating, dimensions")
      .eq("lecture_id", lectureId)
      .order("created_at", { ascending: false })
      .limit(1);
    const scoreData = scoreRows?.[0] ?? null;

    const zipBytes = await createCanvasPackage(title, captions, transcript, scoreData, cleaned);
    const safeTitle = title.replace(/[^a-zA-Z0-9 _-]/g, "").trim();

    return new NextResponse(new Uint8Array(zipBytes), {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${safeTitle}_canvas_package.zip"`,
      },
    });
  });
}
