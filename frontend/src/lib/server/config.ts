function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

function envBool(key: string, fallback = false): boolean {
  const v = process.env[key];
  if (!v) return fallback;
  return v === "true" || v === "1";
}

function envInt(key: string, fallback: number): number {
  const v = process.env[key];
  return v ? parseInt(v, 10) : fallback;
}

export const config = {
  supabaseUrl: env("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: env("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY"),

  useVertexAi: envBool("USE_VERTEX_AI", true),
  googleApplicationCredentials: env("GOOGLE_APPLICATION_CREDENTIALS"),
  googleCredentialsJson: env("GOOGLE_CREDENTIALS_JSON"),
  gcpProjectId: env("GCP_PROJECT_ID"),
  gcpLocation: env("GCP_LOCATION", "us-central1"),
  googleApiKey: env("GOOGLE_API_KEY"),
  geminiModel: env("GEMINI_MODEL", "gemini-2.5-flash"),

  enableVideoOcr: envBool("ENABLE_VIDEO_OCR", true),
  /** Beyond this duration (seconds), use sampled JPEG frames instead of sending the full video to Gemini (avoids multi-hour stalls). */
  visualFullVideoMaxSeconds: envInt("VISUAL_FULL_VIDEO_MAX_SECONDS", 600),
  /** Number of evenly spaced frames for long-video slide text detection. */
  visualSampleFrameCount: envInt("VISUAL_SAMPLE_FRAME_COUNT", 18),
  /** Max time for one visual-analysis Gemini call (ms). */
  visualAnalysisTimeoutMs: envInt("VISUAL_ANALYSIS_TIMEOUT_MS", 240_000),
  complianceMode: env("COMPLIANCE_MODE", "clean"),

  maxCaptionLineLength: envInt("MAX_CAPTION_LINE_LENGTH", 42),
  maxCaptionLines: envInt("MAX_CAPTION_LINES", 2),
  maxReadingSpeedWpm: envInt("MAX_READING_SPEED_WPM", 160),
  syncToleranceMs: envInt("SYNC_TOLERANCE_MS", 500),
  minCaptionDurationMs: envInt("MIN_CAPTION_DURATION_MS", 1333),
  maxCaptionDurationMs: envInt("MAX_CAPTION_DURATION_MS", 6000),

  stripeSecretKey: env("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: env("STRIPE_WEBHOOK_SECRET"),
  stripeProPriceId: env("STRIPE_PRO_PRICE_ID"),
  stripePortalReturnUrl: env("STRIPE_PORTAL_RETURN_URL", "https://accesslecture.com"),

  freeLecturesPerMonth: envInt("FREE_LECTURES_PER_MONTH", 3),

  /** Long audio: chunk size (seconds) per Gemini call. */
  transcribeChunkSec: envInt("TRANSCRIBE_CHUNK_SEC", 480),
  /**
   * Overlap between consecutive chunks (seconds). Merged so the overlap band is not duplicated.
   * Typical 10–30s once merge exists; default 15.
   */
  transcribeChunkOverlapSec: envInt("TRANSCRIBE_CHUNK_OVERLAP_SEC", 15),
  /** If adjacent segments differ by more than this (seconds), run an optional gap-fill pass. */
  transcribeGapThresholdSec: envInt("TRANSCRIBE_GAP_THRESHOLD_SEC", 45),
  /** Run targeted re-transcription for large gaps (uses extra Gemini calls). */
  transcribeGapFillEnabled: envBool("TRANSCRIBE_GAP_FILL_ENABLED", true),
  /** Max length (seconds) of a single gap-fill extract. */
  transcribeGapFillMaxSec: envInt("TRANSCRIBE_GAP_FILL_MAX_SEC", 300),

  /**
   * Tier B (not implemented): use Google Cloud Speech-to-Text batch as primary transcript.
   * When true, transcribe() throws until STT is wired; keep false.
   */
  speechToTextPrimary: envBool("SPEECH_TO_TEXT_PRIMARY", false),

  /**
   * Shared secret for POST /api/internal/pipeline-continue (phase 2 after transcription).
   * Required on Vercel so captions+scoring run in a second serverless invocation (extra 800s budget).
   */
  pipelineInternalSecret: env("PIPELINE_INTERNAL_SECRET"),
} as const;
