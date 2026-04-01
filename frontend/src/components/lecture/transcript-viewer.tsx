"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";

function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TranscriptSegment({
  segment,
  lectureId,
  speakerName,
  isActive,
}: {
  segment: { id: string; start_ms: number; end_ms: number; text: string; speaker?: string | null };
  lectureId: string;
  speakerName: string | null;
  isActive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  const seekTo = useAppStore((s) => s.seekTo);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (text: string) => api.captions.update(lectureId, segment.id, text),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transcript", lectureId] });
      queryClient.invalidateQueries({ queryKey: ["captions", lectureId] });
      setEditing(false);
      toast.success("Segment updated");
    },
  });

  useEffect(() => {
    if (isActive && rowRef.current && !editing) {
      rowRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [isActive, editing]);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing]);

  const handleSave = useCallback(() => {
    const text = editRef.current?.innerText?.trim() ?? "";
    if (text && text !== segment.text) {
      updateMutation.mutate(text);
    } else {
      setEditing(false);
    }
  }, [segment.text, updateMutation]);

  return (
    <div
      ref={rowRef}
      className={`flex gap-3 p-3 rounded-lg transition-colors ${
        isActive ? "bg-primary/10 border border-primary/30 shadow-sm" : "hover:bg-muted/30"
      }`}
    >
      <div className="flex-shrink-0 w-14 text-right pt-0.5">
        <button
          className="text-xs text-muted-foreground font-mono hover:text-primary transition-colors cursor-pointer"
          onClick={() => seekTo(segment.start_ms)}
          title="Jump to this point"
        >
          {formatTime(segment.start_ms)}
        </button>
      </div>
      <div className="flex-1 min-w-0">
        {speakerName && (
          <Badge variant="secondary" className="mb-1 text-xs rounded-lg">
            {speakerName}
          </Badge>
        )}
        {editing ? (
          <div onClick={(e) => e.stopPropagation()}>
            <div
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              className="text-sm leading-relaxed p-2 rounded-md border border-primary/40 bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[2rem] whitespace-pre-wrap"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSave();
                }
                if (e.key === "Escape") setEditing(false);
                e.stopPropagation();
              }}
              onBlur={handleSave}
            >
              {segment.text}
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground mt-1">
              <span>Enter to save</span>
              <span>Esc to cancel</span>
            </div>
          </div>
        ) : (
          <p
            className="text-sm leading-relaxed cursor-text"
            onDoubleClick={() => setEditing(true)}
            title="Double-click to edit"
          >
            {segment.text}
          </p>
        )}
      </div>
    </div>
  );
}

export function TranscriptViewer({ lectureId }: { lectureId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["transcript", lectureId],
    queryFn: () => api.transcript.get(lectureId),
  });

  const currentTimeMs = useAppStore((s) => s.currentTimeMs);
  const activeCaptionId = useAppStore((s) => s.activeCaptionId);

  if (isLoading || !data) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const speakerMap = data.speaker_map || {};

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="text-lg font-semibold">
          Full Transcript
          <span className="text-sm font-normal text-muted-foreground ml-2">
            {data.segments.length} segments · Double-click to edit
          </span>
        </h3>
      </div>
      <div className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="p-3 space-y-0.5">
            {data.segments.map((seg) => {
              const speakerName = seg.speaker
                ? speakerMap[seg.speaker] || seg.speaker
                : null;

              const isActive = seg.id === activeCaptionId ||
                (currentTimeMs >= seg.start_ms && currentTimeMs < seg.end_ms);

              return (
                <TranscriptSegment
                  key={seg.id}
                  segment={seg}
                  lectureId={lectureId}
                  speakerName={speakerName}
                  isActive={isActive}
                />
              );
            })}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
