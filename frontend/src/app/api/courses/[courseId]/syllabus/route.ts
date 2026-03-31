import { NextRequest } from "next/server";
import { getSupabase } from "@/lib/server/supabase";
import { json, error, withAuth } from "@/lib/server/api-helpers";
import { extractVocabulary } from "@/lib/server/gemini";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ courseId: string }> }
) {
  const { courseId } = await params;
  return withAuth(request, async (_userId) => {
    const syllabusText: string = await request.json();
    const vocab = await extractVocabulary(syllabusText);
    const sb = getSupabase();
    const { data } = await sb
      .from("courses")
      .update({ syllabus_text: syllabusText, vocabulary: vocab })
      .eq("id", courseId)
      .select();
    if (!data?.length) return error("Course not found", 404);
    return json({ updated: true, vocabulary_extracted: vocab.length });
  });
}
