import json
import re
import logging
from pathlib import Path
from app.config import get_settings
from app.models.schemas import (
    AccessibilityScore,
    ScoreDimension,
    CaptionBlock,
    VisualReferenceFlag,
)

logger = logging.getLogger(__name__)

VISUAL_REFERENCE_PATTERNS = [
    r"\bas you can see\b",
    r"\bas shown here\b",
    r"\blook at this\b",
    r"\bthis graph\b",
    r"\bthis chart\b",
    r"\bthis slide\b",
    r"\bthis diagram\b",
    r"\bthis table\b",
    r"\bthis image\b",
    r"\bover here\b",
    r"\bright here\b",
    r"\bon the screen\b",
    r"\bon the board\b",
    r"\bpoints to\b",
    r"\bhighlighted in\b",
    r"\bthe one in red\b",
    r"\bthe one in blue\b",
    r"\byou'll notice\b",
    r"\bif you look at\b",
]


class ComplianceScorer:
    """Score captions against the compliance rubric (WCAG 2.1 / Section 508 / DCMP)."""

    def __init__(self):
        self.settings = get_settings()
        rubric_path = Path(__file__).parent.parent.parent.parent / "docs" / "compliance-rubric.json"
        if rubric_path.exists():
            with open(rubric_path) as f:
                self.rubric = json.load(f)
        else:
            self.rubric = None

    def score_captions(
        self,
        captions: list[dict],
        duration_seconds: float | None = None,
    ) -> AccessibilityScore:
        dimensions = [
            self._score_accuracy(captions),
            self._score_synchronization(captions),
            self._score_completeness(captions, duration_seconds),
            self._score_speaker_identification(captions),
            self._score_formatting(captions),
            self._score_visual_accessibility(captions),
        ]

        overall = sum(d.score * d.weight for d in dimensions)

        if overall >= 95:
            rating = "Fully Compliant"
        elif overall >= 80:
            rating = "Mostly Compliant - Minor Issues"
        elif overall >= 60:
            rating = "Partially Compliant - Action Required"
        else:
            rating = "Non-Compliant - Significant Issues"

        return AccessibilityScore(
            overall=round(overall, 1),
            rating=rating,
            dimensions=dimensions,
        )

    def _score_accuracy(self, captions: list[dict]) -> ScoreDimension:
        issues = []
        total_words = 0
        problem_count = 0

        for cap in captions:
            text = cap.get("cleaned_text") or cap.get("original_text", "")
            words = text.split()
            total_words += len(words)

            if "[inaudible]" in text.lower():
                problem_count += text.lower().count("[inaudible]")
                issues.append(f"Caption {cap.get('sequence', '?')}: Contains [inaudible] segment")

            if re.search(r'\b[a-z]*[A-Z][a-z]*[A-Z]\b', text):
                problem_count += 1
                issues.append(f"Caption {cap.get('sequence', '?')}: Possible garbled text detected")

        score = max(0, 100 - (problem_count / max(total_words, 1)) * 10000)

        return ScoreDimension(
            id="accuracy",
            name="Caption Accuracy",
            score=min(100, round(score, 1)),
            weight=0.30,
            issues=issues[:20],
            details={"total_words": total_words, "problems_found": problem_count},
        )

    def _score_synchronization(self, captions: list[dict]) -> ScoreDimension:
        issues = []
        violations = 0
        total = len(captions)

        for cap in captions:
            start = cap.get("start_ms", 0)
            end = cap.get("end_ms", 0)
            duration = end - start

            if duration < self.settings.min_caption_duration_ms:
                violations += 1
                issues.append(
                    f"Caption {cap.get('sequence', '?')}: Duration {duration}ms "
                    f"below minimum {self.settings.min_caption_duration_ms}ms"
                )

            if duration > self.settings.max_caption_duration_ms:
                violations += 1
                issues.append(
                    f"Caption {cap.get('sequence', '?')}: Duration {duration}ms "
                    f"exceeds maximum {self.settings.max_caption_duration_ms}ms"
                )

            text = cap.get("cleaned_text") or cap.get("original_text", "")
            word_count = len(text.split())
            if duration > 0 and word_count > 0:
                wpm = (word_count / duration) * 60_000
                if wpm > self.settings.max_reading_speed_wpm:
                    violations += 1
                    issues.append(
                        f"Caption {cap.get('sequence', '?')}: Reading speed {wpm:.0f} WPM "
                        f"exceeds maximum {self.settings.max_reading_speed_wpm} WPM"
                    )

        score = max(0, 100 - (violations / max(total, 1)) * 100)

        return ScoreDimension(
            id="synchronization",
            name="Caption Synchronization",
            score=min(100, round(score, 1)),
            weight=0.20,
            issues=issues[:20],
            details={"total_captions": total, "timing_violations": violations},
        )

    def _score_completeness(
        self,
        captions: list[dict],
        duration_seconds: float | None = None,
    ) -> ScoreDimension:
        issues = []

        if not captions:
            return ScoreDimension(
                id="completeness",
                name="Caption Completeness",
                score=0,
                weight=0.20,
                issues=["No captions found"],
            )

        sorted_caps = sorted(captions, key=lambda c: c.get("start_ms", 0))
        gaps = []
        for i in range(1, len(sorted_caps)):
            prev_end = sorted_caps[i - 1].get("end_ms", 0)
            curr_start = sorted_caps[i].get("start_ms", 0)
            gap = curr_start - prev_end
            if gap > 5000:
                gaps.append((prev_end, curr_start, gap))
                issues.append(
                    f"Gap of {gap / 1000:.1f}s between captions "
                    f"{sorted_caps[i-1].get('sequence', '?')} and {sorted_caps[i].get('sequence', '?')}"
                )

        caption_coverage_ms = sum(
            max(0, c.get("end_ms", 0) - c.get("start_ms", 0)) for c in captions
        )

        if duration_seconds and duration_seconds > 0:
            coverage_pct = (caption_coverage_ms / (duration_seconds * 1000)) * 100
        else:
            last_end = max(c.get("end_ms", 0) for c in captions) if captions else 0
            coverage_pct = (caption_coverage_ms / max(last_end, 1)) * 100

        gap_penalty = len(gaps) * 5
        score = max(0, min(100, coverage_pct) - gap_penalty)

        return ScoreDimension(
            id="completeness",
            name="Caption Completeness",
            score=round(score, 1),
            weight=0.20,
            issues=issues[:20],
            details={
                "coverage_pct": round(coverage_pct, 1),
                "large_gaps": len(gaps),
                "caption_count": len(captions),
            },
        )

    def _score_speaker_identification(self, captions: list[dict]) -> ScoreDimension:
        issues = []

        speakers = set()
        labeled_count = 0
        for cap in captions:
            if cap.get("speaker"):
                speakers.add(cap["speaker"])
                labeled_count += 1

        total = len(captions)
        if total == 0:
            return ScoreDimension(
                id="speaker_identification",
                name="Speaker Identification",
                score=0,
                weight=0.10,
                issues=["No captions to evaluate"],
            )

        if len(speakers) <= 1 and labeled_count == 0:
            score = 80.0
            issues.append(
                "No speaker labels detected. If this is a single-speaker lecture, "
                "this is acceptable. If multiple speakers are present, labels are required."
            )
        elif len(speakers) > 1:
            label_ratio = labeled_count / total
            score = label_ratio * 100
            if label_ratio < 1.0:
                issues.append(
                    f"Only {labeled_count}/{total} captions have speaker labels. "
                    f"All captions should have speaker identification when multiple speakers are present."
                )
        else:
            score = 100.0

        return ScoreDimension(
            id="speaker_identification",
            name="Speaker Identification",
            score=round(score, 1),
            weight=0.10,
            issues=issues,
            details={"speakers_found": len(speakers), "labeled_captions": labeled_count},
        )

    def _score_formatting(self, captions: list[dict]) -> ScoreDimension:
        issues = []
        violations = 0
        total = len(captions)

        for cap in captions:
            text = cap.get("cleaned_text") or cap.get("original_text", "")
            lines = text.split("\n")

            if len(lines) > self.settings.max_caption_lines:
                violations += 1
                issues.append(
                    f"Caption {cap.get('sequence', '?')}: {len(lines)} lines "
                    f"(max {self.settings.max_caption_lines})"
                )

            for line in lines:
                if len(line) > self.settings.max_caption_line_length:
                    violations += 1
                    issues.append(
                        f"Caption {cap.get('sequence', '?')}: Line has {len(line)} chars "
                        f"(max {self.settings.max_caption_line_length})"
                    )
                    break

            if text == text.upper() and len(text) > 10:
                violations += 1
                issues.append(f"Caption {cap.get('sequence', '?')}: ALL CAPS text (should be mixed case)")

        score = max(0, 100 - (violations / max(total, 1)) * 100)

        return ScoreDimension(
            id="formatting",
            name="Caption Formatting",
            score=min(100, round(score, 1)),
            weight=0.10,
            issues=issues[:20],
            details={"total_captions": total, "formatting_violations": violations},
        )

    def _score_visual_accessibility(self, captions: list[dict]) -> ScoreDimension:
        issues = []
        flags: list[VisualReferenceFlag] = []

        for cap in captions:
            text = cap.get("cleaned_text") or cap.get("original_text", "")
            for pattern in VISUAL_REFERENCE_PATTERNS:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    flags.append(VisualReferenceFlag(
                        caption_id=cap.get("id", ""),
                        text=text,
                        matched_pattern=match.group(),
                        start_ms=cap.get("start_ms", 0),
                        suggestion=f"Add a description of the visual content referenced by '{match.group()}'",
                    ))
                    issues.append(
                        f"Caption {cap.get('sequence', '?')}: Visual reference '{match.group()}' "
                        f"needs description for accessibility"
                    )

        if flags:
            score = max(0, 100 - len(flags) * 10)
        else:
            score = 100.0

        return ScoreDimension(
            id="visual_accessibility",
            name="Visual Reference Accessibility",
            score=min(100, round(score, 1)),
            weight=0.10,
            issues=issues[:20],
            details={"visual_references_found": len(flags)},
        )

    def detect_all_visual_references(self, captions: list[dict]) -> list[VisualReferenceFlag]:
        """Return all detected visual references for the UI to display."""
        flags = []
        for cap in captions:
            text = cap.get("cleaned_text") or cap.get("original_text", "")
            for pattern in VISUAL_REFERENCE_PATTERNS:
                for match in re.finditer(pattern, text, re.IGNORECASE):
                    flags.append(VisualReferenceFlag(
                        caption_id=cap.get("id", ""),
                        text=text,
                        matched_pattern=match.group(),
                        start_ms=cap.get("start_ms", 0),
                        suggestion=f"Add a description of the visual content referenced by '{match.group()}'",
                    ))
        return flags
