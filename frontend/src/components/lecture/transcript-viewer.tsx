"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api } from "@/lib/api";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function TranscriptViewer({ lectureId }: { lectureId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["transcript", lectureId],
    queryFn: () => api.transcript.get(lectureId),
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const speakerMap = data.speaker_map || {};

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">
          Full Transcript
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {data.segments.length} segments
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="p-4 space-y-4">
            {data.segments.map((seg) => {
              const speakerName = seg.speaker
                ? speakerMap[seg.speaker] || seg.speaker
                : null;

              return (
                <div key={seg.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-14 text-right pt-0.5">
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatTime(seg.start_ms)}
                    </span>
                  </div>
                  <div className="flex-1">
                    {speakerName && (
                      <Badge variant="secondary" className="mb-1 text-xs">
                        {speakerName}
                      </Badge>
                    )}
                    <p className="text-sm leading-relaxed">{seg.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
