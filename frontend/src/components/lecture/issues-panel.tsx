"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, AlertCircle, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";

const SEVERITY_CONFIG = {
  error: { icon: AlertCircle, color: "text-red-500", bg: "bg-red-500/10" },
  warning: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/10" },
  info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/10" },
};

const TYPE_LABELS: Record<string, string> = {
  accuracy: "Accuracy",
  synchronization: "Timing",
  completeness: "Completeness",
  speaker_identification: "Speaker ID",
  formatting: "Formatting",
  visual_accessibility: "Visual Ref",
};

export function IssuesPanel({ lectureId }: { lectureId: string }) {
  const { data: issues, isLoading } = useQuery({
    queryKey: ["issues", lectureId],
    queryFn: () => api.scoring.issues(lectureId),
  });

  if (isLoading) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 bg-muted/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!issues || issues.length === 0) {
    return (
      <div className="glass rounded-2xl p-8 text-center">
        <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto mb-3">
          <Wrench className="w-7 h-7 text-green-500" />
        </div>
        <p className="font-semibold">No issues found</p>
        <p className="text-sm text-muted-foreground mt-1">
          All captions pass compliance checks.
        </p>
      </div>
    );
  }

  const grouped = issues.reduce<Record<string, typeof issues>>((acc, issue) => {
    const key = issue.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {});

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-lg font-semibold">
          Issues
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {issues.length} found
          </span>
        </h3>
      </div>
      <div className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="p-4 space-y-6">
            {Object.entries(grouped).map(([type, typeIssues]) => (
              <div key={type}>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Badge variant="outline" className="rounded-lg">{TYPE_LABELS[type] || type}</Badge>
                  <span className="text-muted-foreground">
                    {typeIssues.length} issue{typeIssues.length !== 1 ? "s" : ""}
                  </span>
                </h4>
                <div className="space-y-2">
                  {typeIssues.map((issue) => {
                    const config = SEVERITY_CONFIG[issue.severity as keyof typeof SEVERITY_CONFIG] || SEVERITY_CONFIG.warning;
                    const Icon = config.icon;
                    return (
                      <div
                        key={issue.id}
                        className={`flex items-start gap-3 p-3 rounded-xl ${config.bg}`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm">{issue.message}</p>
                          {issue.suggestion && (
                            <p className="text-xs text-muted-foreground mt-1">
                              <span className="font-medium">Suggestion:</span> {issue.suggestion}
                            </p>
                          )}
                          {issue.auto_fixable && (
                            <Badge variant="secondary" className="text-xs mt-1.5 rounded-lg">
                              Auto-fixable
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
