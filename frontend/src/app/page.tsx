"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { LectureDashboard } from "@/components/dashboard/lecture-dashboard";
import { UploadPanel } from "@/components/upload/upload-panel";
import { LectureDetail } from "@/components/lecture/lecture-detail";
import { useAppStore } from "@/lib/store";

export default function Home() {
  const currentLectureId = useAppStore((s) => s.currentLectureId);
  const [showUpload, setShowUpload] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <button
            onClick={() => {
              useAppStore.getState().setCurrentLecture(null);
              setShowUpload(false);
            }}
            className="flex items-center gap-2 hover:opacity-80 transition-opacity"
          >
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">AL</span>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">
              AccessLecture
            </h1>
          </button>
          <button
            onClick={() => {
              setShowUpload(true);
              useAppStore.getState().setCurrentLecture(null);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Upload className="w-4 h-4" />
            Upload Lecture
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        {currentLectureId ? (
          <LectureDetail lectureId={currentLectureId} />
        ) : showUpload ? (
          <UploadPanel
            onComplete={(id) => {
              useAppStore.getState().setCurrentLecture(id);
              setShowUpload(false);
            }}
          />
        ) : (
          <LectureDashboard
            onSelect={(id) => useAppStore.getState().setCurrentLecture(id)}
            onUpload={() => setShowUpload(true)}
          />
        )}
      </main>

      <footer className="border-t bg-card py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-muted-foreground">
          AccessLecture -- WCAG 2.1 AA / Section 508 Compliant Captioning
        </div>
      </footer>
    </div>
  );
}
