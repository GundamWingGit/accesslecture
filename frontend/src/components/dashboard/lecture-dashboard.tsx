"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Upload,
  FileAudio,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api, type Lecture } from "@/lib/api";

interface LectureDashboardProps {
  onSelect: (id: string) => void;
  onUpload: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof CheckCircle2 }> = {
  completed: { label: "Completed", variant: "default", icon: CheckCircle2 },
  transcribing: { label: "Transcribing", variant: "secondary", icon: Loader2 },
  diarizing: { label: "Identifying Speakers", variant: "secondary", icon: Loader2 },
  cleaning: { label: "AI Cleanup", variant: "secondary", icon: Loader2 },
  scoring: { label: "Scoring", variant: "secondary", icon: Loader2 },
  uploaded: { label: "Queued", variant: "outline", icon: Clock },
  failed: { label: "Failed", variant: "destructive", icon: AlertCircle },
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function LectureCard({
  lecture,
  onClick,
}: {
  lecture: Lecture;
  onClick: () => void;
}) {
  const config = STATUS_CONFIG[lecture.status] || STATUS_CONFIG.uploaded;
  const Icon = config.icon;
  const isProcessing = ["transcribing", "diarizing", "cleaning", "scoring"].includes(lecture.status);

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow"
      onClick={onClick}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <FileAudio className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <h3 className="font-medium truncate">{lecture.title}</h3>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                <span>{formatDuration(lecture.duration_seconds)}</span>
                <span>{formatDate(lecture.created_at)}</span>
              </div>
            </div>
          </div>
          <Badge variant={config.variant} className="flex-shrink-0">
            <Icon className={`w-3 h-3 mr-1 ${isProcessing ? "animate-spin" : ""}`} />
            {config.label}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

export function LectureDashboard({ onSelect, onUpload }: LectureDashboardProps) {
  const { data: lectures, isLoading } = useQuery({
    queryKey: ["lectures"],
    queryFn: api.lectures.list,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lectures || lectures.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
          <FileAudio className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-semibold mb-2">No lectures yet</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Upload a lecture recording to get started. We&apos;ll transcribe it,
          generate compliant captions, and score its accessibility.
        </p>
        <Button onClick={onUpload} size="lg">
          <Upload className="w-4 h-4 mr-2" />
          Upload Your First Lecture
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold">Your Lectures</h2>
        <span className="text-sm text-muted-foreground">
          {lectures.length} lecture{lectures.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="grid gap-3">
        {lectures.map((lecture) => (
          <LectureCard
            key={lecture.id}
            lecture={lecture}
            onClick={() => onSelect(lecture.id)}
          />
        ))}
      </div>
    </div>
  );
}
