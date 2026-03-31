import { config } from "./config";

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

export interface VisualReferenceFlag {
  caption_id: string;
  text: string;
  matched_pattern: string;
  start_ms: number;
  suggestion: string;
}

const VISUAL_REFERENCE_PATTERNS = [
  /\bas you can see\b/i,
  /\bas shown here\b/i,
  /\blook at this\b/i,
  /\bthis graph\b/i,
  /\bthis chart\b/i,
  /\bthis slide\b/i,
  /\bthis diagram\b/i,
  /\bthis table\b/i,
  /\bthis image\b/i,
  /\bover here\b/i,
  /\bright here\b/i,
  /\bon the screen\b/i,
  /\bon the board\b/i,
  /\bpoints to\b/i,
  /\bhighlighted in\b/i,
  /\bthe one in red\b/i,
  /\bthe one in blue\b/i,
  /\byou'll notice\b/i,
  /\bif you look at\b/i,
];

type Cap = Record<string, unknown>;

function getText(cap: Cap): string {
  return ((cap.cleaned_text as string) || (cap.original_text as string) || "");
}

export function scoreCaptions(
  captions: Cap[],
  durationSeconds?: number | null
): AccessibilityScore {
  const dimensions = [
    scoreAccuracy(captions),
    scoreSynchronization(captions),
    scoreCompleteness(captions, durationSeconds),
    scoreSpeakerIdentification(captions),
    scoreFormatting(captions),
    scoreVisualAccessibility(captions),
  ];

  const overall = dimensions.reduce((s, d) => s + d.score * d.weight, 0);

  let rating: string;
  if (overall >= 95) rating = "Fully Compliant";
  else if (overall >= 80) rating = "Mostly Compliant - Minor Issues";
  else if (overall >= 60) rating = "Partially Compliant - Action Required";
  else rating = "Non-Compliant - Significant Issues";

  return { overall: Math.round(overall * 10) / 10, rating, dimensions };
}

function scoreAccuracy(captions: Cap[]): ScoreDimension {
  const issues: string[] = [];
  let totalWords = 0;
  let problemCount = 0;

  for (const cap of captions) {
    const text = getText(cap);
    const words = text.split(/\s+/);
    totalWords += words.length;

    if (text.toLowerCase().includes("[inaudible]")) {
      problemCount += (text.toLowerCase().match(/\[inaudible\]/g) ?? []).length;
      issues.push(`Caption ${cap.sequence ?? "?"}: Contains [inaudible] segment`);
    }
    if (/\b[a-z]*[A-Z][a-z]*[A-Z]\b/.test(text)) {
      problemCount++;
      issues.push(`Caption ${cap.sequence ?? "?"}: Possible garbled text detected`);
    }
  }

  const score = Math.max(0, 100 - (problemCount / Math.max(totalWords, 1)) * 10000);
  return {
    id: "accuracy",
    name: "Caption Accuracy",
    score: Math.min(100, Math.round(score * 10) / 10),
    weight: 0.30,
    issues: issues.slice(0, 20),
    details: { total_words: totalWords, problems_found: problemCount },
  };
}

function scoreSynchronization(captions: Cap[]): ScoreDimension {
  const issues: string[] = [];
  let violations = 0;
  const total = captions.length;

  for (const cap of captions) {
    const start = (cap.start_ms as number) ?? 0;
    const end = (cap.end_ms as number) ?? 0;
    const duration = end - start;

    if (duration < config.minCaptionDurationMs) {
      violations++;
      issues.push(`Caption ${cap.sequence ?? "?"}: Duration ${duration}ms below minimum ${config.minCaptionDurationMs}ms`);
    }
    if (duration > config.maxCaptionDurationMs) {
      violations++;
      issues.push(`Caption ${cap.sequence ?? "?"}: Duration ${duration}ms exceeds maximum ${config.maxCaptionDurationMs}ms`);
    }

    const text = getText(cap);
    const wordCount = text.split(/\s+/).length;
    if (duration > 0 && wordCount > 0) {
      const wpm = (wordCount / duration) * 60_000;
      if (wpm > config.maxReadingSpeedWpm) {
        violations++;
        issues.push(`Caption ${cap.sequence ?? "?"}: Reading speed ${Math.round(wpm)} WPM exceeds maximum ${config.maxReadingSpeedWpm} WPM`);
      }
    }
  }

  const score = Math.max(0, 100 - (violations / Math.max(total, 1)) * 100);
  return {
    id: "synchronization",
    name: "Caption Synchronization",
    score: Math.min(100, Math.round(score * 10) / 10),
    weight: 0.20,
    issues: issues.slice(0, 20),
    details: { total_captions: total, timing_violations: violations },
  };
}

