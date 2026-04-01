"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Captions, CaptionsOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import type { Lecture, CaptionBlock } from "@/lib/api";

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

interface VideoPlayerProps {
  lecture: Lecture;
  captions?: CaptionBlock[];
}

export function VideoPlayer({ lecture, captions }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [captionsVisible, setCaptionsVisible] = useState(true);

  const seekToMs = useAppStore((s) => s.seekToMs);
  const playbackRate = useAppStore((s) => s.playbackRate);
  const setCurrentTimeMs = useAppStore((s) => s.setCurrentTimeMs);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setActiveCaptionId = useAppStore((s) => s.setActiveCaptionId);
  const setVideoElement = useAppStore((s) => s.setVideoElement);

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
    if (v) setVideoElement(v);
    return () => setVideoElement(null);
  }, [setVideoElement]);

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
    const interval = setInterval(() => {
      const v = videoRef.current;
      if (!v) return;
      const ms = Math.round(v.currentTime * 1000);
      const caps = captionsRef.current;
      if (caps) {
        const active = caps.find((c) => ms >= c.start_ms && ms < c.end_ms);
        if (active) setActiveCaptionId(active.id);
      }
    }, 100);
    return () => clearInterval(interval);
  }, [setActiveCaptionId]);

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
      <div className="relative bg-black/80 rounded-2xl">
        <video
          ref={videoRef}
          src={videoUrl ?? undefined}
          className="w-full aspect-video rounded-2xl"
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
        <div className="absolute bottom-3 right-3">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 text-white"
            onClick={toggleCaptions}
          >
            {captionsVisible ? <Captions className="w-4 h-4" /> : <CaptionsOff className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
