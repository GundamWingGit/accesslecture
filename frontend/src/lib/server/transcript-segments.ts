import type { TranscriptSegment } from "./gemini";

/** Rebuild typed segments from transcripts.segments JSON (Supabase snake_case). */
export function transcriptSegmentsFromDb(segments: unknown): TranscriptSegment[] {
  if (!Array.isArray(segments)) return [];
  return segments.map((s: Record<string, unknown>) => ({
    id: String(s.id ?? ""),
    startMs: Number(s.start_ms ?? 0),
    endMs: Number(s.end_ms ?? 0),
    text: String(s.text ?? ""),
    speaker: (s.speaker as string | null) ?? null,
    words: Array.isArray(s.words)
      ? s.words.map((w: Record<string, unknown>) => ({
          word: String(w.word ?? ""),
          startMs: Number(w.start_ms ?? 0),
          endMs: Number(w.end_ms ?? 0),
          speaker: (w.speaker as string | null) ?? null,
          confidence: Number(w.confidence ?? 0.92),
        }))
      : [],
  }));
}
