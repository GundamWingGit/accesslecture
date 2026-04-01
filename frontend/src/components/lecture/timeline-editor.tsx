"use client";

import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAppStore } from "@/lib/store";
import { MediaPlayer } from "./media-player";
import { FilmstripTimeline } from "./filmstrip-timeline";
import type { Lecture, CaptionBlock } from "@/lib/api";

function formatTimecode(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface TimelineEditorProps {
  lecture: Lecture;
  captions?: CaptionBlock[];
}

export function TimelineEditor({ lecture, captions }: TimelineEditorProps) {
  const currentTimeMs = useAppStore((s) => s.currentTimeMs);
  const isPlaying = useAppStore((s) => s.isPlaying);
  const playbackRate = useAppStore((s) => s.playbackRate);
  const setPlaybackRate = useAppStore((s) => s.setPlaybackRate);
  const togglePlay = useAppStore((s) => s.togglePlay);
  const seekTo = useAppStore((s) => s.seekTo);
  const [muted, setMuted] = useState(false);

  const hasVideo = !!lecture.video_url;
  const durationMs = (lecture.duration_seconds ?? 0) * 1000;

  const handleToggleMute = useCallback(() => {
    const ws = useAppStore.getState().wavesurfer;
    if (ws) ws.setVolume(muted ? 1 : 0);
    const vid = useAppStore.getState().videoElement;
    if (vid) vid.muted = !muted;
    setMuted(!muted);
  }, [muted]);

  const cycleSpeed = useCallback(() => {
    const idx = SPEED_OPTIONS.indexOf(playbackRate);
    const next = SPEED_OPTIONS[(idx + 1) % SPEED_OPTIONS.length];
    setPlaybackRate(next);
  }, [playbackRate, setPlaybackRate]);

  return (
    <div className="space-y-2">
      {hasVideo && lecture.video_url && (
        <FilmstripTimeline
          lectureId={lecture.id}
          videoUrl={lecture.video_url}
          durationMs={durationMs}
          captions={captions}
        />
      )}

      {lecture.audio_url && (
        <MediaPlayer lecture={lecture} captions={captions} hideTransport />
      )}

      <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
        <span className="text-xs font-mono text-muted-foreground w-20 text-right tabular-nums">
          {formatTimecode(currentTimeMs)}
        </span>

        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl" onClick={() => seekTo(Math.max(0, currentTimeMs - 5000))}>
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            size="icon"
            className="w-11 h-11 rounded-full btn-gradient shadow-md"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl" onClick={() => seekTo(currentTimeMs + 5000)}>
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        <span className="text-xs font-mono text-muted-foreground w-20 tabular-nums">
          {formatTimecode(durationMs)}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="w-8 h-8 rounded-xl" onClick={handleToggleMute}>
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-xs font-mono h-7 px-2 min-w-[3rem] rounded-lg"
            onClick={cycleSpeed}
          >
            {playbackRate}x
          </Button>
        </div>
      </div>
    </div>
  );
}
