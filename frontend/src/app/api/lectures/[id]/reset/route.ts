import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth } from "@/lib/server/api-helpers";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, async (userId) => {
    const sb = getSupabase();
    const { data: lecture } = await sb
      .from("lectures")
      .select("status")
      .eq("id", id)
      .eq("user_id", userId);

    if (!lecture?.length) return error("Lecture not found", 404);

    const stuck = ["cleaning", "scoring", "transcribing"];
    if (!stuck.includes(lecture[0].status)) {
      return error("Lecture is not in a stuck state", 400);
    }

    const { data } = await sb
      .from("lectures")
      .update({
        status: "completed",
        progress_pct: 100,
        progress_message: "Reset by user",
      })
      .eq("id", id)
      .eq("user_id", userId)
      .select();

    if (!data?.length) return error("Failed to reset", 500);
    return json({ status: "completed", message: "Lecture reset successfully" });
  });
}
