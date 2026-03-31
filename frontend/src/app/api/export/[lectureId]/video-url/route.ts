import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth } from "@/lib/server/api-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  const { lectureId } = await params;
  return withAuth(request, async (userId) => {
    const sb = getSupabase();
    const { data: lecture } = await sb
      .from("lectures")
      .select("video_url, audio_url")
      .eq("id", lectureId)
      .eq("user_id", userId);

    if (!lecture?.length) return error("Lecture not found", 404);

    const mediaUrl = lecture[0].video_url || lecture[0].audio_url;
    if (!mediaUrl) return error("No media file available", 404);

    return json({ url: mediaUrl });
  });
}
