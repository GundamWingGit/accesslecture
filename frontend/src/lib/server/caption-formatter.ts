import { config } from "./config";
import type { TranscriptSegment } from "./gemini";

export interface CaptionBlock {
  id: string;
  sequence: number;
  startMs: number;
  endMs: number;
  originalText: string;
  cleanedText?: string | null;
  speaker: string | null;
  minConfidence: number;
}

const maxLineLength = () => config.maxCaptionLineLength;
const maxLines = () => config.maxCaptionLines;
const minDurationMs = () => config.minCaptionDurationMs;
const maxDurationMs = () => config.maxCaptionDurationMs;

export function segmentsToCaptions(
  segments: TranscriptSegment[],
  speakerMap?: Record<string, string> | null
): CaptionBlock[] {
  const captions: CaptionBlock[] = [];
  let sequence = 0;

  for (const seg of segments) {
    const text = seg.text;
    const speakerLabel = seg.speaker
      ? (speakerMap?.[seg.speaker] ?? seg.speaker)
      : null;

    const segMinConf = seg.words.length
      ? Math.min(...seg.words.map((w) => w.confidence))
      : 0.92;

    const chunks = splitIntoCaptionChunks(text);
    if (!chunks.length) continue;

    if (chunks.length === 1) {
      sequence++;
      const prefix = speakerLabel ? `>> ${speakerLabel}: ` : "";
      captions.push({
        id: `cap-${sequence}`,
        sequence,
        startMs: seg.startMs,
        endMs: seg.endMs,
        originalText: prefix + chunks[0],
        speaker: seg.speaker,
        minConfidence: segMinConf,
      });
    } else {
      const totalDuration = seg.endMs - seg.startMs;
      const totalChars = chunks.reduce((s, c) => s + c.length, 0);
      let currentStart = seg.startMs;

      for (let i = 0; i < chunks.length; i++) {
        const chunkRatio =
          totalChars > 0 ? chunks[i].length / totalChars : 1 / chunks.length;
        let chunkDuration = Math.round(totalDuration * chunkRatio);
        chunkDuration = Math.max(
          minDurationMs(),
          Math.min(maxDurationMs(), chunkDuration)
        );
        const chunkEnd = Math.min(currentStart + chunkDuration, seg.endMs);

        sequence++;
        const prefix = i === 0 && speakerLabel ? `>> ${speakerLabel}: ` : "";
        captions.push({
          id: `cap-${sequence}`,
          sequence,
          startMs: currentStart,
          endMs: chunkEnd,
          originalText: prefix + chunks[i],
          speaker: seg.speaker,
          minConfidence: segMinConf,
        });
        currentStart = chunkEnd;
      }
    }
  }

  return captions;
}

export function splitIntoCaptionChunks(text: string): string[] {
  if (!text.trim()) return [];

  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let currentLines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;

    if (testLine.length <= maxLineLength()) {
      currentLine = testLine;
    } else {
      if (currentLine) currentLines.push(currentLine);
      currentLine = word;

      if (currentLines.length >= maxLines()) {
        chunks.push(currentLines.join("\n"));
        currentLines = [];
      }
    }
  }

  if (currentLine) currentLines.push(currentLine);
  if (currentLines.length) chunks.push(currentLines.join("\n"));

  return chunks;
}

function formatVttTime(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  const millis = ms % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

function formatSrtTime(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const seconds = Math.floor((ms % 60_000) / 1_000);
  const millis = ms % 1_000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
}

export function toVtt(
  captions: Array<Record<string, unknown>>,
  useCleaned = true
): string {
  const lines = ["WEBVTT", ""];
  for (const cap of captions) {
    const text = useCleaned
      ? ((cap.cleaned_text as string) || (cap.original_text as string))
      : (cap.original_text as string);
    lines.push(
      `${formatVttTime(cap.start_ms as number)} --> ${formatVttTime(cap.end_ms as number)}`
    );
    lines.push(text);
    lines.push("");
  }
  return lines.join("\n");
}

export function toSrt(
  captions: Array<Record<string, unknown>>,
  useCleaned = true
): string {
  const lines: string[] = [];
  for (let i = 0; i < captions.length; i++) {
    const cap = captions[i];
    const text = useCleaned
      ? ((cap.cleaned_text as string) || (cap.original_text as string))
      : (cap.original_text as string);
    lines.push(String(i + 1));
    lines.push(
      `${formatSrtTime(cap.start_ms as number)} --> ${formatSrtTime(cap.end_ms as number)}`
    );
    lines.push(text);
    lines.push("");
  }
  return lines.join("\n");
}

export function toTxt(
  captions: Array<Record<string, unknown>>,
  useCleaned = true
): string {
  const lines: string[] = [];
  let currentSpeaker: string | null = null;
  for (const cap of captions) {
    const text = useCleaned
      ? ((cap.cleaned_text as string) || (cap.original_text as string))
      : (cap.original_text as string);
    const speaker = cap.speaker as string | null;
    if (speaker && speaker !== currentSpeaker) {
      if (lines.length) lines.push("");
      lines.push(`[${speaker}]`);
      currentSpeaker = speaker;
    }
    lines.push(text);
  }
  return lines.join("\n");
}
