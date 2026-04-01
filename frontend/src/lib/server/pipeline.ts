import { writeFile, unlink, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { getSupabase } from "./supabase";
import { config } from "./config";
import type { TranscriptSegment } from "./gemini";
import {
  transcribe,
  detectVisualText,
  detectVisualTextFromFrames,
  groupSlides,
  cleanupSegment,
} from "./gemini";
import { segmentsToCaptions, splitIntoCaptionChunks } from "./caption-formatter";
import {
  scoreCaptions,
  detectAllVisualReferences,
} from "./compliance-scorer";
import {
  extractAudioFromVideo,
  extractVideoSampleFrames,
  getAudioDurationSeconds,
  isVideoFile,
} from "./extract-audio";

const LectureStatus = {
  UPLOADING: "uploading",
  UPLOADED: "uploaded",
  TRANSCRIBING: "transcribing",
  CLEANING: "cleaning",
  SCORING: "scoring",
  COMPLETED: "completed",
  FAILED: "failed",
} as const;

function updateLectureStatus(
  lectureId: string,
  status: string,
  progressPct = 0,
  message = ""
) {
  const sb = getSupabase();
  return sb
    .from("lectures")
    .update({ status, progress_pct: progressPct, progress_message: message })
    .eq("id", lectureId)
    .then(() => {});
}

async function downloadFile(url: string): Promise<string> {
  let suffix = ".wav";
  for (const ext of [".mp3", ".m4a", ".mp4", ".webm", ".mov"]) {
    if (url.includes(ext)) {
      suffix = ext;
      break;
    }
  }

  const tmpPath = join(tmpdir(), `al-${randomUUID()}${suffix}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(tmpPath, buf);
  return tmpPath;
}

async function safeUnlink(...paths: (string | null | undefined)[]) {
  for (const p of paths) {
    if (p) {
      try { await unlink(p); } catch { /* ignore */ }
    }
  }
}

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

/**
 * Phase 2: captions + scoring + completed. Runs in a second Vercel invocation (fresh maxDuration).
 * Safe to call from resume if transcript exists and captions are missing.
 */
export async function processLecturePipelineAfterTranscript(lectureId: string) {
  try {
    const sb = getSupabase();
    const { data: lectureRows } = await sb
      .from("lectures")
      .select("*")
      .eq("id", lectureId);

    if (!lectureRows?.length) {
      console.error(`Lecture ${lectureId} not found (phase 2)`);
      return;
    }

    const lecture = lectureRows[0];
    const durationSeconds = lecture.duration_seconds ?? null;

    const { data: tr } = await sb
      .from("transcripts")
      .select("segments")
      .eq("lecture_id", lectureId)
      .maybeSingle();

    if (!tr?.segments) {
      await updateLectureStatus(
        lectureId,
        LectureStatus.FAILED,
        0,
        "No transcript found — cannot build captions."
      );
      return;
    }

    const segments = transcriptSegmentsFromDb(tr.segments);
    if (segments.length === 0) {
      await updateLectureStatus(
        lectureId,
        LectureStatus.FAILED,
        0,
        "Transcript is empty — cannot build captions."
      );
      return;
    }

    await sb.from("captions").delete().eq("lecture_id", lectureId);
    await sb.from("accessibility_scores").delete().eq("lecture_id", lectureId);

    await updateLectureStatus(lectureId, LectureStatus.CLEANING, 60, "Generating captions…");
    const captions = segmentsToCaptions(segments);

    const captionRows = captions.map((cap) => ({
      id: cap.id,
      lecture_id: lectureId,
      sequence: cap.sequence,
      start_ms: cap.startMs,
      end_ms: cap.endMs,
      original_text: cap.originalText,
      speaker: cap.speaker,
      min_confidence: cap.minConfidence,
    }));

    const BATCH = 50;
    for (let i = 0; i < captionRows.length; i += BATCH) {
      const { error: insertErr } = await sb.from("captions").insert(captionRows.slice(i, i + BATCH));
      if (insertErr) {
        console.error(`Caption batch insert error (batch ${i / BATCH}):`, insertErr.message);
        throw new Error(`Failed to insert captions: ${insertErr.message}`);
      }
    }

    await updateLectureStatus(lectureId, LectureStatus.CLEANING, 75, "Formatting captions…");
    for (let i = 0; i < captionRows.length; i += BATCH) {
      const batch = captionRows.slice(i, i + BATCH);
      await Promise.all(
        batch.map((cap) =>
          sb.from("captions").update({ cleaned_text: cap.original_text }).eq("id", cap.id)
        )
      );
    }
    await updateLectureStatus(lectureId, LectureStatus.CLEANING, 85, "Captions ready");

    await updateLectureStatus(lectureId, LectureStatus.SCORING, 90, "Scoring accessibility…");
    await runScoring(lectureId, durationSeconds);

    await updateLectureStatus(lectureId, LectureStatus.COMPLETED, 100, "Processing complete!");
  } catch (e) {
    console.error(`Pipeline phase 2 failed for lecture ${lectureId}:`, e);
    await updateLectureStatus(
      lectureId,
      LectureStatus.FAILED,
      0,
      String(e instanceof Error ? e.message : e).slice(0, 500)
    );
  }
}

/**
 * On Vercel, schedule phase 2 so it runs in a new serverless invocation (new 800s budget).
 * Locally, runs phase 2 in-process.
 */
async function schedulePipelineContinuation(lectureId: string) {
  if (process.env.VERCEL !== "1") {
    await processLecturePipelineAfterTranscript(lectureId);
    return;
  }

  const base =
    process.env.VERCEL_URL != null
      ? `https://${process.env.VERCEL_URL}`
      : process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");

  const secret = config.pipelineInternalSecret;
  if (!base || !secret) {
    console.error("[pipeline] Vercel: set VERCEL_URL (auto), NEXT_PUBLIC_APP_URL, and PIPELINE_INTERNAL_SECRET");
    await updateLectureStatus(
      lectureId,
      LectureStatus.FAILED,
      0,
      "Server configuration: set PIPELINE_INTERNAL_SECRET and NEXT_PUBLIC_APP_URL in Vercel (Project → Settings → Environment Variables)."
    );
    return;
  }

  const res = await fetch(`${base}/api/internal/pipeline-continue`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({ lectureId }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[pipeline] pipeline-continue:", res.status, text);
    await updateLectureStatus(
      lectureId,
      LectureStatus.FAILED,
      0,
      `Could not start caption step (${res.status}). Check logs or use Reprocess.`
    );
  }
}

// ---------------------------------------------------------------------------
// Main pipeline (phase 1: transcribe + optional OCR + store transcript; then phase 2)
// ---------------------------------------------------------------------------

export async function processLecturePipeline(lectureId: string) {
  let audioPath: string | null = null;
  let videoPath: string | null = null;

  try {
    const sb = getSupabase();
    const { data: lectureRows } = await sb
      .from("lectures")
      .select("*")
      .eq("id", lectureId);

    if (!lectureRows?.length) {
      console.error(`Lecture ${lectureId} not found`);
      return;
    }

    const lecture = lectureRows[0];
    const audioUrl: string = lecture.audio_url;
    const videoUrl: string | null = lecture.video_url;
    const complianceMode: string = lecture.compliance_mode ?? "clean";

    // 1. Download media file
    await updateLectureStatus(lectureId, LectureStatus.TRANSCRIBING, 5, "Downloading media…");
    audioPath = await downloadFile(audioUrl);

    // 2. Extract audio from video if needed (much smaller file for Gemini)
    let transcriptionPath = audioPath;
    let extractedAudioPath: string | null = null;
    if (isVideoFile(audioPath)) {
      await updateLectureStatus(lectureId, LectureStatus.TRANSCRIBING, 8, "Extracting audio track…");
      extractedAudioPath = await extractAudioFromVideo(audioPath);
      transcriptionPath = extractedAudioPath;
    }

    // 3. Transcribe (per-chunk progress keeps DB fresh for UI + resets stall timer on Vercel)
    await updateLectureStatus(lectureId, LectureStatus.TRANSCRIBING, 10, "Transcribing audio…");
    const { segments, info } = await transcribe(transcriptionPath, {
      onProgress: async (p) => {
        const pct =
          p.phase === "chunk"
            ? 10 + Math.round((34 * p.current) / Math.max(1, p.total))
            : 44 + Math.min(1, Math.round(p.current / Math.max(1, p.total)));
        await updateLectureStatus(
          lectureId,
          LectureStatus.TRANSCRIBING,
          Math.min(45, pct),
          p.message
        );
      },
    });

    if (extractedAudioPath) await safeUnlink(extractedAudioPath);

    const durationSeconds = info.durationSeconds;
    await sb.from("lectures").update({ duration_seconds: durationSeconds }).eq("id", lectureId);
    await updateLectureStatus(lectureId, LectureStatus.TRANSCRIBING, 45, "Transcription complete");

    // 3. Visual analysis (optional) — full-video Gemini calls often stall on 30+ min files; use sampled frames.
    let slideTexts: Array<{ startMs: number; endMs: number; texts: string[] }> = [];
    if (config.enableVideoOcr && videoUrl) {
      try {
        await updateLectureStatus(lectureId, LectureStatus.TRANSCRIBING, 50, "Detecting on-screen text…");
        videoPath = await downloadFile(videoUrl);
        let dur = durationSeconds ?? 0;
        if (dur <= 0) {
          dur = await getAudioDurationSeconds(videoPath);
        }
        const useSampledFrames = dur > config.visualFullVideoMaxSeconds;

        const rawDetections = await withTimeout(
          useSampledFrames
            ? (async () => {
                const { paths, dir } = await extractVideoSampleFrames(
                  videoPath,
                  dur,
                  config.visualSampleFrameCount
                );
                try {
                  return await detectVisualTextFromFrames(paths, dur);
                } finally {
                  await rm(dir, { recursive: true, force: true }).catch(() => {});
                }
              })()
            : detectVisualText(videoPath),
          config.visualAnalysisTimeoutMs
        );
        slideTexts = groupSlides(rawDetections);
      } catch (e) {
        console.warn("Video analysis failed (non-fatal):", e);
      }
    }

    // Store transcript
    const rawText = segments.map((s) => s.text).join(" ");
    const segmentsForDb = segments.map((s) => ({
      id: s.id,
      start_ms: s.startMs,
      end_ms: s.endMs,
      text: s.text,
      speaker: s.speaker,
      words: s.words.map((w) => ({
        word: w.word,
        start_ms: w.startMs,
        end_ms: w.endMs,
        speaker: w.speaker,
        confidence: w.confidence,
      })),
    }));

    await sb.from("transcripts").upsert(
      {
        lecture_id: lectureId,
        segments: segmentsForDb,
        raw_text: rawText,
        speaker_map: {},
        slide_texts: slideTexts,
      },
      { onConflict: "lecture_id" }
    );

    await updateLectureStatus(
      lectureId,
      LectureStatus.TRANSCRIBING,
      48,
      "Saving transcript… starting caption step…"
    );

    await schedulePipelineContinuation(lectureId);
  } catch (e) {
    console.error(`Pipeline failed for lecture ${lectureId}:`, e);
    await updateLectureStatus(
      lectureId,
      LectureStatus.FAILED,
      0,
      String(e instanceof Error ? e.message : e).slice(0, 500)
    );
  } finally {
    await safeUnlink(audioPath, videoPath);
  }
}

// ---------------------------------------------------------------------------
// Reusable sub-steps
// ---------------------------------------------------------------------------

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function runCleanupOnCaptions(
  lectureId: string,
  mode: string,
  onProgress?: (done: number, total: number) => Promise<void>,
  syllabusContext?: string | null
) {
  const sb = getSupabase();
  const { data: captions } = await sb
    .from("captions")
    .select("*")
    .eq("lecture_id", lectureId)
    .order("sequence");

  const total = captions?.length ?? 0;
  for (let i = 0; i < total; i++) {
    const cap = captions![i];
    try {
      const cleaned = await withTimeout(
        cleanupSegment(cap.original_text, mode, cap.speaker, syllabusContext),
        30_000
      );
      await sb.from("captions").update({ cleaned_text: cleaned }).eq("id", cap.id);
    } catch (e) {
      console.warn(`Cleanup failed for caption ${cap.id}:`, e);
      await sb.from("captions").update({ cleaned_text: cap.original_text }).eq("id", cap.id);
    }
    if (onProgress) await onProgress(i + 1, total);
  }
}

async function runScoring(lectureId: string, durationSeconds?: number | null) {
  const sb = getSupabase();
  const { data: captions } = await sb
    .from("captions")
    .select("*")
    .eq("lecture_id", lectureId)
    .order("sequence");

  const score = scoreCaptions(captions ?? [], durationSeconds);
  const visualRefs = detectAllVisualReferences(captions ?? []);

  await sb.from("accessibility_scores").insert({
    lecture_id: lectureId,
    overall: score.overall,
    rating: score.rating,
    dimensions: score.dimensions,
    visual_references: visualRefs,
  });
}

function fixCaptionFormatting(lectureId: string) {
  return (async () => {
    const sb = getSupabase();
    const { data: captions } = await sb
      .from("captions")
      .select("*")
      .eq("lecture_id", lectureId)
      .order("sequence");

    for (const cap of captions ?? []) {
      const text = cap.cleaned_text || cap.original_text;
      const lines = text.split("\n");
      const needsFix =
        lines.some((l: string) => l.length > config.maxCaptionLineLength) ||
        lines.length > config.maxCaptionLines;

      if (needsFix) {
        const chunks = splitIntoCaptionChunks(text.replace(/\n/g, " "));
        if (chunks.length) {
          await sb.from("captions").update({ cleaned_text: chunks[0] }).eq("id", cap.id);
        }
      }
    }
  })();
}

// ---------------------------------------------------------------------------
// Standalone operations (called from API routes)
// ---------------------------------------------------------------------------

export async function runAiCleanup(
  lectureId: string,
  mode = "clean",
  syllabusContext?: string | null
) {
  try {
    await updateLectureStatus(lectureId, LectureStatus.CLEANING, 10, "Running AI cleanup…");

    const sb = getSupabase();
    const { data: captions } = await sb
      .from("captions")
      .select("*")
      .eq("lecture_id", lectureId)
      .order("sequence");

    const total = captions?.length ?? 0;
    for (let i = 0; i < total; i++) {
      const cap = captions![i];
      try {
        const cleaned = await withTimeout(
          cleanupSegment(cap.original_text, mode, cap.speaker, syllabusContext),
          30_000
        );
        await sb.from("captions").update({ cleaned_text: cleaned }).eq("id", cap.id);
      } catch (e) {
        console.warn(`Cleanup failed for caption ${cap.id}:`, e);
        await sb.from("captions").update({ cleaned_text: cap.original_text }).eq("id", cap.id);
      }
      const pct = Math.round(10 + ((i + 1) / total) * 80);
      await updateLectureStatus(lectureId, LectureStatus.CLEANING, pct, `Cleaning caption ${i + 1} of ${total}…`);
    }

    await updateLectureStatus(lectureId, LectureStatus.COMPLETED, 100, "Cleanup complete");
  } catch (e) {
    console.error(`runAiCleanup failed for ${lectureId}:`, e);
    await updateLectureStatus(
      lectureId,
      LectureStatus.FAILED,
      0,
      String(e instanceof Error ? e.message : e).slice(0, 500)
    );
  }
}

export async function runFixAll(
  lectureId: string,
  mode = "clean",
  fixGrammar = true,
  fixFormatting = true,
  _fixSpeakers = true,
  syllabusContext?: string | null
) {
  try {
    await updateLectureStatus(lectureId, LectureStatus.CLEANING, 10, "Running Fix All…");

    if (fixGrammar) {
      await updateLectureStatus(lectureId, LectureStatus.CLEANING, 15, "Fixing grammar and filler…");
      await runCleanupOnCaptions(
        lectureId,
        mode,
        async (done, total) => {
          const pct = Math.round(15 + (done / total) * 45);
          await updateLectureStatus(lectureId, LectureStatus.CLEANING, pct, `Cleaning caption ${done} of ${total}…`);
        },
        syllabusContext
      );
    }

    if (fixFormatting) {
      await updateLectureStatus(lectureId, LectureStatus.CLEANING, 65, "Fixing formatting…");
      await fixCaptionFormatting(lectureId);
    }

    await updateLectureStatus(lectureId, LectureStatus.SCORING, 80, "Re-scoring…");
    const sb = getSupabase();
    const { data: lectureRows } = await sb
      .from("lectures")
      .select("duration_seconds")
      .eq("id", lectureId);
    const duration = lectureRows?.[0]?.duration_seconds ?? null;
    await runScoring(lectureId, duration);

    await updateLectureStatus(lectureId, LectureStatus.COMPLETED, 100, "Fix All complete!");
  } catch (e) {
    console.error(`runFixAll failed for ${lectureId}:`, e);
    await updateLectureStatus(
      lectureId,
      LectureStatus.FAILED,
      0,
      String(e instanceof Error ? e.message : e).slice(0, 500)
    );
  }
}

export async function runAccessibilityScoring(lectureId: string) {
  const sb = getSupabase();
  const { data: lectureRows } = await sb
    .from("lectures")
    .select("duration_seconds")
    .eq("id", lectureId);
  const duration = lectureRows?.[0]?.duration_seconds ?? null;
  await runScoring(lectureId, duration);
}
