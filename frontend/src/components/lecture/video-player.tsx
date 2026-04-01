"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Captions, CaptionsOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import type { Lecture, CaptionBlock } from "@/lib/api";

interface VideoPlayerProps {
  lecture: Lecture;
  captions?: CaptionBlock[];
}

export function VideoPlayer({ lecture, captions }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [captionsVisible, setCaptionsVisible] = useState(true);

  const seekToMs = useAppStore((s) => s.seekToMs);
  const currentTimeMs = useAppStore((s) => s.currentTimeMs);
  const playbackRate = useAppStore((s) => s.playbackRate);
  const setCurrentTimeMs = useAppStore((s) => s.setCurrentTimeMs);
  const setIsPlaying = useAppStore((s) => s.setIsPlaying);
  const setActiveCaptionId = useAppStore((s) => s.setActiveCaptionId);
  const setVideoElement = useAppStore((s) => s.setVideoElement);

  const videoUrl = lecture.video_url;

  const activeCaption = useMemo(() => {
    if (!captions?.length) return null;
    return (
      captions.find((c) => currentTimeMs >= c.start_ms && currentTimeMs < c.end_ms) ?? null
    );
  }, [captions, currentTimeMs]);

  const overlayText = activeCaption
    ? activeCaption.cleaned_text || activeCaption.original_text
    : null;

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
    if (captions?.length) {
      const active = captions.find((c) => ms >= c.start_ms && ms < c.end_ms);
      if (active) setActiveCaptionId(active.id);
    }
  }, [captions, setCurrentTimeMs, setActiveCaptionId]);

  const toggleCaptions = useCallback(() => {
    setCaptionsVisible((v) => !v);
  }, []);

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
        />

        {captionsVisible && overlayText && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex justify-center px-4 pb-14 pt-8 bg-gradient-to-t from-black/85 via-black/40 to-transparent rounded-b-2xl">
            <p
              className="max-w-[min(92%,40rem)] text-center text-sm font-medium leading-snug text-white text-balance sm:text-base"
              style={{
                textShadow:
                  "0 0 2px rgba(0,0,0,0.95), 0 1px 3px rgba(0,0,0,0.9), 0 2px 12px rgba(0,0,0,0.85)",
              }}
            >
              {overlayText}
            </p>
          </div>
        )}

        <div className="absolute bottom-3 right-3 z-20">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-lg bg-black/50 hover:bg-black/70 text-white"
            onClick={toggleCaptions}
            title={captionsVisible ? "Hide captions" : "Show captions"}
          >
            {captionsVisible ? <Captions className="w-4 h-4" /> : <CaptionsOff className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
