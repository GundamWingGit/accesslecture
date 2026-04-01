import { GoogleGenAI } from "@google/genai";
import { readFile, stat, unlink } from "fs/promises";
import { config } from "./config";
import { extractAudioChunk, getAudioDurationSeconds } from "./extract-audio";

const LARGE_FILE_THRESHOLD = 20 * 1024 * 1024; // 20MB — use File API above this

/** Long recordings: Gemini often stops ~8–10 min in one shot; chunk and merge. */
const TRANSCRIBE_CHUNK_SEC = 480;
const TRANSCRIBE_CHUNK_OVERLAP_SEC = 3;

// ---------------------------------------------------------------------------
// Shared client (singleton)
// ---------------------------------------------------------------------------

let _client: GoogleGenAI | null = null;

function getGoogleAuthOptions() {
  if (config.googleCredentialsJson) {
    try {
      const creds = JSON.parse(config.googleCredentialsJson);
      return {
        credentials: {
          client_email: creds.client_email,
          private_key: creds.private_key,
        },
      };
    } catch (err) {
      console.error("[gemini] Failed to parse GOOGLE_CREDENTIALS_JSON:", err);
    }
  }
  if (config.googleApplicationCredentials) {
    process.env.GOOGLE_APPLICATION_CREDENTIALS =
      config.googleApplicationCredentials;
  }
  return undefined;
}

function getClient(): GoogleGenAI {
  if (!_client) {
    if (config.useVertexAi) {
      const authOptions = getGoogleAuthOptions();
      _client = new GoogleGenAI({
        vertexai: true,
        project: config.gcpProjectId,
        location: config.gcpLocation,
        googleAuthOptions: authOptions,
        httpOptions: { timeout: 600_000 },
      });
    } else {
      _client = new GoogleGenAI({
        apiKey: config.googleApiKey,
        httpOptions: { timeout: 600_000 },
      });
    }
  }
  return _client;
}

// ---------------------------------------------------------------------------
// File API helpers for large media
// ---------------------------------------------------------------------------

async function uploadToFileApi(
  filePath: string,
  mimeType: string
): Promise<{ uri: string; mimeType: string }> {
  const client = getClient();
  console.log(`[gemini] Uploading ${filePath} (${mimeType}) to File API...`);

  const uploaded = await client.files.upload({
    file: filePath,
    config: { mimeType },
  });

  let file = uploaded;
  const name = file.name!;
  let attempts = 0;
  while (file.state === "PROCESSING" && attempts < 60) {
    await new Promise((r) => setTimeout(r, 5000));
    file = await client.files.get({ name });
    attempts++;
  }

  if (file.state === "FAILED") {
    throw new Error(`File API processing failed for ${name}`);
  }

  console.log(`[gemini] File ready: ${file.uri} (state: ${file.state})`);
  return { uri: file.uri!, mimeType: file.mimeType ?? mimeType };
}

async function getMediaPart(
  filePath: string,
  mimeType: string
): Promise<{ inlineData: { data: string; mimeType: string } } | { fileData: { fileUri: string; mimeType: string } }> {
  const fileInfo = await stat(filePath);

  if (fileInfo.size > LARGE_FILE_THRESHOLD && !config.useVertexAi) {
    try {
      const uploaded = await uploadToFileApi(filePath, mimeType);
      return { fileData: { fileUri: uploaded.uri, mimeType: uploaded.mimeType } };
    } catch (e) {
      console.warn("[gemini] File API upload failed, falling back to inline data:", e);
    }
  }

  if (fileInfo.size > LARGE_FILE_THRESHOLD) {
    console.log(`[gemini] Sending ${(fileInfo.size / 1024 / 1024).toFixed(1)}MB file inline (large file, 10min timeout)...`);
  }

  const bytes = await readFile(filePath);
  return { inlineData: { data: bytes.toString("base64"), mimeType } };
}

