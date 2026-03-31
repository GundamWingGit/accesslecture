"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Captions, CaptionsOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import type { Lecture, CaptionBlock } from "@/lib/api";

function formatTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatVttTime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1000);
  const frac = ms % 1000;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${frac.toString().padStart(3, "0")}`;
}

function captionsToVttBlob(captions: CaptionBlock[]): string {
  const lines = ["WEBVTT", ""];
  for (const cap of captions) {
    const text = cap.cleaned_text || cap.original_text;
    lines.push(`${formatVttTime(cap.start_ms)} --> ${formatVttTime(cap.end_ms)}`);
    lines.push(text);
    lines.push("");
  }
  const blob = new Blob([lines.join("\n")], { type: "text/vtt" });
  return URL.createObjectURL(blob);
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface VideoPlayerProps {
  lecture: Lecture;
  captions?: CaptionBlock[];
}

export function VideoPlayer({ lecture, captions }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [captionsVisible, setCaptionsVisible] = useState(true);

  const currentTimeMs = useAppStore((s) => s.currentTimeMs);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const playbackRate = useAppStore((s) => s.playbackRate);
  const seekToMs = useAppStore((s) => s.seekToMs);
  const setCurrentTimeMs = useAppStore((s) => s.setCurrentTimeMs);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setPlaybackRate = useAppStore((s) => s.setPlaybackRate);
  const setActiveCaptionId = useAppStore((s) => s.setActiveCaptionId);

  const videoUrl = lecture.video_url;

  const vttUrl = useMemo(() => {
    if (!captions?.length) return null;
    return captionsToVttBlob(captions);
  }, [captions]);

  useEffect(() => {
    return () => {
      if (vttUrl) URL.revokeObjectURL(vttUrl);
    };
  }, [vttUrl]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || seekToMs === null || seekToMs === undefined) return;
    v.currentTime = seekToMs / 1000;
  }, [seekToMs]);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const ms = Math.round(v.currentTime * 1000);
    setCurrentTimeMs(ms);
  }, [setCurrentTimeMs]);

  const captionsRef = useRef(captions);
  captionsRef.current = captions;

  useEffect(() => {
    const caps = captionsRef.current;
    if (caps) {
      const active = caps.find((c) => currentTimeMs >= c.start_ms && currentTimeMs < c.end_ms);
      if (active) setActiveCaptionId(active.id);
    }
  }, [currentTimeMs, setActiveCaptionId]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  }, []);

  const skip = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + seconds));
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
  }, [playbackRate, setPlaybackRate]);

  const toggleCaptions = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const track = v.textTracks[0];
    if (track) {
      const next = !captionsVisible;
      track.mode = next ? "showing" : "hidden";
      setCaptionsVisible(next);
    }
  }, [captionsVisible]);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="relative bg-black/80 rounded-t-2xl">
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          className="w-full aspect-video rounded-t-2xl"
          onLoadedMetadata={() => {
            setReady(true);
            setDuration((videoRef.current?.duration ?? 0) * 1000);
          }}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => setIsPlaying(false)}
          crossOrigin="anonymous"
          playsInline
        >
          {vttUrl && (
            <track
              kind="captions"
              src={vttUrl}
              srcLang="en"
              label="English"
              default
            />
          )}
        </video>
      </div>

      <div className="px-5 pb-5 pt-4 flex items-center gap-3">
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
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl" onClick={toggleCaptions} disabled={!ready}>
            {captionsVisible ? <Captions className="w-4 h-4" /> : <CaptionsOff className="w-4 h-4" />}
          </Button>
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
    </div>
  );
}
