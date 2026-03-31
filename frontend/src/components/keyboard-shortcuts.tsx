"use client";

import { useCallback, useEffect, useState } from "react";
import { Keyboard, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const SHORTCUTS = [
  { keys: ["Space"], description: "Play / Pause" },
  { keys: ["←"], description: "Rewind 5 seconds" },
  { keys: ["→"], description: "Forward 5 seconds" },
  { keys: ["↑"], description: "Previous caption" },
  { keys: ["↓"], description: "Next caption" },
  { keys: ["Double-click"], description: "Edit caption inline" },
  { keys: ["Enter"], description: "Save caption edit" },
  { keys: ["Escape"], description: "Cancel caption edit" },
  { keys: ["Shift", "Enter"], description: "New line in caption edit" },
  { keys: ["?"], description: "Toggle this shortcuts panel" },
];

export function KeyboardShortcuts() {
  const [open, setOpen] = useState(false);

  const handleKey = useCallback(
    (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      const editable = (e.target as HTMLElement)?.isContentEditable;
      if (tag === "TEXTAREA" || tag === "INPUT" || editable) return;

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    },
    [open]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="glass rounded-3xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Keyboard className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold">Keyboard Shortcuts</h3>
          </div>
          <Button variant="ghost" size="icon" className="w-8 h-8" onClick={() => setOpen(false)}>
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-5 space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.description} className="flex items-center justify-between py-1.5">
              <span className="text-sm text-muted-foreground">{s.description}</span>
              <div className="flex items-center gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="px-2 py-1 rounded bg-muted text-xs font-mono font-medium min-w-[1.75rem] text-center"
                  >
                    {k}
                  </kbd>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t bg-muted/30 text-center">
          <span className="text-xs text-muted-foreground">
            Press <kbd className="px-1.5 py-0.5 rounded bg-muted font-mono text-[10px]">?</kbd> to toggle
          </span>
        </div>
      </div>
    </div>
  );
}
