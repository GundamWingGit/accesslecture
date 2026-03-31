"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileAudio, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
    const maxSize = 500 * 1024 * 1024; // 500MB
    if (f.size > maxSize) {
      toast.error("File too large. Maximum size is 500MB.");
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
      setStage("Extracting audio from video...");
      setProgress(5);

      const audioFile = await extractAudio(file, (p) => {
        if (p.stage === "loading") {
          setStage("Loading audio processor...");
          setProgress(5);
        } else if (p.stage === "extracting") {
          setStage("Extracting audio...");
          setProgress(5 + Math.round(p.progress * 0.4));
        }
      });

      setStage("Uploading audio...");
      setProgress(50);

      const tempId = crypto.randomUUID();
      const audioUrl = await uploadToStorage(audioFile, tempId, (pct) => {
        setProgress(50 + Math.round(pct * 0.2));
      });

      let videoUrl: string | undefined;
      if (file.type.startsWith("video/")) {
        setStage("Uploading video for slide detection...");
        setProgress(72);
        videoUrl = await uploadVideoToStorage(file, tempId);
      }

      setStage("Creating lecture record...");
      setProgress(85);

      const lecture = await api.lectures.create({
        title: title.trim(),
        audio_url: audioUrl,
        video_url: videoUrl,
        compliance_mode: "clean",
      });

      setProgress(100);
      setStage("Processing started!");
      toast.success("Lecture uploaded! Processing will begin automatically.");
      onComplete(lecture.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Upload Lecture</CardTitle>
          <CardDescription>
            Upload a video or audio recording. We&apos;ll transcribe it, add speaker
            labels, generate compliant captions, and score its accessibility.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label htmlFor="lecture-title" className="block text-sm font-medium mb-2">
              Lecture Title
            </label>
            <input
              id="lecture-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Introduction to Machine Learning - Week 3"
              className="w-full px-3 py-2 rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className={`
              border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
              ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/50"}
              ${file ? "border-primary/30 bg-primary/5" : ""}
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
                <FileAudio className="w-8 h-8 text-primary" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="p-1 rounded-full hover:bg-muted"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-lg font-medium mb-1">
                  Drop your lecture file here
                </p>
                <p className="text-sm text-muted-foreground">
                  Supports MP4, MP3, WAV, M4A, WebM, OGG, FLAC (max 500MB)
                </p>
              </>
            )}
          </div>

          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{stage}</span>
                <span className="font-medium">{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!file || !title.trim() || uploading}
            className="w-full"
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
                Upload & Process
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