function scoreCompleteness(captions: Cap[], durationSeconds?: number | null): ScoreDimension {
  if (!captions.length) {
    return { id: "completeness", name: "Caption Completeness", score: 0, weight: 0.20, issues: ["No captions found"], details: {} };
  }

  const issues: string[] = [];
  const sorted = [...captions].sort((a, b) => ((a.start_ms as number) ?? 0) - ((b.start_ms as number) ?? 0));
  let gaps = 0;

  for (let i = 1; i < sorted.length; i++) {
    const prevEnd = (sorted[i - 1].end_ms as number) ?? 0;
    const currStart = (sorted[i].start_ms as number) ?? 0;
    const gap = currStart - prevEnd;
    if (gap > 5000) {
      gaps++;
      issues.push(`Gap of ${(gap / 1000).toFixed(1)}s between captions ${sorted[i - 1].sequence ?? "?"} and ${sorted[i].sequence ?? "?"}`);
    }
  }

  const captionCoverageMs = captions.reduce(
    (s, c) => s + Math.max(0, ((c.end_ms as number) ?? 0) - ((c.start_ms as number) ?? 0)),
    0
  );

  let coveragePct: number;
  if (durationSeconds && durationSeconds > 0) {
    coveragePct = (captionCoverageMs / (durationSeconds * 1000)) * 100;
  } else {
    const lastEnd = Math.max(...captions.map((c) => (c.end_ms as number) ?? 0));
    coveragePct = (captionCoverageMs / Math.max(lastEnd, 1)) * 100;
  }

  const score = Math.max(0, Math.min(100, coveragePct) - gaps * 5);
  return {
    id: "completeness",
    name: "Caption Completeness",
    score: Math.round(score * 10) / 10,
    weight: 0.20,
    issues: issues.slice(0, 20),
    details: { coverage_pct: Math.round(coveragePct * 10) / 10, large_gaps: gaps, caption_count: captions.length },
  };
}

function scoreSpeakerIdentification(captions: Cap[]): ScoreDimension {
  const issues: string[] = [];
  const speakers = new Set<string>();
  let labeledCount = 0;

  for (const cap of captions) {
    if (cap.speaker) {
      speakers.add(cap.speaker as string);
      labeledCount++;
    }
  }

  const total = captions.length;
  if (!total) {
    return { id: "speaker_identification", name: "Speaker Identification", score: 0, weight: 0.10, issues: ["No captions to evaluate"], details: {} };
  }

  let score: number;
  if (speakers.size <= 1 && labeledCount === 0) {
    score = 80;
    issues.push("No speaker labels detected. If this is a single-speaker lecture, this is acceptable.");
  } else if (speakers.size > 1) {
    const ratio = labeledCount / total;
    score = ratio * 100;
    if (ratio < 1) {
      issues.push(`Only ${labeledCount}/${total} captions have speaker labels.`);
    }
  } else {
    score = 100;
  }

  return {
    id: "speaker_identification",
    name: "Speaker Identification",
    score: Math.round(score * 10) / 10,
    weight: 0.10,
    issues,
    details: { speakers_found: speakers.size, labeled_captions: labeledCount },
  };
}

function scoreFormatting(captions: Cap[]): ScoreDimension {
  const issues: string[] = [];
  let violations = 0;
  const total = captions.length;

  for (const cap of captions) {
    const text = getText(cap);
    const lines = text.split("\n");

    if (lines.length > config.maxCaptionLines) {
      violations++;
      issues.push(`Caption ${cap.sequence ?? "?"}: ${lines.length} lines (max ${config.maxCaptionLines})`);
    }
    for (const line of lines) {
      if (line.length > config.maxCaptionLineLength) {
        violations++;
        issues.push(`Caption ${cap.sequence ?? "?"}: Line has ${line.length} chars (max ${config.maxCaptionLineLength})`);
        break;
      }
    }
    if (text === text.toUpperCase() && text.length > 10) {
      violations++;
      issues.push(`Caption ${cap.sequence ?? "?"}: ALL CAPS text (should be mixed case)`);
    }
  }

  const score = Math.max(0, 100 - (violations / Math.max(total, 1)) * 100);
  return {
    id: "formatting",
    name: "Caption Formatting",
    score: Math.min(100, Math.round(score * 10) / 10),
    weight: 0.10,
    issues: issues.slice(0, 20),
    details: { total_captions: total, formatting_violations: violations },
  };
}

function scoreVisualAccessibility(captions: Cap[]): ScoreDimension {
  const issues: string[] = [];
  let flagCount = 0;

  for (const cap of captions) {
    const text = getText(cap);
    for (const pattern of VISUAL_REFERENCE_PATTERNS) {
      const matches = text.matchAll(new RegExp(pattern.source, "gi"));
      for (const match of matches) {
        flagCount++;
        issues.push(`Caption ${cap.sequence ?? "?"}: Visual reference '${match[0]}' needs description for accessibility`);
      }
    }
  }

  const score = flagCount ? Math.max(0, 100 - flagCount * 10) : 100;
  return {
    id: "visual_accessibility",
    name: "Visual Reference Accessibility",
    score: Math.min(100, Math.round(score * 10) / 10),
    weight: 0.10,
    issues: issues.slice(0, 20),
    details: { visual_references_found: flagCount },
  };
}

export function detectAllVisualReferences(captions: Cap[]): VisualReferenceFlag[] {
  const flags: VisualReferenceFlag[] = [];
  for (const cap of captions) {
    const text = getText(cap);
    for (const pattern of VISUAL_REFERENCE_PATTERNS) {
      for (const match of text.matchAll(new RegExp(pattern.source, "gi"))) {
        flags.push({
          caption_id: (cap.id as string) ?? "",
          text,
          matched_pattern: match[0],
          start_ms: (cap.start_ms as number) ?? 0,
          suggestion: `Add a description of the visual content referenced by '${match[0]}'`,
        });
      }
    }
  }
  return flags;
}
