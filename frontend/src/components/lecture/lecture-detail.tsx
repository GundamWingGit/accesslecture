"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ArrowLeft } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import { VideoPlayer } from "./video-player";
import { TimelineEditor } from "./timeline-editor";
import { ProcessingView } from "./processing-view";
import { ScoreOverview } from "./score-overview";
import { CaptionEditor } from "./caption-editor";
import { TranscriptViewer } from "./transcript-viewer";
import { IssuesPanel } from "./issues-panel";
import { ExportPanel } from "./export-panel";
import { AIGuidancePanel } from "./ai-guidance-panel";
import { ChatPanel } from "./chat-panel";

interface LectureDetailProps {
  lectureId: string;
}

export function LectureDetail({ lectureId }: LectureDetailProps) {
  const setCurrentLecture = useAppStore((s) => s.setCurrentLecture);
  const setReviewedAt = useAppStore((s) => s.setReviewedAt);

  const { data: lecture, isLoading } = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: () => api.lectures.get(lectureId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && !["completed", "failed"].includes(status)) return 3000;
      return false;
    },
  });

  const { data: captionsData } = useQuery({
    queryKey: ["captions", lectureId],
    queryFn: () => api.captions.get(lectureId),
    enabled: lecture?.status === "completed",
  });

  useEffect(() => {
    if (lecture?.reviewed_at) setReviewedAt(lecture.reviewed_at);
    else setReviewedAt(null);
  }, [lecture?.reviewed_at, setReviewedAt]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lecture) {
    return <p className="text-center py-12 text-muted-foreground">Lecture not found.</p>;
  }

  const isProcessing = !["completed", "failed"].includes(lecture.status);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          className="rounded-xl"
          onClick={() => setCurrentLecture(null)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div>
          <h2 className="text-2xl font-bold gradient-text">{lecture.title}</h2>
          <p className="text-sm text-muted-foreground">
            {lecture.compliance_mode === "verbatim" ? "Verbatim" : "Clean"} mode
            {lecture.duration_seconds
              ? ` · ${Math.floor(lecture.duration_seconds / 60)} min`
              : ""}
          </p>
        </div>
      </div>

      {isProcessing ? (
        <ProcessingView lectureId={lectureId} />
      ) : lecture.status === "failed" ? (
        <div className="glass rounded-2xl border border-destructive/30 p-6 text-center">
          <p className="text-destructive font-medium">Processing failed</p>
          <p className="text-sm text-muted-foreground mt-1">
            Please try uploading again or contact support.
          </p>
        </div>
      ) : (
        <>
          {lecture.video_url && (
            <VideoPlayer lecture={lecture} captions={captionsData?.captions} />
          )}

          {(lecture.video_url || lecture.audio_url) && (
            <TimelineEditor lecture={lecture} captions={captionsData?.captions} />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <ScoreOverview lectureId={lectureId} />
            </div>
            <div>
              <AIGuidancePanel lectureId={lectureId} />
            </div>
          </div>

          <Tabs defaultValue="captions" className="space-y-4">
            <TabsList>
              <TabsTrigger value="captions">Captions</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="issues">Issues</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>

            <TabsContent value="captions">
              <CaptionEditor lectureId={lectureId} />
            </TabsContent>
            <TabsContent value="transcript">
              <TranscriptViewer lectureId={lectureId} />
            </TabsContent>
            <TabsContent value="issues">
              <IssuesPanel lectureId={lectureId} />
            </TabsContent>
            <TabsContent value="export">
              <ExportPanel lectureId={lectureId} />
            </TabsContent>
          </Tabs>

          <ChatPanel lectureId={lectureId} />
        </>
      )}
    </div>
  );
}
