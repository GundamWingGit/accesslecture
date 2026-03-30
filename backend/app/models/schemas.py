from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime


class LectureStatus(str, Enum):
    UPLOADING = "uploading"
    UPLOADED = "uploaded"
    EXTRACTING_AUDIO = "extracting_audio"
    TRANSCRIBING = "transcribing"
    DIARIZING = "diarizing"
    CLEANING = "cleaning"
    SCORING = "scoring"
    COMPLETED = "completed"
    FAILED = "failed"


class ComplianceMode(str, Enum):
    VERBATIM = "verbatim"
    CLEAN = "clean"


class WordTimestamp(BaseModel):
    word: str
    start_ms: int
    end_ms: int
    speaker: str | None = None
    confidence: float = 0.0


class CaptionBlock(BaseModel):
    id: str
    sequence: int
    start_ms: int
    end_ms: int
    original_text: str
    cleaned_text: str | None = None
    speaker: str | None = None


class TranscriptSegment(BaseModel):
    id: str
    start_ms: int
    end_ms: int
    text: str
    speaker: str | None = None
    words: list[WordTimestamp] = []


class ScoreDimension(BaseModel):
    id: str
    name: str
    score: float = Field(ge=0, le=100)
    weight: float
    issues: list[str] = []
    details: dict = {}


class AccessibilityScore(BaseModel):
    overall: float = Field(ge=0, le=100)
    rating: str
    dimensions: list[ScoreDimension] = []


class LectureCreate(BaseModel):
    title: str
    course_id: str | None = None
    audio_url: str
    compliance_mode: ComplianceMode = ComplianceMode.CLEAN


class LectureResponse(BaseModel):
    id: str
    title: str
    status: LectureStatus
    audio_url: str | None = None
    compliance_mode: ComplianceMode
    duration_seconds: float | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class TranscriptResponse(BaseModel):
    lecture_id: str
    segments: list[TranscriptSegment]
    raw_text: str
    cleaned_text: str | None = None
    speaker_map: dict[str, str] = {}


class CaptionsResponse(BaseModel):
    lecture_id: str
    captions: list[CaptionBlock]
    compliance_mode: ComplianceMode


class ProcessingProgress(BaseModel):
    lecture_id: str
    status: LectureStatus
    progress_pct: float = 0
    message: str = ""


class CleanupRequest(BaseModel):
    lecture_id: str
    mode: ComplianceMode = ComplianceMode.CLEAN
    syllabus_context: str | None = None


class FixAllRequest(BaseModel):
    lecture_id: str
    mode: ComplianceMode = ComplianceMode.CLEAN
    fix_grammar: bool = True
    fix_formatting: bool = True
    fix_speakers: bool = True
    syllabus_context: str | None = None


class ExportFormat(str, Enum):
    VTT = "vtt"
    SRT = "srt"
    TXT = "txt"
    JSON = "json"


class ExportRequest(BaseModel):
    lecture_id: str
    formats: list[ExportFormat] = [ExportFormat.VTT, ExportFormat.SRT, ExportFormat.TXT]
    use_cleaned: bool = True


class VisualReferenceFlag(BaseModel):
    caption_id: str
    text: str
    matched_pattern: str
    start_ms: int
    suggestion: str = ""


class IssueItem(BaseModel):
    id: str
    type: str
    severity: str  # "error", "warning", "info"
    caption_id: str | None = None
    message: str
    suggestion: str = ""
    auto_fixable: bool = False
