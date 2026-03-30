"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, Mic, Users, Sparkles, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

const STAGE_ICONS: Record<string, typeof Mic> = {
  transcribing: Mic,
  diarizing: Users,
  cleaning: Sparkles,
  scoring: BarChart3,
};

const STAGE_LABELS: Record<string, string> = {
  uploaded: "Queued",
  transcribing: "Transcribing audio",
  diarizing: "Identifying speakers",
  cleaning: "AI cleanup",
  scoring: "Scoring accessibility",
};

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

  const stages = ["transcribing", "diarizing", "cleaning", "scoring"];
  const currentIdx = stages.indexOf(status);

  return (
    <Card>
      <CardContent className="p-8">
        <div className="text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Icon className="w-8 h-8 text-primary animate-pulse" />
          </div>

          <div>
            <h3 className="text-xl font-semibold">
              {STAGE_LABELS[status] || "Processing"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">{message}</p>
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <Progress value={pct} className="h-2" />
            <p className="text-sm text-muted-foreground">{Math.round(pct)}%</p>
          </div>

          <div className="flex justify-center gap-1">
            {stages.map((s, i) => {
              const StageIcon = STAGE_ICONS[s] || Loader2;
              const isActive = i === currentIdx;
              const isDone = i < currentIdx;
              return (
                <div
                  key={s}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : isDone
                      ? "bg-muted text-foreground"
                      : "bg-muted/50 text-muted-foreground"
                  }`}
                >
                  <StageIcon className={`w-3 h-3 ${isActive ? "animate-spin" : ""}`} />
                  {STAGE_LABELS[s]}
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
