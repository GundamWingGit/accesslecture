"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, AlertCircle, Wrench } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-14 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!issues || issues.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-3">
            <Wrench className="w-6 h-6 text-green-500" />
          </div>
          <p className="font-medium">No issues found</p>
          <p className="text-sm text-muted-foreground mt-1">
            All captions pass compliance checks.
          </p>
        </CardContent>
      </Card>
    );
  }

  const grouped = issues.reduce<Record<string, typeof issues>>((acc, issue) => {
    const key = issue.type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(issue);
    return acc;
  }, {});

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          Issues
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {issues.length} found
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="p-4 space-y-6">
            {Object.entries(grouped).map(([type, typeIssues]) => (
              <div key={type}>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Badge variant="outline">{TYPE_LABELS[type] || type}</Badge>
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
                        className={`flex items-start gap-3 p-3 rounded-lg ${config.bg}`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                        <div className="min-w-0">
                          <p className="text-sm">{issue.message}</p>
                          {issue.auto_fixable && (
                            <span className="text-xs text-muted-foreground mt-1 inline-block">
                              Auto-fixable
                            </span>
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
      </CardContent>
    </Card>
  );
}
