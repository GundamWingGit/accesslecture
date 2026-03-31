import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { error, withTokenAuth } from "@/lib/server/api-helpers";
import { toTxt } from "@/lib/server/caption-formatter";

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
    const { data: check } = await sb.from("lectures").select("id").eq("id", lectureId).eq("user_id", userId);
    if (!check?.length) return error("Lecture not found", 404);

    const { data } = await sb.from("captions").select("*").eq("lecture_id", lectureId).order("sequence");
    if (!data?.length) return error("No captions found", 404);

    return new NextResponse(toTxt(data, cleaned), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  });
}