function parseJson(raw: string): unknown {
  let text = raw.trim();
  if (text.startsWith("```")) {
    text = text.split("\n").slice(1).join("\n").replace(/```\s*$/, "");
  }
  return JSON.parse(text);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
  speaker: string | null;
  confidence: number;
}

export interface TranscriptSegment {
  id: string;
  startMs: number;
  endMs: number;
  text: string;
  speaker: string | null;
  words: WordTimestamp[];
}

export interface TranscriptionResult {
  segments: TranscriptSegment[];
  info: {
    language: string;
    languageProbability: number;
    durationSeconds: number;
  };
}

export interface SlideDetection {
  text: string;
  startMs: number;
  endMs: number;
  confidence: number;
  description: string;
}

// ---------------------------------------------------------------------------
// MIME helpers
// ---------------------------------------------------------------------------

function mediaMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  const mimeMap: Record<string, string> = {
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    webm: "audio/webm",
    ogg: "audio/ogg",
    flac: "audio/flac",
    wav: "audio/wav",
    mp4: "video/mp4",
    mov: "video/quicktime",
    avi: "video/x-msvideo",
    mkv: "video/x-matroska",
  };
  return mimeMap[ext] ?? "audio/wav";
}

function videoMime(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() ?? "";
  return (
    ({
      webm: "video/webm",
      mov: "video/quicktime",
      avi: "video/x-msvideo",
    } as Record<string, string>)[ext] ?? "video/mp4"
  );
}

// ---------------------------------------------------------------------------
// Transcription
// ---------------------------------------------------------------------------

const TRANSCRIPTION_SYSTEM = `You are a precise lecture transcription engine. Given an audio recording,
produce a complete verbatim transcription with timestamps and speaker labels.

Return a JSON object with this exact schema:
{
  "language": "en",
  "duration_seconds": <float>,
  "segments": [
    {
      "start_seconds": <float>,
      "end_seconds": <float>,
      "text": "<exact spoken text with punctuation>",
      "speaker": "SPEAKER_0" | "SPEAKER_1" | null,
      "confidence": <float 0-1>
    }
  ]
}

Rules:
1. Transcribe EVERY word spoken — do not summarize or skip.
2. Use accurate punctuation and capitalization.
3. Assign speaker labels (SPEAKER_0, SPEAKER_1, …) when multiple speakers are present.
   Single-speaker recordings → always SPEAKER_0.
4. Timestamps must be precise to 0.1 s.
5. Segments should be 5-30 s long, split at natural sentence/phrase boundaries.
6. Include a confidence score (0-1) for each segment estimating transcription accuracy.
   Use lower confidence (0.3-0.7) for unclear/mumbled speech, technical jargon, or
   words you are uncertain about. Use high confidence (0.9-1.0) for clearly spoken text.
7. Return ONLY valid JSON — no markdown fences, no explanation.`;

export async function transcribe(audioPath: string): Promise<TranscriptionResult> {
  const durationSec = await getAudioDurationSeconds(audioPath);
  const step = TRANSCRIBE_CHUNK_SEC - TRANSCRIBE_CHUNK_OVERLAP_SEC;

  if (durationSec <= 0 || durationSec <= TRANSCRIBE_CHUNK_SEC + 1) {
    return transcribeOnce(audioPath);
  }

  const merged: TranscriptSegment[] = [];
  let globalIdx = 0;

  for (let start = 0; start < durationSec; start += step) {
    const chunkLen = Math.min(TRANSCRIBE_CHUNK_SEC, durationSec - start);
    if (chunkLen < 0.5) break;

    const chunkPath = await extractAudioChunk(audioPath, start, chunkLen);
    try {
      const part = await transcribeOnce(chunkPath);
      const offsetMs = Math.round(start * 1000);
      for (const seg of part.segments) {
        merged.push({
          ...seg,
          id: `seg-${globalIdx++}`,
          startMs: seg.startMs + offsetMs,
          endMs: seg.endMs + offsetMs,
          words: seg.words.map((w) => ({
            ...w,
            startMs: w.startMs + offsetMs,
            endMs: w.endMs + offsetMs,
          })),
        });
      }
      console.log(
        `[gemini] Transcribed chunk ${start.toFixed(0)}s–${(start + chunkLen).toFixed(0)}s (${merged.length} segments total)`
      );
    } finally {
      await unlink(chunkPath).catch(() => {});
    }
  }

  return {
    segments: merged,
    info: {
      language: "en",
      languageProbability: 0.99,
      durationSeconds: durationSec,
    },
  };
}

async function transcribeOnce(audioPath: string): Promise<TranscriptionResult> {
  const client = getClient();
  const mime = mediaMime(audioPath);
  const mediaPart = await getMediaPart(audioPath, mime);

  const response = await client.models.generateContent({
    model: config.geminiModel,
    contents: [
      {
        role: "user",
        parts: [
          mediaPart,
          { text: "Transcribe this audio recording completely with timestamps and speaker labels." },
        ],
      },
    ],
    config: {
      systemInstruction: TRANSCRIPTION_SYSTEM,
      temperature: 0.1,
      maxOutputTokens: 65536,
      responseMimeType: "application/json",
    },
  });

  const data = parseJson(response.text ?? "") as {
    language?: string;
    duration_seconds?: number;
    segments?: Array<{
      start_seconds: number;
      end_seconds: number;
      text: string;
      speaker?: string | null;
      confidence?: number;
    }>;
  };

  return buildSegments(data);
}

function buildSegments(data: {
  language?: string;
  duration_seconds?: number;
  segments?: Array<{
    start_seconds: number;
    end_seconds: number;
    text: string;
    speaker?: string | null;
    confidence?: number;
  }>;
}): TranscriptionResult {
  const segments: TranscriptSegment[] = [];
  let totalDuration = data.duration_seconds ?? 0;

  for (const [i, seg] of (data.segments ?? []).entries()) {
    const startMs = Math.round(seg.start_seconds * 1000);
    const endMs = Math.round(seg.end_seconds * 1000);
    totalDuration = Math.max(totalDuration, seg.end_seconds);

    const segConfidence = seg.confidence ?? 0.92;
    const wordTexts = seg.text.split(/\s+/).filter(Boolean);
    const segDuration = endMs - startMs;
    const words: WordTimestamp[] = wordTexts.map((w, wi) => {
      const wordStart = startMs + Math.round((segDuration * wi) / wordTexts.length);
      const wordEnd = startMs + Math.round((segDuration * (wi + 1)) / wordTexts.length);
      return {
        word: w,
        startMs: wordStart,
        endMs: wordEnd,
        speaker: seg.speaker ?? null,
        confidence: segConfidence,
      };
    });

    segments.push({
      id: `seg-${i}`,
      startMs,
      endMs,
      text: seg.text,
      speaker: seg.speaker ?? null,
      words,
    });
  }

  return {
    segments,
    info: {
      language: data.language ?? "en",
      languageProbability: 0.99,
      durationSeconds: totalDuration,
    },
  };
}

// ---------------------------------------------------------------------------
// Visual analysis
// ---------------------------------------------------------------------------

const VISUAL_SYSTEM = `You are a slide/screen text extraction engine for lecture accessibility.
Analyze this lecture video and extract ALL text visible on screen
(slides, whiteboard, projected content, terminal/code, diagrams, etc.).

Return a JSON array of objects:
[
  {
    "start_seconds": <float>,
    "end_seconds": <float>,
    "texts": ["line 1 of visible text", "line 2", …],
    "description": "<brief description: slide title, diagram, code block, etc.>"
  }
]

Rules:
1. Group by visual state — a new entry each time the screen content changes.
2. Include ALL readable text, even partial.
3. The description helps someone who cannot see the screen understand context.
4. Return ONLY valid JSON — no markdown fences.`;

export async function detectVisualText(
  videoPath: string
): Promise<SlideDetection[]> {
  const client = getClient();
  const mime = videoMime(videoPath);
  const mediaPart = await getMediaPart(videoPath, mime);

  const response = await client.models.generateContent({
    model: config.geminiModel,
    contents: [
      {
        role: "user",
        parts: [
          mediaPart,
          { text: "Extract all on-screen text from this lecture video with timestamps." },
        ],
      },
    ],
    config: {
      systemInstruction: VISUAL_SYSTEM,
      temperature: 0.1,
      maxOutputTokens: 32768,
      responseMimeType: "application/json",
    },
  });

  let slides: Array<{
    start_seconds: number;
    end_seconds: number;
    texts?: string[];
    description?: string;
  }>;

  try {
    slides = parseJson(response.text ?? "") as typeof slides;
  } catch {
    console.warn("[gemini] Failed to parse visual analysis JSON");
    return [];
  }

  const detections: SlideDetection[] = [];
  for (const slide of slides) {
    const startMs = Math.round(slide.start_seconds * 1000);
    const endMs = Math.round(slide.end_seconds * 1000);
    for (const textLine of slide.texts ?? []) {
      if (textLine.trim().length >= 3) {
        detections.push({
          text: textLine.trim(),
          startMs,
          endMs,
          confidence: 0.9,
          description: slide.description ?? "",
        });
      }
    }
  }

  detections.sort((a, b) => a.startMs - b.startMs);
  return detections;
}

export function groupSlides(
  detections: SlideDetection[]
): Array<{ startMs: number; endMs: number; texts: string[] }> {
  if (!detections.length) return [];
  const groups: Array<{ startMs: number; endMs: number; texts: string[] }> = [];
  let current = {
    startMs: detections[0].startMs,
    endMs: detections[0].endMs,
    texts: [detections[0].text],
  };
  for (let i = 1; i < detections.length; i++) {
    const d = detections[i];
    if (d.startMs - current.endMs < 2000) {
      current.endMs = Math.max(current.endMs, d.endMs);
      current.texts.push(d.text);
    } else {
      groups.push(current);
      current = { startMs: d.startMs, endMs: d.endMs, texts: [d.text] };
    }
  }
  groups.push(current);
  return groups;
}

// ---------------------------------------------------------------------------
// Cleanup / reasoning
// ---------------------------------------------------------------------------

export async function cleanupSegment(
  text: string,
  mode = "clean",
  speaker?: string | null,
  syllabusContext?: string | null
): Promise<string> {
  const client = getClient();

  const system =
    mode === "verbatim"
      ? "You are a caption editor for educational accessibility compliance. " +
        "Fix ONLY clear transcription errors (misspelled words, garbled text). " +
        "PRESERVE all filler words (um, uh, like, you know), false starts, and " +
        "repeated words exactly as spoken. Do NOT change grammar or sentence structure. " +
        "Return ONLY the corrected text, nothing else."
      : "You are a caption editor for educational accessibility compliance. " +
        "Clean up this transcript segment by: " +
        "1) Removing filler words (um, uh, like, you know, basically, right, so) " +
        "2) Fixing grammar and punctuation " +
        "3) Removing false starts and repeated words " +
        "4) Improving readability while preserving the original meaning exactly " +
        "5) Keeping all technical terms, proper nouns, and key concepts intact " +
        "Return ONLY the cleaned text, nothing else. Do not add any explanation.";

  let userPrompt = `Clean this transcript segment:\n\n${text}`;
  if (syllabusContext) {
    userPrompt += `\n\nCourse vocabulary context (use this to correctly spell technical terms):\n${syllabusContext.slice(0, 2000)}`;
  }
  if (speaker) {
    userPrompt += `\n\nSpeaker: ${speaker}`;
  }

  const response = await client.models.generateContent({
    model: config.geminiModel,
    contents: userPrompt,
    config: {
      systemInstruction: system,
      temperature: 0.1,
      maxOutputTokens: 2048,
    },
  });

  return (response.text ?? "").trim();
}

export async function detectVisualReferences(
  text: string
): Promise<Array<{ phrase: string; suggestion: string }>> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: config.geminiModel,
    contents: `Analyze this caption text for visual references:\n\n${text}`,
    config: {
      systemInstruction:
        "You are an accessibility expert analyzing lecture captions. " +
        "Identify phrases where the speaker references visual content that would " +
        "not be accessible to someone who cannot see the screen (slides, graphs, " +
        "diagrams, whiteboard). " +
        'Return a JSON array of {"phrase": str, "suggestion": str}. ' +
        "If none found, return []. Return ONLY valid JSON.",
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  try {
    return parseJson(response.text ?? "") as Array<{
      phrase: string;
      suggestion: string;
    }>;
  } catch {
    return [];
  }
}

export async function extractVocabulary(
  syllabusText: string
): Promise<string[]> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: config.geminiModel,
    contents: `Extract vocabulary from this syllabus:\n\n${syllabusText.slice(0, 5000)}`,
    config: {
      systemInstruction:
        "You are an academic vocabulary extractor. Given a course syllabus, " +
        "extract all technical terms, proper nouns, specialized vocabulary, " +
        "acronyms, and key concepts that a transcription system might misspell. " +
        "Return a JSON array of strings. Return ONLY valid JSON.",
      temperature: 0.1,
      maxOutputTokens: 2048,
      responseMimeType: "application/json",
    },
  });

  try {
    const vocab = parseJson(response.text ?? "");
    return Array.isArray(vocab) ? vocab : [];
  } catch {
    return [];
  }
}

export async function generateSuggestions(
  score: number,
  issues: Array<Record<string, unknown>>
): Promise<Array<{ title: string; description: string; priority: string }>> {
  const client = getClient();

  const response = await client.models.generateContent({
    model: config.geminiModel,
    contents: `Score: ${score}%\nIssues: ${JSON.stringify(issues)}`,
    config: {
      systemInstruction:
        "You are an accessibility advisor for educational content. " +
        "Given an accessibility score and list of issues, provide 3-5 concise, " +
        "actionable suggestions. Each has 'title', 'description', 'priority' " +
        "(high/medium/low). Return ONLY valid JSON array.",
      temperature: 0.3,
      maxOutputTokens: 1024,
      responseMimeType: "application/json",
    },
  });

  try {
    return parseJson(response.text ?? "") as Array<{
      title: string;
      description: string;
      priority: string;
    }>;
  } catch {
    return [];
  }
}
