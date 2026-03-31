import { NextRequest } from "next/server";
import { after } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { config } from "@/lib/server/config";
import { json, error, withAuth } from "@/lib/server/api-helpers";
import { processLecturePipeline } from "@/lib/server/pipeline";
import { rateLimitByIp } from "@/lib/server/rate-limit";

export const maxDuration = 300;

function checkPlanLimits(userId: string) {
  return (async () => {
    const sb = getSupabase();
    let { data } = await sb.from("user_profiles").select("*").eq("id", userId);

    if (!data?.length) {
      await sb.from("user_profiles").insert({ id: userId });
      const r = await sb.from("user_profiles").select("*").eq("id", userId);
      data = r.data;
    }

    const profile = data![0];
    if (["pro", "institution"].includes(profile.plan)) return;

    const monthReset = profile.month_reset_at;
    const now = new Date();
    if (monthReset) {
      const resetDt = new Date(monthReset);
      if (now.getTime() - resetDt.getTime() >= 30 * 86400_000) {
        await sb
          .from("user_profiles")
          .update({ lectures_this_month: 0, month_reset_at: now.toISOString() })
          .eq("id", userId);
        return;
      }
    }

    const count = profile.lectures_this_month ?? 0;
    if (count >= config.freeLecturesPerMonth) {
      throw new PlanLimitError(
        `Free plan limit reached (${config.freeLecturesPerMonth} lectures/month). Upgrade to Pro for unlimited uploads.`
      );
    }
  })();
}

class PlanLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export async function POST(request: NextRequest) {
  const rl = rateLimitByIp(request, "lectures:create", 10);
  if (!rl.allowed) return error("Rate limit exceeded", 429);

  return withAuth(request, async (userId) => {
    try {
      await checkPlanLimits(userId);
    } catch (e) {
      if (e instanceof PlanLimitError) return error(e.message, 403);
      throw e;
    }

    const body = await request.json();
    const sb = getSupabase();

    const { data: rows, error: dbErr } = await sb.from("lectures").insert({
      title: body.title,
      audio_url: body.audio_url,
      video_url: body.video_url ?? null,
      status: "uploaded",
      compliance_mode: body.compliance_mode ?? "clean",
      course_id: body.course_id ?? null,
      user_id: userId,
    }).select();

    if (dbErr || !rows?.length) return error("Failed to create lecture record", 500);
    const row = rows[0];

    await sb
      .from("user_profiles")
      .select("lectures_this_month")
      .eq("id", userId)
      .then(async (r) => {
        const count = r.data?.[0]?.lectures_this_month ?? 0;
        await sb
          .from("user_profiles")
          .update({ lectures_this_month: count + 1 })
          .eq("id", userId);
      });

    after(async () => {
      await processLecturePipeline(row.id);
    });

    return json(row, 201);
  });
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    const sb = getSupabase();
    const { data } = await sb
      .from("lectures")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    return json(data ?? []);
  });
}
