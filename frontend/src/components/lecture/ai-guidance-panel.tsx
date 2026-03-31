"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Wand2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { api } from "@/lib/api";

export function AIGuidancePanel({ lectureId }: { lectureId: string }) {
  const queryClient = useQueryClient();

  const { data: score } = useQuery({
    queryKey: ["score", lectureId],
    queryFn: () => api.scoring.get(lectureId),
  });

  const { data: issues } = useQuery({
    queryKey: ["issues", lectureId],
    queryFn: () => api.scoring.issues(lectureId),
  });

  const fixAllMutation = useMutation({
    mutationFn: () =>
      api.cleanup.fixAll({
        lecture_id: lectureId,
        mode: "clean",
        fix_grammar: true,
        fix_formatting: true,
        fix_speakers: true,
      }),
    onSuccess: () => {
      toast.success("Fix All started! This may take a moment.");
      queryClient.invalidateQueries({ queryKey: ["lecture", lectureId] });
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Fix All failed");
    },
  });

  const fixableCount = issues?.filter((i) => i.auto_fixable).length ?? 0;
  const overall = score?.overall ?? 0;

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-5 pb-3">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Guidance
        </h3>
      </div>
      <div className="px-5 pb-5 space-y-4">
        {score && (
          <div className="rounded-xl glass-subtle p-4 space-y-2">
            <p className="text-sm">
              {overall >= 95 ? (
                <>Your lecture is <strong className="text-green-600 dark:text-green-400">fully compliant</strong>. Great work!</>
              ) : overall >= 80 ? (
                <>Your lecture is <strong className="text-yellow-600 dark:text-yellow-400">{overall.toFixed(0)}% accessible</strong>. A few fixes needed.</>
              ) : overall >= 60 ? (
                <>Your lecture is <strong className="text-orange-500 dark:text-orange-400">{overall.toFixed(0)}% accessible</strong>. Several issues to address.</>
              ) : (
                <>Your lecture is <strong className="text-red-500 dark:text-red-400">{overall.toFixed(0)}% accessible</strong>. Significant improvements needed.</>
              )}
            </p>
            {fixableCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {fixableCount} issue{fixableCount !== 1 ? "s" : ""} can be auto-fixed.
              </p>
            )}
          </div>
        )}

        {issues && issues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Top Issues</h4>
            {issues.slice(0, 3).map((issue) => (
              <div
                key={issue.id}
                className="text-xs p-2.5 rounded-xl glass-subtle text-muted-foreground"
              >
                {issue.message}
              </div>
            ))}
            {issues.length > 3 && (
              <p className="text-xs text-muted-foreground">
                +{issues.length - 3} more issues
              </p>
            )}
          </div>
        )}

        <Button
          className="w-full rounded-xl btn-gradient shadow-md"
          onClick={() => fixAllMutation.mutate()}
          disabled={fixAllMutation.isPending || overall >= 95}
        >
          {fixAllMutation.isPending ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Fixing...
            </>
          ) : (
            <>
              <Wand2 className="w-4 h-4 mr-2" />
              Fix All Issues
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
