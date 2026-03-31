# AccessLecture — Compliance Tool Map

How each accessibility compliance need maps to Google Cloud tools,
our provider abstraction, and current implementation status.

**Phase 1 (current):** Gemini handles transcription, visual analysis, and cleanup.
**Phase 2 (upgrade):** Swap individual providers to specialized APIs for better accuracy.
Change one config value per swap — the pipeline never changes.

---

## Provider Architecture

```
┌─────────────────────────────────┐
│     Processing Pipeline         │  ← provider-agnostic (tasks.py)
│     (knows nothing about        │
│      Gemini, STT, or VI)        │
└──────────┬──────────┬───────────┘
           │          │
    ┌──────▼──┐  ┌────▼─────┐  ┌──────────┐
    │ Transcr.│  │ Visual   │  │ Cleanup  │   ← abstract interfaces
    │ Provider│  │ Analysis │  │ Provider │
    └────┬────┘  └────┬─────┘  └────┬─────┘
         │            │             │
    Phase 1: Gemini  Gemini       Gemini        ← config: all "gemini"
    Phase 2: STT     Video Intel  Gemini        ← config swap, zero code changes
```

---

## MVP Compliance Needs

### 1. Captions for prerecorded lecture audio

- **What "good" looks like:** Every spoken word that matters is captioned.
- **Why it matters:** WCAG / Section 508 baseline for prerecorded video.
- **Google tools:** Cloud Speech-to-Text (transcript + timestamps), Transcoder API (embed captions into video).
- **Our provider:** `TranscriptionProvider`
- **Status:** Phase 1 via Gemini. Phase 2 swaps to Speech-to-Text.

### 2. Caption accuracy

- **What "good" looks like:** Captions closely match what was actually said, including technical terms and names.
- **Why it matters:** FCC / DCMP quality guidance treats accuracy as a core caption quality dimension.
- **Google tools:** Speech-to-Text (first pass), Vertex AI / Gemini (cleanup, vocabulary normalization, human-review suggestions).
- **Our provider:** `TranscriptionProvider` + `CleanupProvider`
- **Status:** Phase 1 via Gemini for both. Phase 2 splits to STT + Gemini.

### 3. Caption synchronization

- **What "good" looks like:** Captions appear at the right time and track speech naturally.
- **Why it matters:** Sync is a core quality requirement for usable captions.
- **Google tools:** Speech-to-Text (word/segment timestamps), plus our own caption formatter and QA layer.
- **Our provider:** `TranscriptionProvider` + `CaptionFormatter` + `ComplianceScorer`
- **Status:** Phase 1 via Gemini. Formatter + scorer are pure logic (no API needed). **Done.**

### 4. Caption completeness

- **What "good" looks like:** No major lecture segments are missing. Meaningful non-speech audio is represented.
- **Why it matters:** Completeness is part of FCC / DCMP caption quality expectations.
- **Google tools:** Speech-to-Text, plus pipeline checks for dropped segments and silence/coverage gaps.
- **Our provider:** `TranscriptionProvider` + `ComplianceScorer`
- **Status:** Phase 1 via Gemini. Gap detection is pure logic. **Done.**

### 5. Readable caption formatting

- **What "good" looks like:** Sensible line breaks, durations, punctuation, speaker cues, and placement.
- **Why it matters:** DCMP provides detailed educational captioning guidance. Readability matters for access.
- **Google tools:** None — this is our own caption formatter/compliance engine.
- **Our provider:** `CaptionFormatter` (pure logic, no API)
- **Status:** **Done.** Line length (42 chars), line count (2 max), reading speed (160 WPM), duration constraints all enforced.

### 6. Transcript

- **What "good" looks like:** Downloadable, readable full transcript available.
- **Why it matters:** Section 508 distinguishes captions and transcripts and recommends both.
- **Google tools:** Speech-to-Text (generation), Vertex AI (cleanup and structuring).
- **Our provider:** `TranscriptionProvider` + `CleanupProvider` + export endpoints
- **Status:** Phase 1 via Gemini. Export endpoints (VTT, SRT, TXT) are **done.**

### 7. Speaker identification

- **What "good" looks like:** Different speakers are labeled when more than one person is talking.
- **Why it matters:** Critical for lecture clarity, Q&A sections, panels, and discussions.
- **Google tools:** Cloud Speech-to-Text speaker diarization.
- **Our provider:** `TranscriptionProvider` (diarization built in)
- **Status:** Phase 1 via Gemini. Phase 2 swaps to STT diarization for better accuracy.

### 8. Visual information conveyed accessibly

- **What "good" looks like:** If the lecturer says "this graph" or key info appears only on slides, the system flags it.
- **Why it matters:** WCAG audio description requirement — important visual info must be conveyed accessibly.
- **Google tools:** Video Intelligence API (on-screen text detection), Vertex AI / Gemini (compare transcript vs visuals, flag missing references).
- **Our provider:** `VisualAnalysisProvider` + `ComplianceScorer` (pattern matching) + `CleanupProvider` (AI detection)
- **Status:** Phase 1 via Gemini. Regex-based pattern detection is **done.** Phase 2 adds Video Intelligence.

### 9. On-screen text / slide OCR

