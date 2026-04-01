import { NextRequest } from "next/server";
import { after } from "next/server";
import { config } from "@/lib/server/config";
import { processLecturePipelineAfterTranscript } from "@/lib/server/pipeline";

/**
 * Phase 2 of lecture processing (captions + scoring). Invoked by phase 1 on Vercel so this
 * runs in a fresh serverless invocation (additional maxDuration budget vs one monolithic run).
 */
export const maxDuration = 800;

export async function POST(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!config.pipelineInternalSecret || auth !== `Bearer ${config.pipelineInternalSecret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: { lectureId?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("Bad request", { status: 400 });
  }

  const lectureId = body.lectureId;
  if (!lectureId) return new Response("Missing lectureId", { status: 400 });

  after(async () => {
    await processLecturePipelineAfterTranscript(lectureId);
  });

  return Response.json({ accepted: true }, { status: 202 });
}
