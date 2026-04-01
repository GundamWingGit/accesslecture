/**
 * Local pipeline smoke test (no Supabase). Run from frontend/:
 *
 *   npx tsx scripts/test-pipeline-local.ts --visual-only "C:\path\to\video.mp4"
 *   npx tsx scripts/test-pipeline-local.ts --full "C:\path\to\video.mp4"
 *
 * --visual-only  Sample frames + Gemini on-screen text (matches long-video fix path)
 * --full           Also runs transcription (slow + costly on long files)
 */
import "./load-env-local";

import { existsSync } from "fs";
import { rm } from "fs/promises";
import { extractAudioFromVideo, extractVideoSampleFrames, getAudioDurationSeconds, isVideoFile } from "../src/lib/server/extract-audio";
import { config } from "../src/lib/server/config";
import { detectVisualText, detectVisualTextFromFrames, transcribe } from "../src/lib/server/gemini";

function parseArgs() {
  const argv = process.argv.slice(2);
  let mode: "visual-only" | "full" = "visual-only";
  let pathArg: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--full") mode = "full";
    else if (a === "--visual-only") mode = "visual-only";
    else if (!a.startsWith("-")) pathArg = a;
  }
  return { mode, path: pathArg };
}

async function main() {
  const { mode, path: videoPath } = parseArgs();
  if (!videoPath) {
    console.error(
      "Usage: npx tsx scripts/test-pipeline-local.ts [--visual-only|--full] <path-to-video-or-audio>"
    );
    process.exit(1);
  }
  if (!existsSync(videoPath)) {
    console.error("File not found:", videoPath);
    process.exit(1);
  }

  console.log("[test] Mode:", mode);
  console.log("[test] File:", videoPath);
  console.log("[test] VISUAL_FULL_VIDEO_MAX_SECONDS =", config.visualFullVideoMaxSeconds);

  let audioPath = videoPath;
  let extracted: string | null = null;
  if (mode === "full" && isVideoFile(videoPath)) {
    console.log("[test] Extracting audio…");
    extracted = await extractAudioFromVideo(videoPath);
    audioPath = extracted;
  }

  let durationSec = await getAudioDurationSeconds(
    isVideoFile(videoPath) ? videoPath : audioPath
  );
  if (durationSec <= 0 && extracted) {
    durationSec = await getAudioDurationSeconds(extracted);
  }
  console.log("[test] Duration (ffmpeg):", durationSec, "s");

  if (mode === "full") {
    console.log("[test] Transcribing (may take a long time)…");
    const { segments, info } = await transcribe(audioPath);
    console.log("[test] Transcription segments:", segments.length, "duration:", info.durationSeconds);
  } else {
    console.log("[test] Skipping full transcribe (--visual-only).");
  }

  if (!isVideoFile(videoPath)) {
    console.log("[test] Not a video file — skipping visual analysis.");
    if (extracted) await rm(extracted, { force: true }).catch(() => {});
    return;
  }

  const useSampled = durationSec > config.visualFullVideoMaxSeconds;
  console.log("[test] Use sampled frames for OCR:", useSampled);

  if (useSampled) {
    const { paths, dir } = await extractVideoSampleFrames(
      videoPath,
      durationSec,
      config.visualSampleFrameCount
    );
    try {
      console.log("[test] Calling detectVisualTextFromFrames (", paths.length, "frames)…");
      const detections = await detectVisualTextFromFrames(paths, durationSec);
      console.log("[test] Slide detections:", detections.length, "items");
      if (detections.length) {
        console.log("[test] Sample:", detections.slice(0, 3).map((d) => d.text.slice(0, 60)));
      }
    } finally {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  } else {
    console.log("[test] Short video — running full-file detectVisualText…");
    const detections = await detectVisualText(videoPath);
    console.log("[test] Slide detections:", detections.length, "items");
  }

  if (extracted) await rm(extracted, { force: true }).catch(() => {});
  console.log("[test] Done.");
}

main().catch((e) => {
  console.error("[test] Failed:", e);
  process.exit(1);
});
