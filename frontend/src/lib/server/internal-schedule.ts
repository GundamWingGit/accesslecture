import { config } from "./config";
import { updateLectureStatus } from "./lecture-status";

/**
 * Phase 2 (captions + scoring). On Vercel, runs in a new serverless invocation.
 * Dynamic import avoids a static cycle with pipeline.ts.
 */
export async function schedulePipelineContinuation(lectureId: string) {
  if (process.env.VERCEL !== "1") {
    const { processLecturePipelineAfterTranscript } = await import("./pipeline");
    await processLecturePipelineAfterTranscript(lectureId);
    return;
  }

  const base =
    process.env.VERCEL_URL != null
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  const secret = config.pipelineInternalSecret;
  if (!base || !secret) {
    console.error("[pipeline] Vercel: set VERCEL_URL (auto), NEXT_PUBLIC_APP_URL, and PIPELINE_INTERNAL_SECRET");
    await updateLectureStatus(
      lectureId,
      "failed",
      0,
      "Server configuration: set PIPELINE_INTERNAL_SECRET and NEXT_PUBLIC_APP_URL in Vercel (Project → Settings → Environment Variables)."
    );
    return;
  }

  const res = await fetch(`${base}/api/internal/pipeline-continue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ lectureId }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[pipeline] pipeline-continue:", res.status, text);
    await updateLectureStatus(
      lectureId,
      "failed",
      0,
      `Could not start caption step (${res.status}). Check logs or use Reprocess.`
    );
  }
}

/**
 * Multi-invocation phase 1 (long transcription). Dynamic import avoids a static cycle with pipeline-phase1.ts.
 */
export async function schedulePhase1Continuation(lectureId: string) {
  if (process.env.VERCEL !== "1") {
    const { runPipelinePhase1Step } = await import("./pipeline-phase1");
    await runPipelinePhase1Step(lectureId);
    return;
  }

  const base =
    process.env.VERCEL_URL != null
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  const secret = config.pipelineInternalSecret;
  if (!base || !secret) {
    console.error("[pipeline-phase1] Missing VERCEL_URL / NEXT_PUBLIC_APP_URL / PIPELINE_INTERNAL_SECRET");
    await updateLectureStatus(
      lectureId,
      "failed",
      0,
      "Server configuration: set PIPELINE_INTERNAL_SECRET and NEXT_PUBLIC_APP_URL."
    );
    return;
  }

  const res = await fetch(`${base}/api/internal/pipeline-phase1-continue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ lectureId }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[pipeline-phase1] continue failed:", res.status, text);
    await updateLectureStatus(
      lectureId,
      "failed",
      0,
      `Transcription step could not continue (${res.status}). Reprocess the lecture.`
    );
  }
}
