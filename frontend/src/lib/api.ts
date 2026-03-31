const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || `API Error: ${res.status}`);
  }
  return res.json();
}

// Lecture endpoints
export const api = {
  lectures: {
    list: () => request<Lecture[]>("/lectures/"),
    get: (id: string) => request<Lecture>(`/lectures/${id}`),
    create: (data: CreateLecture) =>
      request<Lecture>("/lectures/", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    delete: (id: string) =>
      request(`/lectures/${id}`, { method: "DELETE" }),
    progress: (id: string) =>
      request<ProcessingProgress>(`/lectures/${id}/progress`),
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
        body: JSON.stringify(text),
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
    vtt: (lectureId: string, cleaned = true) =>
      `${API_BASE}/export/${lectureId}/vtt?cleaned=${cleaned}`,
    srt: (lectureId: string, cleaned = true) =>
      `${API_BASE}/export/${lectureId}/srt?cleaned=${cleaned}`,
    bundle: (lectureId: string, formats: string[]) =>
      request(`/export/${lectureId}`, {
        method: "POST",
        body: JSON.stringify({ lecture_id: lectureId, formats, use_cleaned: true }),
      }),
  },
};

// Types
export interface Lecture {
  id: string;
  title: string;
  status: string;
  audio_url: string | null;
  compliance_mode: string;
  duration_seconds: number | null;
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
