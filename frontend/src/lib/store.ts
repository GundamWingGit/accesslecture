import { create } from "zustand";

interface AppState {
  currentLectureId: string | null;
  setCurrentLecture: (id: string | null) => void;

  audioElement: HTMLAudioElement | null;
  setAudioElement: (el: HTMLAudioElement | null) => void;

  currentTimeMs: number;
  setCurrentTimeMs: (ms: number) => void;

  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;

  activeCaptionId: string | null;
  setActiveCaptionId: (id: string | null) => void;

  editingCaptionId: string | null;
  setEditingCaptionId: (id: string | null) => void;

  showDiff: boolean;
  toggleDiff: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  currentLectureId: null,
  setCurrentLecture: (id) => set({ currentLectureId: id }),

  audioElement: null,
  setAudioElement: (el) => set({ audioElement: el }),

  currentTimeMs: 0,
  setCurrentTimeMs: (ms) => set({ currentTimeMs: ms }),

  isPlaying: false,
  setIsPlaying: (playing) => set({ isPlaying: playing }),

  activeCaptionId: null,
  setActiveCaptionId: (id) => set({ activeCaptionId: id }),

  editingCaptionId: null,
  setEditingCaptionId: (id) => set({ editingCaptionId: id }),

  showDiff: false,
  toggleDiff: () => set((s) => ({ showDiff: !s.showDiff })),
}));
