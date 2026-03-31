import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, withAuth } from "@/lib/server/api-helpers";

async function ensureProfile(userId: string) {
  const sb = getSupabase();
  const { data } = await sb.from("user_profiles").select("*").eq("id", userId);
  if (data?.length) return data[0];
  await sb.from("user_profiles").insert({ id: userId });
  const r = await sb.from("user_profiles").select("*").eq("id", userId);
  return r.data![0];
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (userId) => {
    const profile = await ensureProfile(userId);
    return json({
      plan: profile.plan ?? "free",
      subscription_status: profile.subscription_status ?? "free",
      current_period_end: profile.current_period_end ?? null,
      lectures_this_month: profile.lectures_this_month ?? 0,
    });
  });
}
