import { NextRequest } from "next/server";
import { after } from "next/server";
import { config } from "@/lib/server/config";
import { runPipelinePhase1Step } from "@/lib/server/pipeline-phase1";

/**
 * Continuation invocations for long-form transcription (chunk / gap-fill batches).
 * Each call gets a fresh serverless maxDuration budget.
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
    await runPipelinePhase1Step(lectureId);
  });

  return Response.json({ accepted: true }, { status: 202 });
}
