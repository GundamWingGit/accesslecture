import { execFile } from "child_process";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { stat } from "fs/promises";

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
