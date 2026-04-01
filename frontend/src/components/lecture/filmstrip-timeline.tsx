"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { useAppStore } from "@/lib/store";
import type { CaptionBlock } from "@/lib/api";

interface Frame {
  timeMs: number;
  dataUrl: string;
}

interface FilmstripTimelineProps {
  videoUrl: string;
  durationMs: number;
  captions?: CaptionBlock[];
}

const THUMB_W = 120;
const THUMB_H = 68;
const MAX_FRAMES = 60;

export function FilmstripTimeline({ videoUrl, durationMs, captions }: FilmstripTimelineProps) {
  const [frames, setFrames] = useState<Frame[]>([]);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  const currentTimeMs = useAppStore((s) => s.currentTimeMs);
  const seekTo = useAppStore((s) => s.seekTo);
  const activeCaptionId = useAppStore((s) => s.activeCaptionId);

  useEffect(() => {
    if (!videoUrl || durationMs <= 0) return;

    let cancelled = false;
    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.muted = true;
    video.preload = "auto";
    video.src = videoUrl;

    const durationSec = durationMs / 1000;
    const interval = Math.max(2, durationSec / MAX_FRAMES);
    const timestamps: number[] = [];
    for (let t = 0; t < durationSec; t += interval) {
      timestamps.push(t);
    }

    const extracted: Frame[] = [];
    let idx = 0;

    const canvas = document.createElement("canvas");
    canvas.width = THUMB_W;
    canvas.height = THUMB_H;
    const ctx = canvas.getContext("2d")!;

    function extractNext() {
      if (cancelled || idx >= timestamps.length) {
        if (!cancelled) {
          setFrames(extracted);
          setLoading(false);
        }
        return;
      }
      video.currentTime = timestamps[idx];
    }

    video.addEventListener("seeked", () => {
      if (cancelled) return;
      ctx.drawImage(video, 0, 0, THUMB_W, THUMB_H);
      extracted.push({
        timeMs: Math.round(timestamps[idx] * 1000),
        dataUrl: canvas.toDataURL("image/jpeg", 0.6),
      });
      idx++;
      extractNext();
    });

    video.addEventListener("loadeddata", () => {
      if (!cancelled) extractNext();
    });

    video.addEventListener("error", () => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [videoUrl, durationMs]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || durationMs <= 0) return;
    const x = e.clientX - rect.left + (containerRef.current?.scrollLeft ?? 0);
    const totalWidth = frames.length * (THUMB_W + 2);
    const ratio = Math.max(0, Math.min(1, x / totalWidth));
    seekTo(Math.round(ratio * durationMs));
  }, [frames, durationMs, seekTo]);

  if (loading) {
    return (
      <div className="glass rounded-xl p-3 flex items-center justify-center h-[84px]">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground mr-2" />
        <span className="text-xs text-muted-foreground">Generating filmstrip...</span>
      </div>
    );
  }

  if (frames.length === 0) return null;

  const totalWidth = frames.length * (THUMB_W + 2);
  const playheadPct = durationMs > 0 ? currentTimeMs / durationMs : 0;

  const activeCaption = captions?.find((c) => c.id === activeCaptionId);
  const activeCaptionStart = activeCaption ? activeCaption.start_ms / durationMs : null;
  const activeCaptionEnd = activeCaption ? activeCaption.end_ms / durationMs : null;

  return (
    <div className="glass rounded-xl overflow-hidden">
      <div
        ref={containerRef}
        className="relative overflow-x-auto cursor-pointer"
        onClick={handleClick}
        style={{ height: THUMB_H + 16 }}
      >
        <div className="flex gap-[2px] p-2 relative" style={{ width: totalWidth }}>
          {frames.map((f, i) => (
            <img
              key={i}
              src={f.dataUrl}
              alt=""
              className="rounded-sm flex-shrink-0"
              style={{ width: THUMB_W, height: THUMB_H }}
              draggable={false}
            />
          ))}

          {activeCaptionStart !== null && activeCaptionEnd !== null && (
            <div
              className="absolute top-0 bottom-0 bg-primary/15 border-x border-primary/40 pointer-events-none z-10"
              style={{
                left: `${activeCaptionStart * 100}%`,
                width: `${(activeCaptionEnd - activeCaptionStart) * 100}%`,
              }}
            />
          )}

          <div
            className="absolute top-0 bottom-0 w-0.5 bg-primary shadow-[0_0_6px_var(--primary)] z-20 pointer-events-none"
            style={{ left: `${playheadPct * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
