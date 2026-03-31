"use client";

import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { api } from "@/lib/api";

function getScoreColor(score: number): string {
  if (score >= 95) return "text-green-600 dark:text-green-400";
  if (score >= 80) return "text-yellow-600 dark:text-yellow-400";
  if (score >= 60) return "text-orange-500 dark:text-orange-400";
  return "text-red-500 dark:text-red-400";
}

function getProgressColor(score: number): string {
  if (score >= 95) return "[&>div]:bg-green-500";
  if (score >= 80) return "[&>div]:bg-yellow-500";
  if (score >= 60) return "[&>div]:bg-orange-500";
  return "[&>div]:bg-red-500";
}

export function ScoreOverview({ lectureId }: { lectureId: string }) {
  const { data: score, isLoading } = useQuery({
    queryKey: ["score", lectureId],
    queryFn: () => api.scoring.get(lectureId),
  });

  if (isLoading || !score) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted/50 rounded-lg w-1/3" />
          <div className="h-4 bg-muted/50 rounded-lg w-2/3" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-5 pb-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Accessibility Score</h3>
          <div className="text-right">
            <span className={`text-4xl font-bold ${getScoreColor(score.overall)}`}>
              {score.overall.toFixed(0)}%
            </span>
            <p className="text-sm text-muted-foreground mt-1">{score.rating}</p>
          </div>
        </div>
      </div>
      <div className="px-5 pb-5 space-y-4">
        {score.dimensions.map((dim) => (
          <div key={dim.id} className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">{dim.name}</span>
              <span className={getScoreColor(dim.score)}>
                {dim.score.toFixed(0)}%
              </span>
            </div>
            <Progress
              value={dim.score}
              className={`h-1.5 ${getProgressColor(dim.score)}`}
            />
            {dim.issues.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {dim.issues.length} issue{dim.issues.length !== 1 ? "s" : ""} found
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
