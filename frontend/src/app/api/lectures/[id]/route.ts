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
      .select("*")
      .eq("id", id)
      .eq("user_id", userId);
    if (!data?.length) return error("Lecture not found", 404);
    return json(data[0]);
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return withAuth(request, async (userId) => {
    const sb = getSupabase();
    const { data: check } = await sb
      .from("lectures")
      .select("id")
      .eq("id", id)
      .eq("user_id", userId);
    if (!check?.length) return error("Lecture not found", 404);

    await sb.from("captions").delete().eq("lecture_id", id);
    await sb.from("transcripts").delete().eq("lecture_id", id);
    await sb.from("accessibility_scores").delete().eq("lecture_id", id);
    await sb.from("lectures").delete().eq("id", id);
    return json({ deleted: true });
  });
}
