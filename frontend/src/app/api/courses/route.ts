import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth } from "@/lib/server/api-helpers";

export async function POST(request: NextRequest) {
  return withAuth(request, async (_userId) => {
    const body = await request.json();
    const sb = getSupabase();
    const { data, error: dbErr } = await sb
      .from("courses")
      .insert({
        name: body.name,
        syllabus_text: body.syllabus_text ?? null,
        vocabulary: body.vocabulary ?? [],
      })
      .select();
    if (dbErr || !data?.length) return error("Failed to create course", 500);
    return json(data[0], 201);
  });
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (_userId) => {
    const sb = getSupabase();
    const { data } = await sb
      .from("courses")
      .select("*")
      .order("created_at", { ascending: false });
    return json(data ?? []);
  });
}
