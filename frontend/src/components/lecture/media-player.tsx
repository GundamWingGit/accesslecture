"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import type { Lecture, CaptionBlock } from "@/lib/api";
import { WaveformCaptionOverlay } from "./waveform-caption-overlay";
import {
  getWaveformFromCache,
  saveWaveformToCache,
  waveformCacheKey,
} from "@/lib/waveform-cache";

function formatTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface MediaPlayerProps {
  lecture: Lecture;
  captions?: CaptionBlock[];
  hideTransport?: boolean;
}

export function MediaPlayer({ lecture, captions, hideTransport }: MediaPlayerProps) {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<import("wavesurfer.js").default | null>(null);
  const regionsRef = useRef<import("wavesurfer.js/dist/plugins/regions.esm.js").default | null>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);

  const currentTimeMs = useAppStore((s) => s.currentTimeMs);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const playbackRate = useAppStore((s) => s.playbackRate);
  const setCurrentTimeMs = useAppStore((s) => s.setCurrentTimeMs);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setPlaybackRate = useAppStore((s) => s.setPlaybackRate);
  const setWavesurfer = useAppStore((s) => s.setWavesurfer);
  const setActiveCaptionId = useAppStore((s) => s.setActiveCaptionId);
  const seekTo = useAppStore((s) => s.seekTo);

  const captionsRef = useRef(captions);
  captionsRef.current = captions;

  const captionsKey = useMemo(
    () => captions?.map((c) => `${c.id}:${c.start_ms}:${c.end_ms}`).join("|") ?? "",
    [captions]
  );

  const mediaUrl = lecture.audio_url;

  useEffect(() => {
    if (!waveformRef.current || !mediaUrl) return;

    let destroyed = false;

    (async () => {
      const WaveSurfer = (await import("wavesurfer.js")).default;
      const RegionsPlugin = (await import("wavesurfer.js/dist/plugins/regions.esm.js")).default;
      if (destroyed) return;

      const cacheKey = waveformCacheKey(lecture.id, mediaUrl);
      const cached = await getWaveformFromCache(cacheKey);
      if (destroyed) return;

      const usedCache = !!cached?.peaks?.length && cached.duration > 0;

      const ws = WaveSurfer.create({
        container: waveformRef.current!,
        waveColor: "hsl(var(--muted-foreground) / 0.3)",
        progressColor: "hsl(var(--primary))",
        cursorColor: "hsl(var(--primary))",
        cursorWidth: 2,
        barWidth: 2,
        barGap: 1,
        barRadius: 2,
        height: 80,
        normalize: true,
        sampleRate: 8000,
        url: mediaUrl,
        ...(usedCache
          ? {
              peaks: cached!.peaks,
              duration: cached!.duration,
            }
          : {}),
      });

      const regions = ws.registerPlugin(RegionsPlugin.create());
      regionsRef.current = regions;

      regions.on("region-clicked", (region: { start: number }) => {
        if (!destroyed) seekTo(Math.round(region.start * 1000));
      });

      ws.on("ready", () => {
        if (destroyed) return;
        setReady(true);
        setDuration(ws.getDuration() * 1000);
        ws.setPlaybackRate(useAppStore.getState().playbackRate);
        if (lecture.video_url) {
          ws.setVolume(0);
        }

        if (!usedCache) {
          const dur = ws.getDuration();
          if (dur > 0) {
            const peaks = ws.exportPeaks({ maxLength: 8000, precision: 4 });
            void saveWaveformToCache(cacheKey, peaks, dur);
          }
        }

        const caps = captionsRef.current;
        if (caps?.length && regions) {
          addCaptionRegions(regions, caps);
        }
      });

      ws.on("timeupdate", (time: number) => {
        if (destroyed) return;
        if (lecture.video_url) return;
        const ms = Math.round(time * 1000);
        setCurrentTimeMs(ms);

        const caps = captionsRef.current;
        if (caps) {
          const active = caps.find((c) => ms >= c.start_ms && ms < c.end_ms);
          if (active) setActiveCaptionId(active.id);
        }
      });

      ws.on("play", () => !destroyed && setIsPlaying(true));
      ws.on("pause", () => !destroyed && setIsPlaying(false));
      ws.on("finish", () => !destroyed && setIsPlaying(false));

      wsRef.current = ws;
      setWavesurfer(ws);
    })();

    return () => {
      destroyed = true;
      if (wsRef.current) {
        wsRef.current.destroy();
        wsRef.current = null;
        regionsRef.current = null;
        setWavesurfer(null);
      }
    };
  }, [
    mediaUrl,
    lecture.id,
    lecture.video_url,
    setCurrentTimeMs,
    setIsPlaying,
    setActiveCaptionId,
    setWavesurfer,
    seekTo,
  ]);

  useEffect(() => {
    const regions = regionsRef.current;
    if (!regions || !ready || !captions?.length) return;
    addCaptionRegions(regions, captions);
  }, [captionsKey, ready, captions]);

  const togglePlay = useCallback(() => {
    wsRef.current?.playPause();
  }, []);

  const skip = useCallback((seconds: number) => {
    const ws = wsRef.current;
    if (!ws) return;
    const dur = ws.getDuration();
    const cur = ws.getCurrentTime();
    const next = Math.max(0, Math.min(dur, cur + seconds));
    ws.seekTo(next / dur);
  }, []);

  const toggleMute = useCallback(() => {
    const ws = wsRef.current;
    if (!ws) return;
    const next = !muted;
    ws.setVolume(next ? 0 : 1);
    setMuted(next);
  }, [muted]);

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
  }, [playbackRate, setPlaybackRate]);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-2">
        <div className="relative">
          {ready && (
            <WaveformCaptionOverlay durationMs={duration} captions={captions} />
          )}
          <div
            ref={waveformRef}
            className={`w-full rounded-xl overflow-hidden transition-opacity ${ready ? "opacity-100" : "opacity-30"}`}
          />
        </div>
      </div>

      {!hideTransport && (
        <div className="px-5 pb-5 pt-2 flex items-center gap-3">
          <span className="text-xs font-mono text-muted-foreground w-20 text-right tabular-nums">
            {formatTimecode(currentTimeMs)}
          </span>

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl" onClick={() => skip(-5)} disabled={!ready}>
              <SkipBack className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              className="w-11 h-11 rounded-full btn-gradient shadow-md"
              onClick={togglePlay}
              disabled={!ready}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </Button>
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl" onClick={() => skip(5)} disabled={!ready}>
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          <span className="text-xs font-mono text-muted-foreground w-20 tabular-nums">
            {formatTimecode(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl" onClick={toggleMute} disabled={!ready}>
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="text-xs font-mono h-7 px-2 min-w-[3rem] rounded-lg"
              onClick={cycleSpeed}
              disabled={!ready}
            >
              {playbackRate}x
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function addCaptionRegions(
  regions: import("wavesurfer.js/dist/plugins/regions.esm.js").default,
  captions: CaptionBlock[]
) {
  regions.clearRegions();
  for (const cap of captions) {
    regions.addRegion({
      start: cap.start_ms / 1000,
      end: cap.end_ms / 1000,
      color: "rgba(59, 130, 246, 0.14)",
      drag: false,
      resize: false,
    });
  }
}
