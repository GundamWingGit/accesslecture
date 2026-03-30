"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Wand2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          AI Guidance
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {score && (
          <div className="rounded-lg bg-muted/50 p-4 space-y-2">
            <p className="text-sm">
              {overall >= 95 ? (
                <>Your lecture is <strong className="text-green-600">fully compliant</strong>. Great work!</>
              ) : overall >= 80 ? (
                <>Your lecture is <strong className="text-yellow-600">{overall.toFixed(0)}% accessible</strong>. A few fixes needed.</>
              ) : overall >= 60 ? (
                <>Your lecture is <strong className="text-orange-500">{overall.toFixed(0)}% accessible</strong>. Several issues to address.</>
              ) : (
                <>Your lecture is <strong className="text-red-500">{overall.toFixed(0)}% accessible</strong>. Significant improvements needed.</>
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
                className="text-xs p-2 rounded bg-muted/50 text-muted-foreground"
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
          className="w-full"
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
      </CardContent>
    </Card>
  );
}
