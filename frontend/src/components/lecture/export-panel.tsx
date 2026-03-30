"use client";

import { Download, FileText, Subtitles, FileJson } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

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
  const handleDownload = (format: string) => {
    const base = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
    let url: string;
    if (format === "vtt") {
      url = api.export.vtt(lectureId);
    } else if (format === "srt") {
      url = api.export.srt(lectureId);
    } else if (format === "canvas") {
      url = `${base}/export/${lectureId}/canvas-package`;
    } else {
      url = api.export.srt(lectureId);
    }
    window.open(url, "_blank");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Export</CardTitle>
        <CardDescription>
          Download your accessible lecture assets in various formats.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FORMATS.map((fmt) => {
            const Icon = fmt.icon;
            return (
              <div
                key={fmt.id}
                className="border rounded-xl p-4 space-y-3 hover:shadow-sm transition-shadow"
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
                  className="w-full"
                  onClick={() => handleDownload(fmt.id)}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  Download
                </Button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
