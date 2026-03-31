import { create } from "zustand";
import type WaveSurfer from "wavesurfer.js";

interface AppState {
  currentLectureId: string | null;
  setCurrentLecture: (id: string | null) => void;

  wavesurfer: WaveSurfer | null;
  setWavesurfer: (ws: WaveSurfer | null) => void;

  currentTimeMs: number;
  setCurrentTimeMs: (ms: number) => void;

  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;

  playbackRate: number;
  setPlaybackRate: (rate: number) => void;

  seekTo: (ms: number) => void;

  activeCaptionId: string | null;
  setActiveCaptionId: (id: string | null) => void;

  editingCaptionId: string | null;
  setEditingCaptionId: (id: string | null) => void;

  showDiff: boolean;
  toggleDiff: () => void;

  reviewedAt: string | null;
  setReviewedAt: (ts: string | null) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  currentLectureId: null,
  setCurrentLecture: (id) => set({ currentLectureId: id }),

  wavesurfer: null,
  setWavesurfer: (ws) => set({ wavesurfer: ws }),

  currentTimeMs: 0,
  setCurrentTimeMs: (ms) => set({ currentTimeMs: ms }),

  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  playbackRate: 1,
  setPlaybackRate: (rate) => {
    const ws = get().wavesurfer;
    if (ws) ws.setPlaybackRate(rate);
    set({ playbackRate: rate });
  },

  seekTo: (ms) => {
    const ws = get().wavesurfer;
    if (ws) {
      const duration = ws.getDuration();
      if (duration > 0) ws.seekTo(ms / 1000 / duration);
    }
  },

  activeCaptionId: null,
  setActiveCaptionId: (id) => set({ activeCaptionId: id }),

  editingCaptionId: null,
  setEditingCaptionId: (id) => set({ editingCaptionId: id }),

  showDiff: false,
  toggleDiff: () => set((s) => ({ showDiff: !s.showDiff })),

  reviewedAt: null,
  setReviewedAt: (ts) => set({ reviewedAt: ts }),
}));
