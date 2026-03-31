from app.config import get_settings
from app.models.schemas import TranscriptSegment, CaptionBlock


class CaptionFormatter:
    """Generates compliant caption files from transcript segments."""

    def __init__(self):
        settings = get_settings()
        self.max_line_length = settings.max_caption_line_length
        self.max_lines = settings.max_caption_lines
        self.max_reading_speed_wpm = settings.max_reading_speed_wpm
        self.min_duration_ms = settings.min_caption_duration_ms
        self.max_duration_ms = settings.max_caption_duration_ms

    def segments_to_captions(
        self,
        segments: list[TranscriptSegment],
        speaker_map: dict[str, str] | None = None,
    ) -> list[CaptionBlock]:
        """Convert transcript segments into compliant caption blocks."""
        captions: list[CaptionBlock] = []
        sequence = 0

        for seg in segments:
            text = seg.text
            speaker_label = None
            if seg.speaker:
                display_name = (speaker_map or {}).get(seg.speaker, seg.speaker)
                speaker_label = display_name

            seg_min_conf = min((w.confidence for w in seg.words), default=0.92) if seg.words else 0.92
            chunks = self._split_into_caption_chunks(text)

            if not chunks:
                continue

            if len(chunks) == 1:
                sequence += 1
                prefix = f">> {speaker_label}: " if speaker_label else ""
                captions.append(CaptionBlock(
                    id=f"cap-{sequence}",
                    sequence=sequence,
                    start_ms=seg.start_ms,
                    end_ms=seg.end_ms,
                    original_text=prefix + chunks[0],
                    speaker=seg.speaker,
                    min_confidence=seg_min_conf,
                ))
            else:
                total_duration = seg.end_ms - seg.start_ms
                total_chars = sum(len(c) for c in chunks)

                current_start = seg.start_ms
                for i, chunk in enumerate(chunks):
                    chunk_ratio = len(chunk) / total_chars if total_chars > 0 else 1 / len(chunks)
                    chunk_duration = int(total_duration * chunk_ratio)
                    chunk_duration = max(self.min_duration_ms, min(self.max_duration_ms, chunk_duration))
                    chunk_end = min(current_start + chunk_duration, seg.end_ms)

                    sequence += 1
                    prefix = ""
                    if i == 0 and speaker_label:
                        prefix = f">> {speaker_label}: "

                    captions.append(CaptionBlock(
                        id=f"cap-{sequence}",
                        sequence=sequence,
                        start_ms=current_start,
                        end_ms=chunk_end,
                        original_text=prefix + chunk,
                        speaker=seg.speaker,
                        min_confidence=seg_min_conf,
                    ))
                    current_start = chunk_end

        return captions

    def _split_into_caption_chunks(self, text: str) -> list[str]:
        """Split text into chunks of max 2 lines x max_line_length characters."""
        if not text.strip():
            return []

        words = text.split()
        chunks = []
        current_lines: list[str] = []
        current_line = ""

        for word in words:
            test_line = f"{current_line} {word}".strip()

            if len(test_line) <= self.max_line_length:
                current_line = test_line
            else:
                if current_line:
                    current_lines.append(current_line)
                current_line = word

                if len(current_lines) >= self.max_lines:
                    chunks.append("\n".join(current_lines))
                    current_lines = []

        if current_line:
            current_lines.append(current_line)
        if current_lines:
            chunks.append("\n".join(current_lines))

        return chunks

    @staticmethod
    def _format_vtt_time(ms: int) -> str:
        hours = ms // 3_600_000
        minutes = (ms % 3_600_000) // 60_000
        seconds = (ms % 60_000) // 1_000
        millis = ms % 1_000
        return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{millis:03d}"

    @staticmethod
    def _format_srt_time(ms: int) -> str:
        hours = ms // 3_600_000
        minutes = (ms % 3_600_000) // 60_000
        seconds = (ms % 60_000) // 1_000
        millis = ms % 1_000
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{millis:03d}"

    def to_vtt(self, captions: list[dict], use_cleaned: bool = True) -> str:
        lines = ["WEBVTT", ""]
        for cap in captions:
            text = (cap.get("cleaned_text") or cap["original_text"]) if use_cleaned else cap["original_text"]
            start = self._format_vtt_time(cap["start_ms"])
            end = self._format_vtt_time(cap["end_ms"])
            lines.append(f"{start} --> {end}")
            lines.append(text)
            lines.append("")
        return "\n".join(lines)

    def to_srt(self, captions: list[dict], use_cleaned: bool = True) -> str:
        lines = []
        for i, cap in enumerate(captions, 1):
            text = (cap.get("cleaned_text") or cap["original_text"]) if use_cleaned else cap["original_text"]
            start = self._format_srt_time(cap["start_ms"])
            end = self._format_srt_time(cap["end_ms"])
            lines.append(str(i))
            lines.append(f"{start} --> {end}")
            lines.append(text)
            lines.append("")
        return "\n".join(lines)

    def to_txt(self, captions: list[dict], use_cleaned: bool = True) -> str:
        lines = []
        current_speaker = None
        for cap in captions:
            text = (cap.get("cleaned_text") or cap["original_text"]) if use_cleaned else cap["original_text"]
            speaker = cap.get("speaker")
            if speaker and speaker != current_speaker:
                if lines:
                    lines.append("")
                lines.append(f"[{speaker}]")
                current_speaker = speaker
            lines.append(text)
        return "\n".join(lines)
