import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth } from "@/lib/server/api-helpers";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  return withAuth(request, async (_userId) => {
    const sb = getSupabase();
    const { data } = await sb.from("courses").select("*").eq("id", courseId);
    if (!data?.length) return error("Course not found", 404);
    return json(data[0]);
  });
}
