import * as tus from "tus-js-client";

export interface ExtractionProgress {
  stage: "loading" | "extracting" | "done";
  progress: number;
}

const SMALL_FILE_THRESHOLD = 40 * 1024 * 1024; // 40MB — use simple upload below this

/**
 * For video files, we skip client-side ffmpeg extraction entirely.
 * Gemini can transcribe video directly, so we just upload the original.
 * For audio files, pass through as-is.
 */
export async function extractAudio(
  file: File,
  onProgress?: (p: ExtractionProgress) => void
): Promise<File> {
  onProgress?.({ stage: "done", progress: 100 });
  return file;
}

async function getSupabaseSession() {
  const { getSupabaseBrowser } = await import("@/lib/supabase");
  const supabase = getSupabaseBrowser();
  const { data } = await supabase.auth.getSession();
  return { supabase, session: data.session };
}

function getProjectId(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const match = url.match(/https?:\/\/([^.]+)/);
  return match?.[1] ?? "";
}

/**
 * Upload a file to Supabase Storage using TUS resumable upload for large files,
 * or simple upload for small files.
 */
async function uploadWithResumable(
  bucket: string,
  filePath: string,
  file: File,
  onProgress?: (pct: number) => void
): Promise<string> {
  const { supabase, session } = await getSupabaseSession();

  if (!session?.access_token) {
    throw new Error("Not authenticated — please sign in first");
  }

  if (file.size < SMALL_FILE_THRESHOLD) {
    const { error } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { cacheControl: "3600", upsert: true });

    if (error) throw new Error(`Upload failed: ${error.message}`);
    onProgress?.(100);
  } else {
    const projectId = getProjectId();
    const endpoint = `https://${projectId}.supabase.co/storage/v1/upload/resumable`;

    await new Promise<void>((resolve, reject) => {
      const upload = new tus.Upload(file, {
        endpoint,
        retryDelays: [0, 3000, 5000, 10000, 20000],
        headers: {
          authorization: `Bearer ${session.access_token}`,
          "x-upsert": "true",
        },
        uploadDataDuringCreation: true,
        removeFingerprintOnSuccess: true,
        chunkSize: 6 * 1024 * 1024,
        metadata: {
          bucketName: bucket,
          objectName: filePath,
          contentType: file.type || "application/octet-stream",
        },
        onProgress: (bytesUploaded, bytesTotal) => {
          const pct = Math.round((bytesUploaded / bytesTotal) * 100);
          onProgress?.(pct);
        },
        onSuccess: () => resolve(),
        onError: (err) => {
          const msg = err.message || String(err);
          if (msg.includes("413") || msg.toLowerCase().includes("maximum size")) {
            reject(new Error(
              `File exceeds the storage upload limit. Please increase the "Global file size limit" ` +
              `in your Supabase Dashboard → Project Settings → Storage.`
            ));
          } else {
            reject(new Error(`Upload failed: ${msg}`));
          }
        },
      });

      upload.findPreviousUploads().then((prev) => {
        if (prev.length) upload.resumeFromPreviousUpload(prev[0]);
        upload.start();
      });
    });
  }

  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(filePath);

  return urlData.publicUrl;
}

/**
 * Upload audio/video file to Supabase Storage "audio" bucket.
 * Uses resumable upload for large files.
 */
export async function uploadToStorage(
  file: File,
  lectureId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `lectures/${lectureId}/${safeName}`;
  return uploadWithResumable("audio", filePath, file, onProgress);
}

/**
 * Upload original video file to Supabase Storage "videos" bucket.
 * Uses resumable upload for large files.
 */
export async function uploadVideoToStorage(
  file: File,
  lectureId: string,
  onProgress?: (pct: number) => void
): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `lectures/${lectureId}/${safeName}`;
  return uploadWithResumable("videos", filePath, file, onProgress);
}
