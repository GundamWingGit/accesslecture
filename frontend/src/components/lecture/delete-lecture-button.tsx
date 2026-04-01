"use client";

import { useState, type MouseEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api } from "@/lib/api";

type DeleteLectureButtonProps = {
  lectureId: string;
  lectureTitle: string;
  /** Stop outer click handlers (e.g. lecture card navigation) */
  stopPropagation?: boolean;
  variant?: "icon" | "inline";
  onDeleted?: () => void;
};

export function DeleteLectureButton({
  lectureId,
  lectureTitle,
  stopPropagation = false,
  variant = "icon",
  onDeleted,
}: DeleteLectureButtonProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  const handleConfirm = async () => {
    setPending(true);
    try {
      await api.lectures.delete(lectureId);
      await queryClient.invalidateQueries({ queryKey: ["lectures"] });
      await queryClient.invalidateQueries({ queryKey: ["lecture", lectureId] });
      toast.success("Lecture deleted");
      setOpen(false);
      onDeleted?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete lecture");
    } finally {
      setPending(false);
    }
  };

  const openDialog = (e: MouseEvent) => {
    if (stopPropagation) e.stopPropagation();
    setOpen(true);
  };

  return (
    <>
      {variant === "icon" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl text-muted-foreground hover:text-destructive"
          aria-label="Delete lecture"
          onClick={openDialog}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-xl border-destructive/40 text-destructive hover:bg-destructive/10"
          onClick={openDialog}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Delete lecture
        </Button>
      )}

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent size="default">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this lecture?</AlertDialogTitle>
            <AlertDialogDescription>
              &ldquo;{lectureTitle}&rdquo; and its uploaded media, captions, and scores will be
              permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              className="rounded-xl"
              disabled={pending}
              onClick={() => void handleConfirm()}
            >
              {pending ? "Deleting…" : "Delete"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
