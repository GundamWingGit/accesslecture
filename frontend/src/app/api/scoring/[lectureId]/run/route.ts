import { NextRequest, after } from "next/server";
import { json, error, withAuth, verifyLectureOwnership } from "@/lib/server/api-helpers";
import { runAccessibilityScoring } from "@/lib/server/pipeline";
import { rateLimitByIp } from "@/lib/server/rate-limit";

export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ lectureId: string }> }
) {
  const { lectureId } = await params;
  const rl = rateLimitByIp(request, "scoring:run", 20);
  if (!rl.allowed) return error("Rate limit exceeded", 429);

  return withAuth(request, async (userId) => {
    if (!(await verifyLectureOwnership(lectureId, userId)))
      return error("Lecture not found", 404);

    after(async () => {
      await runAccessibilityScoring(lectureId);
    });

    return json({ status: "scoring_started", lecture_id: lectureId });
  });
}
