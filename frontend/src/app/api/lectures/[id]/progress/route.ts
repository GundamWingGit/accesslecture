import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth } from "@/lib/server/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, async (userId) => {
    const sb = getSupabase();
    const { data } = await sb
      .from("lectures")
      .select("id, status, progress_pct, progress_message")
      .eq("id", id)
      .eq("user_id", userId);
    if (!data?.length) return error("Lecture not found", 404);
    const row = data[0];
    return json({
      lecture_id: row.id,
      status: row.status,
      progress_pct: row.progress_pct ?? 0,
      message: row.progress_message ?? "",
    });
  });
}
