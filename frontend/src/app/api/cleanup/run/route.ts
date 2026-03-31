import { NextRequest, after } from "next/server";
import { json, error, withAuth, verifyLectureOwnership } from "@/lib/server/api-helpers";
import { runAiCleanup } from "@/lib/server/pipeline";
import { rateLimitByIp } from "@/lib/server/rate-limit";

export const maxDuration = 300;

export async function POST(request: NextRequest) {
  const rl = rateLimitByIp(request, "cleanup:run", 20);
  if (!rl.allowed) return error("Rate limit exceeded", 429);

  return withAuth(request, async (userId) => {
    const body = await request.json();
    const lectureId = body.lecture_id;
    if (!(await verifyLectureOwnership(lectureId, userId)))
      return error("Lecture not found", 404);

    after(async () => {
      await runAiCleanup(lectureId, body.mode ?? "clean", body.syllabus_context);
    });

    return json({ status: "cleanup_started", lecture_id: lectureId });
  });
}
