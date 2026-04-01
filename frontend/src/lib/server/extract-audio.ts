import { execFile } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { mkdir, readdir, stat } from "fs/promises";

const FFMPEG_IO_BUFFER = 12 * 1024 * 1024;

let ffmpegPath: string | null = null;

function getFfmpegPath(): string {
  if (ffmpegPath) return ffmpegPath;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    ffmpegPath = require("ffmpeg-static") as string;
  } catch {
    ffmpegPath = "ffmpeg";
  }
  return ffmpegPath;
}

/**
 * Extract audio from a video file using ffmpeg.
 * Produces a mono 64kbps MP3 — typically <5MB for a 10-min lecture.
 * Returns the path to the extracted audio file.
 */
export async function extractAudioFromVideo(
  videoPath: string
): Promise<string> {
  const outPath = join(tmpdir(), `al-audio-${randomUUID()}.mp3`);
  const ffmpeg = getFfmpegPath();

  await new Promise<void>((resolve, reject) => {
    execFile(
      ffmpeg,
      [
        "-i", videoPath,
        "-vn",                // drop video
        "-ac", "1",           // mono
        "-ab", "64k",         // 64kbps
        "-ar", "16000",       // 16kHz sample rate (good for speech)
        "-f", "mp3",
        "-y",                 // overwrite
        outPath,
      ],
      { timeout: 120_000 },
      (err, _stdout, stderr) => {
        if (err) {
          console.error("[ffmpeg] stderr:", stderr);
          reject(new Error(`Audio extraction failed: ${err.message}`));
        } else {
          resolve();
        }
      }
    );
  });

  const info = await stat(outPath);
  console.log(
    `[extract-audio] ${videoPath} → ${outPath} (${(info.size / 1024 / 1024).toFixed(1)}MB)`
  );
  return outPath;
}

/**
 * Check if the file at the given path is a video (by extension).
 */
export function isVideoFile(filePath: string): boolean {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  return ["mp4", "mov", "avi", "mkv", "webm"].includes(ext);
}

export interface VideoSampleFramesResult {
  paths: string[];
  dir: string;
}

/**
 * Extract evenly spaced JPEG frames for long-video OCR (Gemini full-file video often stalls or times out).
 */
export async function extractVideoSampleFrames(
  videoPath: string,
  durationSec: number,
  maxFrames: number
): Promise<VideoSampleFramesResult> {
  const n = Math.max(4, Math.min(24, maxFrames));
  const dur = Math.max(1, durationSec);
  const interval = Math.max(10, dur / n);
  const fps = 1 / interval;
  const outDir = join(tmpdir(), `al-vframes-${randomUUID()}`);
  await mkdir(outDir, { recursive: true });
  const pattern = join(outDir, "f%03d.jpg");
  const ffmpeg = getFfmpegPath();

  await new Promise<void>((resolve, reject) => {
    execFile(
      ffmpeg,
      [
        "-y",
        "-i",
        videoPath,
        "-vf",
        `fps=${fps},scale=1280:-1`,
        "-frames:v",
        String(n),
        pattern,
      ],
      { timeout: 600_000, maxBuffer: FFMPEG_IO_BUFFER },
      (err, _stdout, stderr) => {
        if (err) {
          console.error("[ffmpeg] sample frames:", stderr);
          reject(new Error(`Frame extraction failed: ${err.message}`));
        } else resolve();
      }
    );
  });

  const names = (await readdir(outDir)).filter((f) => /\.jpe?g$/i.test(f)).sort();
  const paths = names.map((f) => join(outDir, f));
  return { paths, dir: outDir };
}

/**
 * Parse media duration from ffmpeg stderr (ffprobe not always bundled with ffmpeg-static).
 */
export async function getAudioDurationSeconds(filePath: string): Promise<number> {
  const ffmpeg = getFfmpegPath();
  return new Promise((resolve) => {
    execFile(
      ffmpeg,
      ["-i", filePath],
      { timeout: 120_000, maxBuffer: FFMPEG_IO_BUFFER },
      (_err, _stdout, stderr) => {
        const s = stderr || "";
        const m = /Duration:\s*(\d{2}):(\d{2}):(\d{2}\.\d+)/.exec(s);
        if (!m) {
          resolve(0);
          return;
        }
        const h = parseInt(m[1], 10);
        const min = parseInt(m[2], 10);
        const sec = parseFloat(m[3]);
        resolve(h * 3600 + min * 60 + sec);
      }
    );
  });
}

/**
 * Extract a slice of audio [startSec, startSec + durationSec) for chunked transcription.
 */
export async function extractAudioChunk(
  inputPath: string,
  startSec: number,
  durationSec: number
): Promise<string> {
  const outPath = join(tmpdir(), `al-chunk-${randomUUID()}.mp3`);
  const ffmpeg = getFfmpegPath();

  await new Promise<void>((resolve, reject) => {
    execFile(
      ffmpeg,
      [
        "-ss",
        String(startSec),
        "-i",
        inputPath,
        "-t",
        String(durationSec),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-ab",
        "64k",
        "-f",
        "mp3",
        "-y",
        outPath,
      ],
      { timeout: 600_000, maxBuffer: FFMPEG_IO_BUFFER },
      (err, _stdout, stderr) => {
        if (err) {
          console.error("[ffmpeg] chunk extract:", stderr);
          reject(err);
        } else resolve();
      }
    );
  });

  return outPath;
}
