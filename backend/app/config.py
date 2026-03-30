from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    supabase_service_role_key: str = ""

    redis_url: str = "redis://localhost:6379/0"

    # Vertex AI / Gemini settings
    use_vertex_ai: bool = True
    google_application_credentials: str = "gcp-credentials.json"
    gcp_project_id: str = ""
    gcp_location: str = "us-central1"
    google_api_key: str = ""  # fallback for non-Vertex usage
    gemini_model: str = "gemini-2.5-flash"

    whisper_model_size: str = "large-v3"
    whisper_device: str = "auto"
    whisper_compute_type: str = "float16"

    hf_token: str = ""

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
