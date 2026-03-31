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
    const { data } = await sb
      .from("lectures")
      .update({ reviewed_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select();
    if (!data?.length) return error("Lecture not found", 404);
    return json({ reviewed_at: data[0].reviewed_at });
  });
}
