"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, AlertTriangle, Undo2, Redo2, Save, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  onEdit,
}: {
  caption: CaptionBlock;
  lectureId: string;
  isActive: boolean;
  showDiff: boolean;
  onEdit?: (entry: UndoEntry) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const editRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const seekTo = useAppStore((s) => s.seekTo);
  const setReviewedAt = useAppStore((s) => s.setReviewedAt);
  const rowRef = useRef<HTMLDivElement>(null);

  const prevTextRef = useRef("");
  const updateMutation = useMutation({
    mutationFn: (text: string) => {
      prevTextRef.current = caption.cleaned_text || caption.original_text;
      return api.captions.update(lectureId, caption.id, text);
    },
    onSuccess: (_data, text) => {
      queryClient.invalidateQueries({ queryKey: ["captions", lectureId] });
      setEditing(false);
      setReviewedAt(null);
      onEdit?.({
        captionId: caption.id,
        previousText: prevTextRef.current,
        newText: text,
      });
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

  const displayText = caption.cleaned_text || caption.original_text;
  const hasChanges = caption.cleaned_text && caption.cleaned_text !== caption.original_text;

  const handleSave = () => {
    const text = editRef.current?.innerText?.trim() ?? "";
    if (text && text !== displayText) {
      updateMutation.mutate(text);
    } else {
      setEditing(false);
    }
  };

  const handleRowClick = () => {
    if (!editing) seekTo(caption.start_ms);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditText(displayText);
    setEditing(true);
  };

  const lowConf = caption.min_confidence < 0.7;
  const medConf = caption.min_confidence >= 0.7 && caption.min_confidence < 0.85;

  return (
    <div
      ref={rowRef}
      className={`group flex gap-3 p-3 rounded-lg transition-colors cursor-pointer ${
        isActive
          ? "bg-primary/10 border border-primary/30 shadow-sm"
          : "hover:bg-muted/50"
      } ${lowConf ? "border-l-2 border-l-red-400" : medConf ? "border-l-2 border-l-yellow-400" : ""}`}
      onClick={handleRowClick}
    >
      <div className="flex-shrink-0 w-16 text-right pt-0.5">
        <span className="text-xs text-muted-foreground font-mono">
          <Clock className="w-3 h-3 inline mr-0.5" />
          {formatTime(caption.start_ms)}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        {editing ? (
          <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
            <div
              ref={editRef}
              contentEditable
              suppressContentEditableWarning
              className="text-sm p-2 rounded-md border border-primary/40 bg-background focus:outline-none focus:ring-2 focus:ring-ring min-h-[2.5rem] whitespace-pre-wrap"
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
              {editText}
            </div>
            <div className="flex gap-2 text-[10px] text-muted-foreground">
              <span>Enter to save</span>
              <span>Esc to cancel</span>
              <span>Shift+Enter for newline</span>
            </div>
          </div>
        ) : (
          <div onDoubleClick={handleDoubleClick}>
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

      <div className="flex-shrink-0 flex items-start gap-1">
        {lowConf && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" />
            Review
          </Badge>
        )}
        {medConf && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-yellow-500 text-yellow-600 dark:text-yellow-400 gap-0.5">
            <AlertTriangle className="w-2.5 h-2.5" />
            Check
          </Badge>
        )}
        {caption.speaker && (
          <Badge variant="outline" className="text-xs opacity-0 group-hover:opacity-100 transition-opacity">
            {caption.speaker}
          </Badge>
        )}
      </div>
    </div>
  );
}

interface UndoEntry {
  captionId: string;
  previousText: string;
  newText: string;
}

export function CaptionEditor({ lectureId }: { lectureId: string }) {
  const showDiff = useAppStore((s) => s.showDiff);
  const toggleDiff = useAppStore((s) => s.toggleDiff);
  const activeCaptionId = useAppStore((s) => s.activeCaptionId);
  const seekTo = useAppStore((s) => s.seekTo);
  const wavesurfer = useAppStore((s) => s.wavesurfer);
  const queryClient = useQueryClient();

  const [undoStack, setUndoStack] = useState<UndoEntry[]>([]);
  const [redoStack, setRedoStack] = useState<UndoEntry[]>([]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSpeakerRename, setShowSpeakerRename] = useState(false);
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["captions", lectureId],
    queryFn: () => api.captions.get(lectureId),
  });

  const pushUndo = useCallback((entry: UndoEntry) => {
    setUndoStack((prev) => [...prev.slice(-49), entry]);
    setRedoStack([]);
    setLastSaved(new Date());
  }, []);

  const undoMutation = useMutation({
    mutationFn: ({ captionId, text }: { captionId: string; text: string }) =>
      api.captions.update(lectureId, captionId, text),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["captions", lectureId] }),
  });

  const handleUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const last = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setRedoStack((prev) => [...prev, last]);
    undoMutation.mutate({ captionId: last.captionId, text: last.previousText });
  }, [undoStack, undoMutation]);

  const handleRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, -1));
    setUndoStack((prev) => [...prev, last]);
    undoMutation.mutate({ captionId: last.captionId, text: last.newText });
  }, [redoStack, undoMutation]);

  const renameMutation = useMutation({
    mutationFn: async () => {
      if (!data?.captions) return;
      const matching = data.captions.filter(
        (c) => c.speaker === renameFrom
      );
      for (const cap of matching) {
        const text = (cap.cleaned_text || cap.original_text).replace(
          new RegExp(`>> ${renameFrom}:`, "g"),
          `>> ${renameTo}:`
        );
        await api.captions.update(lectureId, cap.id, text);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["captions", lectureId] });
      setShowSpeakerRename(false);
      setRenameFrom("");
      setRenameTo("");
      toast.success(`Renamed "${renameFrom}" to "${renameTo}" across all captions`);
    },
  });

  const handleKeyboard = useCallback(
    (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
        return;
      }

      const tag = (e.target as HTMLElement)?.tagName;
      const isEditable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === "TEXTAREA" || tag === "INPUT" || isEditable) return;

      if (e.code === "Space") {
        e.preventDefault();
        wavesurfer?.playPause();
      }
      if (e.code === "ArrowLeft") {
        e.preventDefault();
        if (wavesurfer) {
          const dur = wavesurfer.getDuration();
          const cur = wavesurfer.getCurrentTime();
          wavesurfer.seekTo(Math.max(0, cur - 5) / dur);
        }
      }
      if (e.code === "ArrowRight") {
        e.preventDefault();
        if (wavesurfer) {
          const dur = wavesurfer.getDuration();
          const cur = wavesurfer.getCurrentTime();
          wavesurfer.seekTo(Math.min(dur, cur + 5) / dur);
        }
      }
      if (e.code === "ArrowUp" && data?.captions) {
        e.preventDefault();
        const captions = data.captions;
        const idx = captions.findIndex((c) => c.id === activeCaptionId);
        if (idx > 0) seekTo(captions[idx - 1].start_ms);
      }
      if (e.code === "ArrowDown" && data?.captions) {
        e.preventDefault();
        const captions = data.captions;
        const idx = captions.findIndex((c) => c.id === activeCaptionId);
        if (idx < captions.length - 1) seekTo(captions[idx + 1].start_ms);
      }
    },
    [wavesurfer, data, activeCaptionId, seekTo, handleUndo, handleRedo]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyboard);
    return () => window.removeEventListener("keydown", handleKeyboard);
  }, [handleKeyboard]);

  if (isLoading || !data) {
    return (
      <div className="glass rounded-2xl p-6">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-muted/50 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const lowConfCount = data.captions.filter((c) => c.min_confidence < 0.85).length;
  const speakers = [...new Set(data.captions.map((c) => c.speaker).filter(Boolean))] as string[];

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-lg font-semibold">
            Caption Editor
            <span className="text-sm font-normal text-muted-foreground ml-2">
              {data.captions.length} captions
            </span>
            {lowConfCount > 0 && (
              <span className="text-sm font-normal text-yellow-600 dark:text-yellow-400 ml-2">
                · {lowConfCount} need review
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            {lastSaved && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Save className="w-3 h-3" />
                Saved {lastSaved.toLocaleTimeString()}
              </span>
            )}
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7"
                onClick={handleUndo}
                disabled={undoStack.length === 0}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="w-7 h-7"
                onClick={handleRedo}
                disabled={redoStack.length === 0}
                title="Redo (Ctrl+Shift+Z)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </Button>
            </div>
            {speakers.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSpeakerRename(true)}
              >
                <Users className="w-3.5 h-3.5 mr-1" />
                Rename Speaker
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={toggleDiff}>
              {showDiff ? "Hide" : "Show"} Changes
            </Button>
          </div>
        </div>
      </div>

      {/* Batch speaker rename inline panel */}
      {showSpeakerRename && (
        <div className="border-b px-5 py-3 flex items-end gap-3 flex-wrap bg-muted/30">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">From</label>
            <select
              className="h-8 rounded-md border bg-background px-2 text-sm"
              value={renameFrom}
              onChange={(e) => setRenameFrom(e.target.value)}
            >
              <option value="">Select speaker</option>
              {speakers.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">To</label>
            <input
              className="h-8 rounded-md border bg-background px-2 text-sm w-40"
              placeholder="e.g. Prof. Frid"
              value={renameTo}
              onChange={(e) => setRenameTo(e.target.value)}
            />
          </div>
          <Button
            size="sm"
            onClick={() => renameMutation.mutate()}
            disabled={!renameFrom || !renameTo || renameMutation.isPending}
          >
            Rename All
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setShowSpeakerRename(false)}>
            Cancel
          </Button>
        </div>
      )}

      <div className="p-0">
        <ScrollArea className="h-[600px]">
          <div className="p-3 space-y-0.5">
            {data.captions.map((cap) => (
              <CaptionRow
                key={cap.id}
                caption={cap}
                lectureId={lectureId}
                isActive={activeCaptionId === cap.id}
                showDiff={showDiff}
                onEdit={pushUndo}
              />
            ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
