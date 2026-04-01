import { readFile, unlink } from "fs/promises";
import { rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { getSupabase } from "./supabase";
import { config } from "./config";
import {
  transcribe,
  transcribeMainChunkBatch,
  fillTranscriptionGapsBatch,
  detectVisualTextFromFrames,
  groupSlides,
  type TranscribeMainChunkState,
  type GapFillSliceCheckpoint,
} from "./gemini";
import {
  extractVideoSampleFrames,
  getAudioDurationSeconds,
} from "./extract-audio";
import { updateLectureStatus } from "./lecture-status";
import { transcriptSegmentsFromDb } from "./transcript-segments";
import {
  schedulePhase1Continuation,
  schedulePipelineContinuation,
} from "./internal-schedule";

const LectureStatus = {
  TRANSCRIBING: "transcribing",
} as const;

/** Stored in lectures.pipeline_checkpoint (jsonb) for multi-invocation transcription (3+ hour files). */
export type Phase1Checkpoint = {
  stage: "chunks" | "gap_fill" | "ocr" | "finalize";
  workAudioUrl: string;
  durationSec: number;
  chunkState: TranscribeMainChunkState | null;
  gapCheckpoint: GapFillSliceCheckpoint | null;
};

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

export async function uploadTranscriptionWorkAudio(
  lectureId: string,
  localPath: string
): Promise<string> {
  const sb = getSupabase();
  const storagePath = `lectures/${lectureId}/transcribe-work.mp3`;
  const buf = await readFile(localPath);
  const { error } = await sb.storage.from("audio").upload(storagePath, buf, {
    contentType: "audio/mpeg",
    upsert: true,
  });
  if (error) throw new Error(`Work audio upload failed: ${error.message}`);
  const { data } = sb.storage.from("audio").getPublicUrl(storagePath);
  return data.publicUrl;
}

export async function deleteTranscriptionWorkAudio(lectureId: string): Promise<void> {
  const sb = getSupabase();
  const storagePath = `lectures/${lectureId}/transcribe-work.mp3`;
  await sb.storage.from("audio").remove([storagePath]).catch(() => {});
}

async function downloadToTemp(url: string, timeoutMs: number): Promise<string> {
  const tmpPath = join(tmpdir(), `al-work-${randomUUID()}.mp3`);
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const { writeFile } = await import("fs/promises");
  await writeFile(tmpPath, buf);
  return tmpPath;
}

function segmentsToDbRows(segments: import("./gemini").TranscriptSegment[]) {
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
  return { rawText, segmentsForDb };
}

async function upsertTranscriptPartial(
  lectureId: string,
  segments: import("./gemini").TranscriptSegment[],
  slideTexts: Array<{ startMs: number; endMs: number; texts: string[] }> = []
) {
  const sb = getSupabase();
  const { rawText, segmentsForDb } = segmentsToDbRows(segments);
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
}

/**
 * One unit of work for phase 1: chunk batch, gap batch, OCR, or finalize.
 * Safe to chain many invocations on Vercel for very long media.
 */
export async function runPipelinePhase1Step(lectureId: string): Promise<void> {
  const sb = getSupabase();
  const { data: rows, error: lecErr } = await sb
    .from("lectures")
    .select("*")
    .eq("id", lectureId)
    .maybeSingle();

  if (lecErr || !rows) {
    console.error("runPipelinePhase1Step: lecture not found", lectureId);
    return;
  }

  const lecture = rows as Record<string, unknown> & {
    video_url?: string | null;
    pipeline_checkpoint?: Phase1Checkpoint | null;
  };

  const cp = lecture.pipeline_checkpoint as Phase1Checkpoint | null | undefined;
  if (!cp?.workAudioUrl || !cp.durationSec) {
    console.error("runPipelinePhase1Step: missing pipeline_checkpoint", lectureId);
    await updateLectureStatus(
      lectureId,
      "failed",
      0,
      "Processing checkpoint missing — reprocess the lecture."
    );
    return;
  }

  let workPath: string | null = null;
  let videoPath: string | null = null;

  try {
    workPath = await downloadToTemp(cp.workAudioUrl, config.visualVideoDownloadTimeoutMs);

    if (cp.stage === "chunks") {
      const r = await transcribeMainChunkBatch(
        workPath,
        cp.durationSec,
        cp.chunkState,
        {
          maxChunksPerInvocation: config.transcribeChunksPerInvocation,
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
        }
      );

      await upsertTranscriptPartial(lectureId, r.merged, []);

      const nextCp: Phase1Checkpoint = r.done
        ? {
            ...cp,
            stage: "gap_fill",
            chunkState: null,
            gapCheckpoint: null,
          }
        : {
            ...cp,
            stage: "chunks",
            chunkState: r.state,
          };

      await sb
        .from("lectures")
        .update({
          pipeline_checkpoint: nextCp as unknown as Record<string, unknown>,
          duration_seconds: cp.durationSec,
        })
        .eq("id", lectureId);

      if (!r.done) {
        await schedulePhase1Continuation(lectureId);
        return;
      }
    }

    const { data: refreshed } = await sb
      .from("lectures")
      .select("pipeline_checkpoint, video_url")
      .eq("id", lectureId)
      .maybeSingle();

    let cp2 = (refreshed?.pipeline_checkpoint ?? cp) as Phase1Checkpoint;

    if (cp2.stage === "gap_fill") {
      const { data: tr } = await sb
        .from("transcripts")
        .select("segments")
        .eq("lecture_id", lectureId)
        .maybeSingle();

      const segments = transcriptSegmentsFromDb(tr?.segments);
      const g = await fillTranscriptionGapsBatch(
        workPath,
        cp2.durationSec,
        segments,
        cp2.gapCheckpoint,
        {
          onProgress: async (p) => {
            const pct =
              44 + Math.min(1, Math.round(p.current / Math.max(1, p.total)));
            await updateLectureStatus(
              lectureId,
              LectureStatus.TRANSCRIBING,
              Math.min(45, pct),
              p.message
            );
          },
        }
      );

      await upsertTranscriptPartial(lectureId, g.segments, []);

      cp2 = {
        ...cp2,
        stage: g.done ? "ocr" : "gap_fill",
        gapCheckpoint: g.checkpoint,
      };

      await sb
        .from("lectures")
        .update({ pipeline_checkpoint: cp2 as unknown as Record<string, unknown> })
        .eq("id", lectureId);

      if (!g.done) {
        await schedulePhase1Continuation(lectureId);
        return;
      }
    }

    const { data: refreshed2 } = await sb
      .from("lectures")
      .select("pipeline_checkpoint, video_url")
      .eq("id", lectureId)
      .maybeSingle();

    cp2 = (refreshed2?.pipeline_checkpoint ?? cp2) as Phase1Checkpoint;

    const videoUrl = (refreshed2?.video_url as string | null) ?? lecture.video_url;

    if (cp2.stage === "ocr") {
      if (config.enableVideoOcr && videoUrl) {
        try {
          await updateLectureStatus(
            lectureId,
            LectureStatus.TRANSCRIBING,
            49,
            "Downloading video for slide detection…"
          );
          videoPath = await downloadToTemp(videoUrl, config.visualVideoDownloadTimeoutMs);
          let dur = cp2.durationSec;
          if (dur <= 0) {
            dur = await getAudioDurationSeconds(videoPath);
          }

          await updateLectureStatus(
            lectureId,
            LectureStatus.TRANSCRIBING,
            49,
            "Extracting sample frames…"
          );

          const rawDetections = await withTimeout(
            (async () => {
              const { paths, dir } = await extractVideoSampleFrames(
                videoPath,
                dur,
                config.visualSampleFrameCount
              );
              try {
                await updateLectureStatus(
                  lectureId,
                  LectureStatus.TRANSCRIBING,
                  50,
                  "Detecting on-screen text…"
                );
                return await detectVisualTextFromFrames(paths, dur);
              } finally {
                await rm(dir, { recursive: true, force: true }).catch(() => {});
              }
            })(),
            config.visualAnalysisTimeoutMs
          );
          const slideTexts = groupSlides(rawDetections);
          await sb
            .from("transcripts")
            .update({ slide_texts: slideTexts })
            .eq("lecture_id", lectureId);
        } catch (e) {
          console.warn("Video analysis failed (non-fatal):", e);
        }
      }

      cp2 = { ...cp2, stage: "finalize" };
      await sb
        .from("lectures")
        .update({ pipeline_checkpoint: cp2 as unknown as Record<string, unknown> })
        .eq("id", lectureId);
    }

    const { data: refreshed3 } = await sb
      .from("lectures")
      .select("pipeline_checkpoint")
      .eq("id", lectureId)
      .maybeSingle();

    cp2 = (refreshed3?.pipeline_checkpoint ?? cp2) as Phase1Checkpoint;

    if (cp2.stage === "finalize") {
      await sb
        .from("lectures")
        .update({
          pipeline_checkpoint: null,
          duration_seconds: cp2.durationSec,
        })
        .eq("id", lectureId);

      await deleteTranscriptionWorkAudio(lectureId);

      await updateLectureStatus(
        lectureId,
        LectureStatus.TRANSCRIBING,
        48,
        "Saving transcript… starting caption step…"
      );

      await schedulePipelineContinuation(lectureId);
    }
  } catch (e) {
    console.error(`runPipelinePhase1Step failed ${lectureId}:`, e);
    await updateLectureStatus(
      lectureId,
      "failed",
      0,
      String(e instanceof Error ? e.message : e).slice(0, 500)
    );
  } finally {
    if (workPath) await unlink(workPath).catch(() => {});
    if (videoPath) await unlink(videoPath).catch(() => {});
  }
}

/** Short audio: single transcribe() call (local / < one chunk). */
export async function transcribeShortAudio(transcriptionPath: string, lectureId: string) {
  return transcribe(transcriptionPath, {
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
}
