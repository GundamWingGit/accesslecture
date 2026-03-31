import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpeg: FFmpeg | null = null;

async function getFFmpeg(): Promise<FFmpeg> {
  if (ffmpeg && ffmpeg.loaded) return ffmpeg;

  ffmpeg = new FFmpeg();

  const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm";
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
  });

  return ffmpeg;
}

export interface ExtractionProgress {
  stage: "loading" | "extracting" | "done";
  progress: number;
}

/**
 * Extract audio from a video file client-side using ffmpeg.wasm.
 * Converts any video/audio input to MP3 format, reducing file size by ~90%.
 */
export async function extractAudio(
  file: File,
  onProgress?: (p: ExtractionProgress) => void
): Promise<File> {
  if (file.type.startsWith("audio/")) {
    return file;
  }

  onProgress?.({ stage: "loading", progress: 0 });

  const ff = await getFFmpeg();

  ff.on("progress", ({ progress }) => {
    onProgress?.({
      stage: "extracting",
      progress: Math.min(Math.round(progress * 100), 99),
    });
  });

  const inputName = "input" + getExtension(file.name);
  const outputName = "output.mp3";

  await ff.writeFile(inputName, await fetchFile(file));

  await ff.exec([
    "-i", inputName,
    "-vn",              // no video
    "-acodec", "libmp3lame",
    "-ab", "128k",      // 128kbps
    "-ar", "16000",     // 16kHz (optimal for Whisper)
    "-ac", "1",         // mono
    outputName,
  ]);

  const data = await ff.readFile(outputName);
  const blob = new Blob([new Uint8Array(data as Uint8Array)], { type: "audio/mpeg" });
  const audioFile = new File(
    [blob],
    file.name.replace(/\.[^/.]+$/, ".mp3"),
    { type: "audio/mpeg" }
  );

  await ff.deleteFile(inputName);
  await ff.deleteFile(outputName);

  onProgress?.({ stage: "done", progress: 100 });

  return audioFile;
}

function getExtension(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase();
  if (ext) return `.${ext}`;
  return ".mp4";
}

/**
 * Upload audio file to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
export async function uploadToStorage(
  file: File,
  lectureId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const { getSupabaseBrowser } = await import("@/lib/supabase");
  const supabase = getSupabaseBrowser();

  const filePath = `lectures/${lectureId}/${file.name}`;

  const { error } = await supabase.storage
    .from("audio")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  onProgress?.(100);

  const { data: urlData } = supabase.storage
    .from("audio")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Upload original video file to Supabase Storage for slide OCR.
 * Returns the public URL. Stored in a separate "videos" bucket.
 */
export async function uploadVideoToStorage(
  file: File,
  lectureId: string,
): Promise<string> {
  const { getSupabaseBrowser } = await import("@/lib/supabase");
  const supabase = getSupabaseBrowser();

  const filePath = `lectures/${lectureId}/${file.name}`;

  const { error } = await supabase.storage
    .from("videos")
    .upload(filePath, file, {
      cacheControl: "3600",
      upsert: true,
    });

  if (error) throw new Error(`Video upload failed: ${error.message}`);

  const { data: urlData } = supabase.storage
    .from("videos")
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}
