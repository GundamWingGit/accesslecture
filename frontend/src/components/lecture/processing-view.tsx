"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Mic, Users, Sparkles, BarChart3, Clock } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

const STAGE_ICONS: Record<string, typeof Mic> = {
  uploaded: Clock,
  transcribing: Mic,
  diarizing: Users,
  cleaning: Sparkles,
  scoring: BarChart3,
};

const STAGE_LABELS: Record<string, string> = {
  uploaded: "Queued",
  transcribing: "Transcribing",
  diarizing: "Speaker ID",
  cleaning: "AI Cleanup",
  scoring: "Scoring",
};

const STAGES = ["uploaded", "transcribing", "diarizing", "cleaning", "scoring"];

export function ProcessingView({ lectureId }: { lectureId: string }) {
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

  return (
    <div className="glass rounded-3xl">
      <div className="p-8">
        <div className="text-center space-y-6">
          <div className="w-18 h-18 rounded-3xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto w-[72px] h-[72px] shadow-lg shadow-primary/10">
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
        </div>
      </div>
    </div>
  );
}
