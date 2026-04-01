import { NextRequest } from "next/server";
import { after } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth } from "@/lib/server/api-helpers";
import { processLecturePipelineAfterTranscript } from "@/lib/server/pipeline";
import { runPipelinePhase1Step } from "@/lib/server/pipeline-phase1";

/**
 * If long-form transcription stalled (checkpoint present), resumes phase 1.
 * If transcription finished but phase 2 never ran (misconfig, network), resumes captions + scoring.
 */
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
      .select("id, pipeline_checkpoint")
      .eq("id", id)
      .eq("user_id", userId)
      .maybeSingle();

    if (!lecture) return error("Lecture not found", 404);

    const cp = lecture.pipeline_checkpoint as { workAudioUrl?: string } | null | undefined;
    if (cp?.workAudioUrl) {
      after(async () => {
        await runPipelinePhase1Step(id);
      });
      return json({
        status: "resume_started",
        message: "Long-form transcription resumed",
      });
    }

    const { data: tr } = await sb.from("transcripts").select("id").eq("lecture_id", id).maybeSingle();
    if (!tr) return error("No transcript found — upload or reprocess first.", 400);

    const { count } = await sb
      .from("captions")
      .select("*", { count: "exact", head: true })
      .eq("lecture_id", id);

    if (count && count > 0) {
      return error("Captions already exist — nothing to resume.", 400);
    }

    after(async () => {
      await processLecturePipelineAfterTranscript(id);
    });

    return json({ status: "resume_started", message: "Caption step started" });
  });
}
