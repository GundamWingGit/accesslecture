"use client";

import { useMemo } from "react";
import { useAppStore } from "@/lib/store";
import type { CaptionBlock } from "@/lib/api";

const MAX_PINS = 80;

interface WaveformCaptionOverlayProps {
  durationMs: number;
  captions?: CaptionBlock[];
}

export function WaveformCaptionOverlay({ durationMs, captions }: WaveformCaptionOverlayProps) {
  const currentTimeMs = useAppStore((s) => s.currentTimeMs);
  const activeCaptionId = useAppStore((s) => s.activeCaptionId);
  const seekTo = useAppStore((s) => s.seekTo);

  const markers = useMemo(() => {
    if (!captions?.length || durationMs <= 0) return [];
    if (captions.length <= MAX_PINS) return captions;
    const step = Math.ceil(captions.length / MAX_PINS);
    return captions.filter((_, i) => i % step === 0);
  }, [captions, durationMs]);

  const activeCaption = captions?.find((c) => c.id === activeCaptionId);
  const activeText = activeCaption
    ? activeCaption.cleaned_text || activeCaption.original_text
    : null;

  const playheadPct =
    durationMs > 0 ? Math.min(1, Math.max(0, currentTimeMs / durationMs)) : 0;

  if (!durationMs || !captions?.length) return null;

  return (
    <div className="relative mb-1 min-h-[44px]">
      {activeText && (
        <div
          className="pointer-events-none absolute z-20 bottom-full mb-1 max-w-[min(92%,28rem)] transition-opacity duration-200"
          style={{
            left: `${playheadPct * 100}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="glass rounded-xl border border-border/70 px-3 py-2 text-xs text-foreground shadow-lg sm:text-sm leading-snug">
            {activeText}
          </div>
        </div>
      )}

      <div className="relative h-8">
        {markers.map((c) => (
          <button
            key={c.id}
            type="button"
            className="absolute bottom-0 z-10 w-px h-3 rounded-full bg-primary/40 hover:bg-primary transition-colors cursor-pointer"
            style={{
              left: `${(c.start_ms / durationMs) * 100}%`,
              transform: "translateX(-50%)",
            }}
            title={(c.cleaned_text || c.original_text).slice(0, 140)}
            onClick={(e) => {
              e.stopPropagation();
              seekTo(c.start_ms);
            }}
          />
        ))}
      </div>
    </div>
  );
}
