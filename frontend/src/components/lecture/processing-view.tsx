"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Mic, Sparkles, BarChart3, Clock, RotateCcw } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

const STAGE_ICONS: Record<string, typeof Mic> = {
  uploaded: Clock,
  transcribing: Mic,
  cleaning: Sparkles,
  scoring: BarChart3,
};

const STAGE_LABELS: Record<string, string> = {
  uploaded: "Queued",
  transcribing: "Transcribing",
  cleaning: "AI Cleanup",
  scoring: "Scoring",
};

const STAGES = ["uploaded", "transcribing", "cleaning", "scoring"];

export function ProcessingView({ lectureId }: { lectureId: string }) {
  const queryClient = useQueryClient();
  const [showReset, setShowReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const lastPctRef = useRef<number | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: progress } = useQuery({
    queryKey: ["progress", lectureId],
    queryFn: () => api.lectures.progress(lectureId),
    refetchInterval: 2000,
  });

  const pct = progress?.progress_pct ?? 0;
  const status = progress?.status ?? "uploaded";
  const message = progress?.message ?? "Waiting to start...";
  const Icon = STAGE_ICONS[status] || Loader2;
  const currentIdx = STAGES.indexOf(status);

  useEffect(() => {
    if (pct !== lastPctRef.current) {
      lastPctRef.current = pct;
      setShowReset(false);
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => setShowReset(true), 90_000);
    }
    return () => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); };
  }, [pct]);

  async function handleReset() {
    setResetting(true);
    try {
      await api.lectures.reset(lectureId);
      queryClient.invalidateQueries({ queryKey: ["progress", lectureId] });
      queryClient.invalidateQueries({ queryKey: ["lecture", lectureId] });
    } catch (e) {
      console.error("Reset failed:", e);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="glass rounded-3xl">
      <div className="p-8">
        <div className="text-center space-y-6">
          <div className="rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto w-[72px] h-[72px] shadow-lg shadow-primary/10">
            <Icon className="w-9 h-9 text-primary animate-pulse" />
          </div>

          <div>
            <h3 className="text-xl font-bold gradient-text">
              {STAGE_LABELS[status] || "Processing"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <Progress value={pct} className="h-2" />
            <p className="text-sm text-muted-foreground font-mono">{Math.round(pct)}%</p>
          </div>

          <div className="flex justify-center gap-1.5 flex-wrap">
            {STAGES.map((s, i) => {
              const StageIcon = STAGE_ICONS[s] || Loader2;
              const isActive = i === currentIdx;
              const isDone = currentIdx >= 0 && i < currentIdx;
              return (
                <div
                  key={s}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200 ${
                    isActive
                      ? "btn-gradient shadow-md"
                      : isDone
                      ? "glass-subtle text-foreground"
                      : "bg-muted/30 text-muted-foreground"
                  }`}
                >
                  <StageIcon className={`w-3 h-3 ${isActive ? "animate-pulse" : ""}`} />
                  {STAGE_LABELS[s]}
                </div>
              );
            })}
          </div>

          {showReset && (
            <button
              onClick={handleReset}
              disabled={resetting}
              className="glass px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2"
            >
              <RotateCcw className={`w-4 h-4 ${resetting ? "animate-spin" : ""}`} />
              {resetting ? "Resetting…" : "Processing seems stuck — skip to results"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
