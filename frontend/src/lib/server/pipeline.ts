import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { getSupabase } from "./supabase";
import { config } from "./config";
import {
  transcribe,
  detectVisualText,
  groupSlides,
  cleanupSegment,
} from "./gemini";
import { segmentsToCaptions, splitIntoCaptionChunks } from "./caption-formatter";
import {
  scoreCaptions,
  detectAllVisualReferences,
} from "./compliance-scorer";

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

// ---------------------------------------------------------------------------
// Main pipeline
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

    // 1. Download audio
    await updateLectureStatus(lectureId, LectureStatus.TRANSCRIBING, 5, "Downloading audio…");
    audioPath = await downloadFile(audioUrl);

    // 2. Transcribe
    await updateLectureStatus(lectureId, LectureStatus.TRANSCRIBING, 10, "Transcribing audio…");
    const { segments, info } = await transcribe(audioPath);

    const durationSeconds = info.durationSeconds;
    await sb.from("lectures").update({ duration_seconds: durationSeconds }).eq("id", lectureId);
    await updateLectureStatus(lectureId, LectureStatus.TRANSCRIBING, 45, "Transcription complete");

    // 3. Visual analysis (optional)
    let slideTexts: Array<{ startMs: number; endMs: number; texts: string[] }> = [];
    if (config.enableVideoOcr && videoUrl) {
      try {
        await updateLectureStatus(lectureId, LectureStatus.TRANSCRIBING, 50, "Detecting on-screen text…");
        videoPath = await downloadFile(videoUrl);
        const rawDetections = await detectVisualText(videoPath);
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

    // 4. Generate captions
    await updateLectureStatus(lectureId, LectureStatus.CLEANING, 60, "Generating captions…");
    const captions = segmentsToCaptions(segments);

    for (const cap of captions) {
      await sb.from("captions").insert({
        id: cap.id,
        lecture_id: lectureId,
        sequence: cap.sequence,
        start_ms: cap.startMs,
        end_ms: cap.endMs,
        original_text: cap.originalText,
        speaker: cap.speaker,
        min_confidence: cap.minConfidence,
      });
    }

    // 5. AI cleanup
    await updateLectureStatus(lectureId, LectureStatus.CLEANING, 70, "Running AI cleanup…");
    await runCleanupOnCaptions(lectureId, complianceMode);
    await updateLectureStatus(lectureId, LectureStatus.CLEANING, 85, "AI cleanup complete");

    // 6. Score accessibility
    await updateLectureStatus(lectureId, LectureStatus.SCORING, 90, "Scoring accessibility…");
    await runScoring(lectureId, durationSeconds);

    await updateLectureStatus(lectureId, LectureStatus.COMPLETED, 100, "Processing complete!");
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

async function runCleanupOnCaptions(lectureId: string, mode: string) {
  const sb = getSupabase();
  const { data: captions } = await sb
    .from("captions")
    .select("*")
    .eq("lecture_id", lectureId)
    .order("sequence");

  for (const cap of captions ?? []) {
    try {
      const cleaned = await cleanupSegment(
        cap.original_text,
        mode,
        cap.speaker
      );
      await sb.from("captions").update({ cleaned_text: cleaned }).eq("id", cap.id);
    } catch (e) {
      console.warn(`Cleanup failed for caption ${cap.id}:`, e);
      await sb.from("captions").update({ cleaned_text: cap.original_text }).eq("id", cap.id);
    }
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
  await updateLectureStatus(lectureId, LectureStatus.CLEANING, 50, "Running AI cleanup…");

  const sb = getSupabase();
  const { data: captions } = await sb
    .from("captions")
    .select("*")
    .eq("lecture_id", lectureId)
    .order("sequence");

  for (const cap of captions ?? []) {
    try {
      const cleaned = await cleanupSegment(
        cap.original_text,
        mode,
        cap.speaker,
        syllabusContext
      );
      await sb.from("captions").update({ cleaned_text: cleaned }).eq("id", cap.id);
    } catch (e) {
      console.warn(`Cleanup failed for caption ${cap.id}:`, e);
    }
  }

  await updateLectureStatus(lectureId, LectureStatus.COMPLETED, 100, "Cleanup complete");
}

export async function runFixAll(
  lectureId: string,
  mode = "clean",
  fixGrammar = true,
  fixFormatting = true,
  _fixSpeakers = true,
  syllabusContext?: string | null
) {
  await updateLectureStatus(lectureId, LectureStatus.CLEANING, 10, "Running Fix All…");

  if (fixGrammar) {
    await updateLectureStatus(lectureId, LectureStatus.CLEANING, 30, "Fixing grammar and filler…");
    await runCleanupOnCaptions(lectureId, mode);
  }

  if (fixFormatting) {
    await updateLectureStatus(lectureId, LectureStatus.CLEANING, 60, "Fixing formatting…");
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
