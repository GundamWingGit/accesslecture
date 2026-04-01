"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileAudio, FileVideo, X, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { extractAudio, uploadToStorage, uploadVideoToStorage } from "@/lib/audio-extractor";

interface UploadPanelProps {
  onComplete: (lectureId: string) => void;
}

export function UploadPanel({ onComplete }: UploadPanelProps) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = "audio/*,video/*,.mp3,.mp4,.m4a,.wav,.webm,.ogg,.flac";

  const handleFile = useCallback((f: File) => {
    const maxSize = 500 * 1024 * 1024;
    if (f.size > maxSize) {
      toast.error("File too large. Maximum size is 500 MB.");
      return;
    }
    setFile(f);
    if (!title) {
      setTitle(f.name.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " "));
    }
  }, [title]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) handleFile(f);
    },
    [handleFile]
  );

  const handleUpload = async () => {
    if (!file || !title.trim()) {
      toast.error("Please select a file and enter a title.");
      return;
    }

    setUploading(true);
    try {
      let audioFile: File;

      if (file.type.startsWith("audio/")) {
        audioFile = file;
        setStage("Audio file ready");
        setProgress(40);
      } else {
        setStage("Loading audio processor...");
        setProgress(5);
        try {
          audioFile = await extractAudio(file, (p) => {
            if (p.stage === "loading") {
              setStage("Loading audio processor...");
              setProgress(5);
            } else if (p.stage === "extracting") {
              setStage("Extracting audio from video...");
              setProgress(5 + Math.round(p.progress * 0.35));
            }
          });
        } catch (extractErr) {
          console.error("Audio extraction failed:", extractErr);
          toast.error("Audio extraction failed. Uploading video directly for server-side processing...");
          audioFile = file;
        }
      }

      setStage("Uploading audio...");
      setProgress(45);

      const tempId = crypto.randomUUID();
      let audioUrl: string;
      try {
        audioUrl = await uploadToStorage(audioFile, tempId, (pct) => {
          setProgress(45 + Math.round(pct * 0.15));
        });
      } catch (uploadErr) {
        console.error("Audio upload failed:", uploadErr);
        throw new Error(`Audio upload failed: ${uploadErr instanceof Error ? uploadErr.message : "Unknown error"}`);
      }

      let videoUrl: string | undefined;
      if (file.type.startsWith("video/")) {
        setStage("Uploading video...");
        setProgress(65);
        try {
          videoUrl = await uploadVideoToStorage(file, tempId);
          setProgress(80);
        } catch (videoErr) {
          console.error("Video upload failed:", videoErr);
          toast.error("Video upload failed — processing will continue with audio only");
        }
      }

      setStage("Creating lecture...");
      setProgress(85);

      const lecture = await api.lectures.create({
        title: title.trim(),
        audio_url: audioUrl,
        video_url: videoUrl,
        compliance_mode: "clean",
      });

      setProgress(100);
      setStage("Done!");
      toast.success("Lecture uploaded! Processing will begin automatically.");
      onComplete(lecture.id);
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const isVideo = file?.type.startsWith("video/");
  const FileIcon = isVideo ? FileVideo : FileAudio;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass rounded-3xl overflow-hidden">
        <div className="text-center px-6 pt-8 pb-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/10">
            <Sparkles className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-2xl font-bold gradient-text">Upload Lecture</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
            Upload a video or audio recording. We&apos;ll transcribe it, add speaker
            labels, generate compliant captions, and score its accessibility.
          </p>
        </div>

        <div className="px-6 pb-6 space-y-5">
          <div className="space-y-1.5">
            <label htmlFor="lecture-title" className="block text-sm font-medium">
              Lecture Title
            </label>
            <input
              id="lecture-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Machine Learning — Week 3"
              disabled={uploading}
              className="flex h-11 w-full rounded-xl glass-subtle px-3.5 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:glow-ring disabled:cursor-not-allowed disabled:opacity-50 transition-shadow"
            />
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => !uploading && inputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200
              ${uploading ? "pointer-events-none opacity-60" : "cursor-pointer"}
              ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border/50 hover:border-primary/40 hover:bg-primary/[0.03]"}
              ${file ? "border-primary/30 bg-primary/[0.03]" : ""}
            `}
          >
            <input
              ref={inputRef}
              type="file"
              accept={accept}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="hidden"
            />

            {file ? (
              <div className="flex items-center justify-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center flex-shrink-0">
                  <FileIcon className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left min-w-0">
                  <p className="font-medium text-sm truncate">{file.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    {isVideo && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 rounded-lg">
                        Video — slides will be detected
                      </Badge>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="p-1.5 rounded-full hover:bg-muted flex-shrink-0"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            ) : (
              <>
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-muted to-muted/50 flex items-center justify-center mx-auto mb-3">
                  <Upload className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="font-medium mb-1">
                  Drop your lecture file here
                </p>
                <p className="text-sm text-muted-foreground">
                  MP4, MP3, WAV, M4A, WebM, OGG, FLAC &middot; max 500 MB
                </p>
              </>
            )}
          </div>

          {uploading && (
            <div className="space-y-2 px-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{stage}</span>
                <span className="font-mono text-xs font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || !title.trim() || uploading}
            className="w-full h-12 rounded-xl btn-gradient text-base shadow-md"
            size="lg"
          >
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload &amp; Process
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