- **What "good" looks like:** Slide text, labels, and visible key text extracted and compared against spoken lecture.
- **Why it matters:** Best way to catch "the slide says it, but the speaker never says it."
- **Google tools:** Video Intelligence API text detection.
- **Our provider:** `VisualAnalysisProvider`
- **Status:** Phase 1 via Gemini. Phase 2 swaps to Video Intelligence API.

### 10. Compliance scoring / review workflow

- **What "good" looks like:** Lecture gets a score and issue list: caption quality, missing speaker labels, missing visual explanations.
- **Why it matters:** This is the real product value. Standards focus on quality and equivalence, not just file existence.
- **Google tools:** Vertex AI / Gemini (reasoning, issue explanations), plus our own rubric engine for scoring.
- **Our provider:** `ComplianceScorer` (rubric engine, pure logic) + `CleanupProvider` (AI suggestions)
- **Status:** **Done.** Rubric engine scores 6 dimensions. AI suggestions via Gemini are working.

### 11. Accessible video export

- **What "good" looks like:** Output exported with captions/subtitles in standard formats (VTT, SRT) or as captioned media.
- **Why it matters:** Institutions need VTT/SRT and sometimes rendered video deliverables.
- **Google tools:** Transcoder API (caption/subtitle workflows), plus our own LMS export logic for Canvas packages.
- **Our provider:** Export endpoints (`/api/export/`)
- **Status:** VTT, SRT, TXT, Canvas package export is **done.** Rendered video via Transcoder API is **not yet implemented.**

---

## Later / Phase 2+ Needs

### 12. Audio description / visual-description support

- **What "good" looks like:** System generates notes, prompts, or review tasks to add description for visual-only content.
- **Why it matters:** WCAG / Section 508 may require audio description when important visual info is unavailable.
- **Google tools:** Vertex AI / Gemini (draft visual-description notes), Text-to-Speech (generated described-audio assets).
- **Our provider:** `CleanupProvider` currently drafts text suggestions.
- **Status:** Text suggestions via Gemini work. TTS for audio assets is **not yet implemented.**

### 13. Multilingual captions / translation

- **What "good" looks like:** Captions or transcripts translated for broader access.
- **Why it matters:** Not always required for compliance, but highly useful for accessibility and institutional adoption.
- **Google tools:** Cloud Translation.
- **Our provider:** Will need a new `TranslationProvider` interface.
- **Status:** **Not started.**

### 14. Accessible player controls

- **What "good" looks like:** Users can turn captions on/off and access descriptions through usable, keyboard-navigable controls.
- **Why it matters:** Section 508 requires accessible user controls for synchronized media features.
- **Google tools:** None — this is frontend work.
- **Our provider:** Frontend video player component.
- **Status:** **Not yet implemented.** Needs an accessible video player with caption toggle and keyboard support.

---

## Implementation Summary

### Done

| Component | What it does |
|---|---|
| `TranscriptionProvider` (Gemini) | Audio to transcript with timestamps + speaker labels |
| `VisualAnalysisProvider` (Gemini) | Video to on-screen text / slide detections |
| `CleanupProvider` (Gemini) | Caption cleanup, visual ref detection, vocab extraction, suggestions |
| `CaptionFormatter` | Compliant line breaks, durations, reading speed limits |
| `ComplianceScorer` | 6-dimension scoring rubric (accuracy, sync, completeness, speakers, formatting, visual) |
| Export endpoints | VTT, SRT, TXT, Canvas package |
| Provider factory | Config-based provider selection, zero-code swaps |

### Not yet implemented

| Component | Google tool | Priority |
|---|---|---|
| `SpeechToTextProvider` | Cloud Speech-to-Text | Phase 2 — better timestamps + diarization |
| `VideoIntelligenceProvider` | Video Intelligence API | Phase 2 — structured OCR with bounding boxes |
| `TranslationProvider` | Cloud Translation | Later — multilingual support |
| Rendered video export | Transcoder API | Later — burned-in captions |
| Audio descriptions (TTS) | Text-to-Speech | Later — generated audio description tracks |
| Accessible video player | Frontend (no API) | MVP if hosting playback |
| Human review workflow | Frontend + backend | Later — approve/reject AI suggestions |

### Where to add Phase 2 providers

```
backend/app/services/providers/
├── base.py                  ← interfaces (done)
├── gemini.py                ← Phase 1 implementations (done)
├── factory.py               ← registry + config-based selection (done)
├── speech_to_text.py        ← TODO: TranscriptionProvider via Cloud STT
├── video_intel.py           ← TODO: VisualAnalysisProvider via Video Intelligence
└── translation.py           ← TODO: new TranslationProvider interface + Cloud Translation
```

To swap: set `TRANSCRIPTION_PROVIDER=speech_to_text` in `.env`. That's it.

---

## Cost Reference

| Tool | Cost (approx) | Notes |
|---|---|---|
| Gemini 2.5 Flash | ~$0.15 / hr of audio | Currently handling everything |
| Cloud Speech-to-Text (Chirp 2) | ~$3.84 / hr | More accurate timestamps + diarization |
| Video Intelligence (text detect) | ~$6.00 / hr | Structured OCR with bounding boxes |
| Cloud Translation | $20 / million chars | Multilingual only |
| Transcoder API | ~$0.015 / min output | Rendered video only |

**Long-term goal:** Eliminate all API costs by switching to self-hosted open-source
models (faster-whisper, pyannote.audio, local LLMs) on university GPU infrastructure.
The provider abstraction makes this a config change, not a rewrite.
