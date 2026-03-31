from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_role_key: str = ""

    redis_url: str = "redis://localhost:6379/0"

    # CORS: comma-separated exact origins; regex matches preview + production *.vercel.app
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cors_origin_regex: str = r"https://.*\.vercel\.app"

    # Optional override (Docker: /docs/compliance-rubric.json)
    compliance_rubric_path: str = ""

    # Provider selection — swap components without touching the pipeline
    transcription_provider: str = "gemini"    # future: "speech_to_text", "faster_whisper"
    visual_analysis_provider: str = "gemini"  # future: "video_intelligence"
    cleanup_provider: str = "gemini"

    # Vertex AI / Gemini settings
    use_vertex_ai: bool = True
    google_application_credentials: str = "gcp-credentials.json"
    gcp_project_id: str = ""
    gcp_location: str = "us-central1"
    google_api_key: str = ""  # fallback for non-Vertex usage
    gemini_model: str = "gemini-2.5-flash"

    enable_video_ocr: bool = True

    max_audio_duration_seconds: int = 14400  # 4 hours
    max_upload_size_mb: int = 500

    compliance_mode: str = "clean"  # "verbatim" or "clean"
    max_caption_line_length: int = 42
    max_caption_lines: int = 2
    max_reading_speed_wpm: int = 160
    sync_tolerance_ms: int = 500
    min_caption_duration_ms: int = 1333
    max_caption_duration_ms: int = 6000

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
