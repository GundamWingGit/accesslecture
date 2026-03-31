"use client";

import { useState } from "react";
import {
  Upload,
  Shield,
  LogOut,
  Loader2,
  UserCircle,
  CreditCard,
  Sparkles,
} from "lucide-react";
import { LectureDashboard } from "@/components/dashboard/lecture-dashboard";
import { UploadPanel } from "@/components/upload/upload-panel";
import { LectureDetail } from "@/components/lecture/lecture-detail";
import { LoginForm } from "@/components/auth/login-form";
import { ProfilePage } from "@/components/profile/profile-page";
import { PricingPage } from "@/components/pricing-page";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/store";

type View = "dashboard" | "upload" | "profile" | "pricing";

export default function Home() {
  const { user, loading, signOut } = useAuth();
  const currentLectureId = useAppStore((s) => s.currentLectureId);
  const [view, setView] = useState<View>("dashboard");

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/20 animate-pulse">
            <Sparkles className="w-6 h-6 text-primary-foreground" />
          </div>
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  const goHome = () => {
    useAppStore.getState().setCurrentLecture(null);
    setView("dashboard");
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Glass header */}
      <header className="glass sticky top-0 z-50 border-b-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
          <button
            onClick={goHome}
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity group"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-md shadow-primary/20 group-hover:shadow-lg group-hover:shadow-primary/30 transition-shadow">
              <Sparkles className="w-4.5 h-4.5 text-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <h1 className="text-lg font-semibold tracking-tight leading-tight gradient-text">
                AccessLecture
              </h1>
              <span className="text-[10px] text-muted-foreground leading-none hidden sm:block">
                AI-powered accessible captioning
              </span>
            </div>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground hidden sm:block truncate max-w-[160px] mr-1">
              {user.email}
            </span>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-xl"
              onClick={() => {
                useAppStore.getState().setCurrentLecture(null);
                setView("pricing");
              }}
              aria-label="Pricing"
            >
              <CreditCard className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-xl"
              onClick={() => {
                useAppStore.getState().setCurrentLecture(null);
                setView("profile");
              }}
              aria-label="Profile"
            >
              <UserCircle className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-9 h-9 rounded-xl"
              onClick={signOut}
              aria-label="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
            <Button
              onClick={() => {
                setView("upload");
                useAppStore.getState().setCurrentLecture(null);
              }}
              size="sm"
              className="ml-1 rounded-xl btn-gradient shadow-md"
            >
              <Upload className="w-4 h-4 mr-1.5" />
              <span className="hidden sm:inline">Upload Lecture</span>
              <span className="sm:hidden">Upload</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        {currentLectureId ? (
          <LectureDetail lectureId={currentLectureId} />
        ) : view === "upload" ? (
          <UploadPanel
            onComplete={(id) => {
              useAppStore.getState().setCurrentLecture(id);
              setView("dashboard");
            }}
          />
        ) : view === "profile" ? (
          <ProfilePage onBack={goHome} />
        ) : view === "pricing" ? (
          <PricingPage onBack={goHome} />
        ) : (
          <LectureDashboard
            onSelect={(id) => useAppStore.getState().setCurrentLecture(id)}
            onUpload={() => setView("upload")}
          />
        )}
      </main>

      <KeyboardShortcuts />

      <footer className="glass-subtle py-4 mt-auto border-t-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" />
            <span>WCAG 2.1 AA &middot; Section 508 &middot; ADA Title II</span>
          </div>
          <span>&copy; {new Date().getFullYear()} AccessLecture</span>
        </div>
      </footer>
    </div>
  );
}
