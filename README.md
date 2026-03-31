# AccessLecture

**Turn any lecture into an accessible course asset in minutes using AI.**

A compliance-first platform that transforms lecture recordings into WCAG 2.1 / Section 508 compliant captions, transcripts, speaker labels, and accessibility scores.

## Architecture

```
Frontend (Next.js on Vercel)  →  Backend API (Python/FastAPI on Cloud Run)
         ↕                                    ↕
     Supabase                        Google Gemini (Vertex AI)
  (DB, Storage)                  Transcription, Diarization,
                                 Slide OCR, AI Cleanup, Scoring
```

### Frontend
- **Next.js 16** (App Router) with Tailwind CSS + shadcn/ui
- **ffmpeg.wasm** for client-side video-to-audio extraction
- Deployed on **Vercel**

### Processing Backend
- **Python / FastAPI** on **Google Cloud Run** (serverless, scales to zero)
- **Google Gemini** (Vertex AI) for:
  - Audio transcription with word-level timestamps
  - Speaker diarization (multi-speaker identification)
  - Video slide/screen OCR (on-screen text detection)
  - AI caption cleanup (grammar, filler removal, formatting)
  - Accessibility scoring and suggestions
- Background processing via FastAPI `BackgroundTasks` (no separate worker needed)

### Data Layer
- **Supabase** for PostgreSQL and file storage

### Future: Zero-Cost Self-Hosting
When university GPU infrastructure is available, the Google Cloud APIs can be swapped for open-source alternatives (`faster-whisper`, `pyannote.audio`, local LLMs) with no code changes outside the provider layer.

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- Google Cloud project with Vertex AI enabled + service account key

### Frontend Development
```bash
cd frontend
npm install
npm run dev
```

### Backend Development
```bash
cd backend
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt
cp .env.example .env     # fill in your values
uvicorn app.main:app --reload
```

### Deploy Backend to Cloud Run
```bash
# Set your GCP project and authenticate
gcloud auth login
gcloud config set project YOUR_PROJECT_ID

# Deploy (builds container in the cloud, no local Docker needed)
./scripts/deploy-cloud-run.sh
```

### Connect Vercel to Backend + Supabase
1. Deploy the **frontend** on Vercel with **Root Directory** = `frontend`.
2. In Vercel **Environment Variables**, set:
   - `NEXT_PUBLIC_API_URL` — your Cloud Run service URL, e.g. `https://accesslecture-api-xxxxx-uc.a.run.app/api`
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase dashboard
3. CORS allows `localhost` and any `https://*.vercel.app` by default.

See `scripts/vercel-env-template.txt` for a checklist.

## Compliance Standards

Built around compliance from the ground up. See [`docs/compliance-rubric.json`](docs/compliance-rubric.json) for the full scoring rubric grounded in:

- **WCAG 2.1 Level AA** (criteria 1.2.2, 1.2.3, 1.2.5)
- **Section 508** (29 U.S.C. 794d)
- **ADA Title II** (public universities)
- **FCC Caption Quality Standards** (accuracy, synchronization, completeness, placement)
- **DCMP Captioning Key** (accuracy, consistency, clarity, readability, equality)

## License

MIT
