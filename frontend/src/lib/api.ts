import { getSupabaseBrowser } from "@/lib/supabase";

async function getAuthToken(): Promise<string | null> {
  const sb = getSupabaseBrowser();
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = await getAuthToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options?.headers as Record<string, string>) ?? {}),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`/api${path}`, { ...options, headers });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API Error: ${res.status}`);
  }
  return res.json();
}

// Lecture endpoints
export const api = {
  lectures: {
    list: () => request<Lecture[]>("/lectures"),
    get: (id: string) => request<Lecture>(`/lectures/${id}`),
    create: (data: CreateLecture) =>
      request<Lecture>("/lectures", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request(`/lectures/${id}`, { method: "DELETE" }),
    progress: (id: string) =>
      request<ProcessingProgress>(`/lectures/${id}/progress`),
    confirmReview: (id: string) =>
      request<{ reviewed_at: string }>(`/lectures/${id}/confirm-review`, { method: "POST" }),
    reset: (id: string) =>
      request<{ status: string }>(`/lectures/${id}/reset`, { method: "POST" }),
    reprocess: (id: string) =>
      request<{ status: string }>(`/lectures/${id}/reprocess`, { method: "POST" }),
    /** If transcript exists but captions never built (phase 2 failed), run caption+score only. */
    resumeProcessing: (id: string) =>
      request<{ status: string }>(`/lectures/${id}/resume-processing`, { method: "POST" }),
  },

  transcript: {
    get: (lectureId: string) =>
      request<TranscriptData>(`/transcription/${lectureId}`),
    updateSpeakerMap: (lectureId: string, speakerMap: Record<string, string>) =>
      request(`/transcription/${lectureId}/speaker-map`, {
        method: "PUT",
        body: JSON.stringify(speakerMap),
      }),
  },

  captions: {
    get: (lectureId: string) =>
      request<CaptionsData>(`/cleanup/${lectureId}/captions`),
    update: (lectureId: string, captionId: string, text: string) =>
      request(`/cleanup/${lectureId}/captions/${captionId}`, {
        method: "PUT",
        body: JSON.stringify({ text }),
      }),
  },

  cleanup: {
    run: (data: CleanupRequest) =>
      request("/cleanup/run", { method: "POST", body: JSON.stringify(data) }),
    fixAll: (data: FixAllRequest) =>
      request("/cleanup/fix-all", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  },

  scoring: {
    run: (lectureId: string) =>
      request(`/scoring/${lectureId}/run`, { method: "POST" }),
    get: (lectureId: string) =>
      request<AccessibilityScore>(`/scoring/${lectureId}`),
    issues: (lectureId: string) =>
      request<IssueItem[]>(`/scoring/${lectureId}/issues`),
    visualRefs: (lectureId: string) =>
      request<VisualReference[]>(`/scoring/${lectureId}/visual-references`),
  },

  export: {
    vtt: async (lectureId: string, cleaned = true) => {
      const t = await getAuthToken();
      return `/api/export/${lectureId}/vtt?cleaned=${cleaned}&token=${t ?? ""}`;
    },
    srt: async (lectureId: string, cleaned = true) => {
      const t = await getAuthToken();
      return `/api/export/${lectureId}/srt?cleaned=${cleaned}&token=${t ?? ""}`;
    },
    txt: async (lectureId: string, cleaned = true) => {
      const t = await getAuthToken();
      return `/api/export/${lectureId}/txt?cleaned=${cleaned}&token=${t ?? ""}`;
    },
    canvas: async (lectureId: string, cleaned = true) => {
      const t = await getAuthToken();
      return `/api/export/${lectureId}/canvas-package?cleaned=${cleaned}&token=${t ?? ""}`;
    },
    bundle: (lectureId: string, formats: string[]) =>
      request(`/export/${lectureId}`, {
        method: "POST",
        body: JSON.stringify({ lecture_id: lectureId, formats, use_cleaned: true }),
      }),
    videoUrl: (lectureId: string) =>
      request<{ url: string }>(`/export/${lectureId}/video-url`, { method: "POST" }),
  },
  billing: {
    status: () => request<BillingStatus>("/billing/status"),
    createCheckoutSession: (successUrl: string, cancelUrl: string) =>
      request<{ url: string }>("/billing/create-checkout-session", {
        method: "POST",
        body: JSON.stringify({ success_url: successUrl, cancel_url: cancelUrl }),
      }),
    createPortalSession: (returnUrl: string) =>
      request<{ url: string }>("/billing/create-portal-session", {
        method: "POST",
        body: JSON.stringify({ return_url: returnUrl }),
      }),
  },
};

// Types
export interface Lecture {
  id: string;
  title: string;
  status: string;
  audio_url: string | null;
  video_url: string | null;
  compliance_mode: string;
  duration_seconds: number | null;
  user_id: string | null;
  reviewed_at: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface CreateLecture {
  title: string;
  audio_url: string;
  video_url?: string;
  course_id?: string;
  compliance_mode?: string;
}

export interface ProcessingProgress {
  lecture_id: string;
  status: string;
  progress_pct: number;
  message: string;
}

export interface TranscriptSegment {
  id: string;
  start_ms: number;
  end_ms: number;
  text: string;
  speaker: string | null;
  words: { word: string; start_ms: number; end_ms: number; speaker: string | null; confidence: number }[];
}

export interface TranscriptData {
  lecture_id: string;
  segments: TranscriptSegment[];
  raw_text: string;
  cleaned_text: string | null;
  speaker_map: Record<string, string>;
}

export interface CaptionBlock {
  id: string;
  sequence: number;
  start_ms: number;
  end_ms: number;
  original_text: string;
  cleaned_text: string | null;
  speaker: string | null;
  min_confidence: number;
}

export interface CaptionsData {
  lecture_id: string;
  captions: CaptionBlock[];
  compliance_mode: string;
}

export interface ScoreDimension {
  id: string;
  name: string;
  score: number;
  weight: number;
  issues: string[];
  details: Record<string, unknown>;
}

export interface AccessibilityScore {
  overall: number;
  rating: string;
  dimensions: ScoreDimension[];
}

export interface IssueItem {
  id: string;
  type: string;
  severity: string;
  caption_id: string | null;
  message: string;
  suggestion: string;
  auto_fixable: boolean;
}

export interface VisualReference {
  caption_id: string;
  text: string;
  matched_pattern: string;
  start_ms: number;
  suggestion: string;
}

export interface CleanupRequest {
  lecture_id: string;
  mode?: string;
  syllabus_context?: string;
}

export interface FixAllRequest {
  lecture_id: string;
  mode?: string;
  fix_grammar?: boolean;
  fix_formatting?: boolean;
  fix_speakers?: boolean;
  syllabus_context?: string;
}

export interface BillingStatus {
  plan: string;
  subscription_status: string;
  current_period_end: string | null;
  lectures_this_month: number;
}

