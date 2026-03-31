"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  FileText,
  Subtitles,
  FileJson,
  ShieldCheck,
  ShieldAlert,
  Package,
  Film,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";

const FORMATS = [
  {
    id: "vtt",
    name: "WebVTT (.vtt)",
    description: "Standard web caption format. Works with HTML5 video players and most LMS platforms.",
    icon: Subtitles,
    compliance: "WCAG 2.1 / Section 508",
  },
  {
    id: "srt",
    name: "SubRip (.srt)",
    description: "Widely compatible subtitle format. Works with VLC, YouTube, and most video editors.",
    icon: Subtitles,
    compliance: "Universal",
  },
  {
    id: "txt",
    name: "Transcript (.txt)",
    description: "Plain text transcript with speaker labels. Useful for study materials and searchability.",
    icon: FileText,
    compliance: "WCAG 1.2.1",
  },
  {
    id: "canvas",
    name: "Canvas Package (.zip)",
    description: "Complete accessibility package for Canvas LMS: captions, transcript, and compliance report.",
    icon: FileJson,
    compliance: "Canvas LMS Ready",
  },
];

export function ExportPanel({ lectureId }: { lectureId: string }) {
  const reviewedAt = useAppStore((s) => s.reviewedAt);
  const setReviewedAt = useAppStore((s) => s.setReviewedAt);
  const queryClient = useQueryClient();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [packageProgress, setPackageProgress] = useState<number | null>(null);

  const { data: lecture } = useQuery({
    queryKey: ["lecture", lectureId],
    queryFn: () => api.lectures.get(lectureId),
  });

  const confirmMutation = useMutation({
    mutationFn: () => api.lectures.confirmReview(lectureId),
    onSuccess: (data) => {
      setReviewedAt(data.reviewed_at);
      queryClient.invalidateQueries({ queryKey: ["lecture", lectureId] });
      toast.success("Captions confirmed as reviewed");
    },
  });

  const isReviewed = !!reviewedAt;
  const hasVideo = !!lecture?.video_url;

  const handleDownload = async (format: string) => {
    if (!isReviewed) {
      setConfirmOpen(true);
      return;
    }
    const urlBuilders: Record<string, () => Promise<string>> = {
      vtt: () => api.export.vtt(lectureId),
      srt: () => api.export.srt(lectureId),
      txt: () => api.export.txt(lectureId),
      canvas: () => api.export.canvas(lectureId),
    };
    const url = await urlBuilders[format]();
    window.open(url, "_blank");
  };

  const handleCompletePackage = useCallback(async () => {
    if (!isReviewed) { setConfirmOpen(true); return; }
    try {
      setPackageProgress(5);
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      setPackageProgress(10);
      const [vttUrl, srtUrl, txtUrl] = await Promise.all([
        api.export.vtt(lectureId),
        api.export.srt(lectureId),
        api.export.txt(lectureId),
      ]);

      setPackageProgress(20);
      const [vttRes, srtRes, txtRes] = await Promise.all([
        fetch(vttUrl).then(r => r.text()),
        fetch(srtUrl).then(r => r.text()),
        fetch(txtUrl).then(r => r.text()),
      ]);

      const title = lecture?.title?.replace(/[^a-zA-Z0-9_-]/g, "_") || "lecture";
      zip.file(`${title}.vtt`, vttRes);
      zip.file(`${title}.srt`, srtRes);
      zip.file(`${title}_transcript.txt`, txtRes);

      setPackageProgress(40);

      if (hasVideo) {
        try {
          const { url: mediaUrl } = await api.export.videoUrl(lectureId);
          setPackageProgress(50);
          const videoRes = await fetch(mediaUrl);
          const videoBlob = await videoRes.blob();
          const ext = mediaUrl.includes(".mp4") ? ".mp4" : mediaUrl.includes(".webm") ? ".webm" : ".mp4";
          zip.file(`${title}${ext}`, videoBlob);
          setPackageProgress(80);
        } catch {
          toast.error("Could not include video file in package");
        }
      } else {
        setPackageProgress(80);
      }

      setPackageProgress(90);
      const blob = await zip.generateAsync({ type: "blob" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${title}_complete_package.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
      setPackageProgress(100);
      toast.success("Complete package downloaded!");
    } catch (e) {
      console.error("Package download failed:", e);
      toast.error("Failed to create package");
    } finally {
      setTimeout(() => setPackageProgress(null), 1500);
    }
  }, [isReviewed, lectureId, lecture?.title, hasVideo]);

  return (
    <div className="glass rounded-2xl overflow-hidden">
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-lg font-semibold">Export</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Download your accessible lecture assets in various formats.
            </p>
          </div>
          {isReviewed ? (
            <div className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
              <ShieldCheck className="w-4 h-4" />
              <span className="font-medium">Reviewed</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-sm text-yellow-600 dark:text-yellow-400">
              <ShieldAlert className="w-4 h-4" />
              <span className="font-medium">Not reviewed</span>
            </div>
          )}
        </div>
      </div>
      <div className="px-5 pb-5 space-y-4">
        {!isReviewed && (
          <div className="rounded-lg border border-yellow-300 dark:border-yellow-700 bg-yellow-50 dark:bg-yellow-900/20 p-4">
            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Review required before export
            </p>
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 mb-3">
              For legal compliance, you must confirm that you have reviewed the captions
              before exporting. This ensures accuracy and accountability.
            </p>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger>
                <ShieldCheck className="w-3.5 h-3.5 mr-1.5 inline" />
                I have reviewed these captions
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Caption Review</AlertDialogTitle>
                  <AlertDialogDescription>
                    By confirming, you acknowledge that you have reviewed the captions for
                    accuracy. This unlocks exports and creates an audit trail for
                    accessibility compliance. If you edit captions later, you will need to
                    re-confirm.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                  >
                    Confirm Review
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FORMATS.map((fmt) => {
            const Icon = fmt.icon;
            return (
              <div
                key={fmt.id}
                className={`glass-subtle rounded-xl p-4 space-y-3 transition-all duration-200 ${
                  isReviewed ? "hover:scale-[1.01]" : "opacity-60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="font-medium text-sm">{fmt.name}</h4>
                    <p className="text-xs text-muted-foreground">{fmt.compliance}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{fmt.description}</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full rounded-lg"
                  onClick={() => handleDownload(fmt.id)}
                  disabled={!isReviewed}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download
                </Button>
              </div>
            );
          })}
        </div>

        {isReviewed && (
          <div className="border-t border-border/50 pt-4 space-y-3">
            <h4 className="text-sm font-semibold">Complete Package</h4>
            <div className="glass-subtle rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Package className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h4 className="font-medium text-sm">
                    {hasVideo ? "Video + Captions + Transcript" : "Captions + Transcript"}
                  </h4>
                  <p className="text-xs text-muted-foreground">
                    Everything in one ZIP
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {hasVideo
                  ? "Original video file with VTT captions, SRT subtitles, and plain text transcript bundled together."
                  : "VTT captions, SRT subtitles, and plain text transcript bundled together."}
              </p>
              {packageProgress !== null && (
                <div className="space-y-1">
                  <Progress value={packageProgress} className="h-1.5" />
                  <p className="text-xs text-muted-foreground font-mono">{Math.round(packageProgress)}%</p>
                </div>
              )}
              <Button
                className="w-full rounded-lg btn-gradient"
                onClick={handleCompletePackage}
                disabled={packageProgress !== null}
              >
                {packageProgress !== null ? (
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : hasVideo ? (
                  <Film className="w-3.5 h-3.5 mr-1.5" />
                ) : (
                  <Package className="w-3.5 h-3.5 mr-1.5" />
                )}
                Download Complete Package
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
