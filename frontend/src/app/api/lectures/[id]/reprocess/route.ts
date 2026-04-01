import { NextRequest } from "next/server";
import { after } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth } from "@/lib/server/api-helpers";
import { processLecturePipeline } from "@/lib/server/pipeline";
import { deleteTranscriptionWorkAudio } from "@/lib/server/pipeline-phase1";

/** Same as POST /api/lectures — full pipeline in `after()`. */
export const maxDuration = 800;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, async (userId) => {
    const sb = getSupabase();
    const { data: lecture } = await sb
      .from("lectures")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId);

    if (!lecture?.length) return error("Lecture not found", 404);

    await sb.from("captions").delete().eq("lecture_id", id);
    await sb.from("accessibility_scores").delete().eq("lecture_id", id);
    await sb.from("transcripts").delete().eq("lecture_id", id);

    await deleteTranscriptionWorkAudio(id).catch(() => {});

    await sb
      .from("lectures")
      .update({
        status: "uploaded",
        progress_pct: 0,
        progress_message: "",
        pipeline_checkpoint: null,
      })
      .eq("id", id);

    after(async () => {
      await processLecturePipeline(id);
    });

    return json({ status: "reprocessing", message: "Pipeline restarted" });
  });
}
