import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth } from "@/lib/server/api-helpers";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  return withAuth(request, async (_userId) => {
    const vocabulary = await request.json();
    const sb = getSupabase();
    const { data } = await sb
      .from("courses")
      .update({ vocabulary })
      .eq("id", courseId)
      .select();
    if (!data?.length) return error("Course not found", 404);
    return json({ updated: true });
  });
}
