"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Edit3, Check, X, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api, type CaptionBlock } from "@/lib/api";
import { useAppStore } from "@/lib/store";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function CaptionRow({
  caption,
  lectureId,
  isActive,
  showDiff,
}: {
  caption: CaptionBlock;
  lectureId: string;
  isActive: boolean;
  showDiff: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const queryClient = useQueryClient();
  const setActiveCaptionId = useAppStore((s) => s.setActiveCaptionId);

  const updateMutation = useMutation({
    mutationFn: (text: string) => api.captions.update(lectureId, caption.id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captions", lectureId] });
      setEditing(false);
      toast.success("Caption updated");
    },
  });

  const displayText = caption.cleaned_text || caption.original_text;
  const hasChanges = caption.cleaned_text && caption.cleaned_text !== caption.original_text;

  return (
    <div
      className={`group flex gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
        isActive ? "bg-primary/5 border border-primary/20" : "hover:bg-muted/50"
      }`}
      onClick={() => setActiveCaptionId(caption.id)}
    >
      <div className="flex-shrink-0 w-16 text-right">
        <span className="text-xs text-muted-foreground font-mono">
          <Clock className="w-3 h-3 inline mr-0.5" />
          {formatTime(caption.start_ms)}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              className="text-sm"
              autoFocus
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => updateMutation.mutate(editText)}
                disabled={updateMutation.isPending}
              >
                <Check className="w-3 h-3 mr-1" /> Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                <X className="w-3 h-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div>
            {showDiff && hasChanges ? (
              <div className="space-y-1">
                <p className="text-sm line-through text-muted-foreground">
                  {caption.original_text}
                </p>
                <p className="text-sm text-green-700 dark:text-green-400">
                  {caption.cleaned_text}
                </p>
              </div>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{displayText}</p>
            )}
          </div>
        )}
      </div>

      <div className="flex-shrink-0 flex items-start gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {caption.speaker && (
          <Badge variant="outline" className="text-xs">
            {caption.speaker}
          </Badge>
        )}
        {!editing && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEditText(displayText);
              setEditing(true);
            }}
            className="p-1 rounded hover:bg-muted"
          >
            <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>
    </div>
  );
}

export function CaptionEditor({ lectureId }: { lectureId: string }) {
  const showDiff = useAppStore((s) => s.showDiff);
  const toggleDiff = useAppStore((s) => s.toggleDiff);
  const activeCaptionId = useAppStore((s) => s.activeCaptionId);

  const { data, isLoading } = useQuery({
    queryKey: ["captions", lectureId],
    queryFn: () => api.captions.get(lectureId),
  });

  if (isLoading || !data) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-muted rounded" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Caption Editor
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {data.captions.length} captions
            </span>
          </CardTitle>
          <Button variant="outline" size="sm" onClick={toggleDiff}>
            {showDiff ? "Hide" : "Show"} Changes
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="p-3 space-y-0.5">
            {data.captions.map((cap) => (
              <CaptionRow
                key={cap.id}
                caption={cap}
                lectureId={lectureId}
                isActive={activeCaptionId === cap.id}
                showDiff={showDiff}
              />
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
