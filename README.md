# AccessLecture

**Turn any lecture into an accessible course asset in minutes using AI.**

A compliance-first, self-hostable platform that transforms lecture recordings into WCAG 2.1 / Section 508 compliant captions, transcripts, speaker labels, and accessibility scores. Built on open-source AI models, designed to run on university infrastructure.

## Architecture

```
Frontend (Next.js)  →  API Gateway  →  Processing Backend (Python/FastAPI)
       ↕                                         ↕
   Supabase                              faster-whisper + pyannote.audio
(Auth, DB, Storage, Realtime)            Gemini Flash / Local LLM
```

### Frontend
- **Next.js** (App Router) with Tailwind CSS + shadcn/ui
- **ffmpeg.wasm** for client-side video-to-audio extraction
- Deployed on Vercel

### Processing Backend
- **Python / FastAPI** processing engine
- **faster-whisper** for transcription (Whisper large-v3, 4x faster)
- **pyannote.audio** for speaker diarization
- **Celery + Redis** for background job processing
- Deployed via Docker (Google Cloud / university GPU servers)

### Data Layer
- **Supabase** for PostgreSQL, Auth, Realtime, and file storage

## Getting Started

### Prerequisites
- Node.js 20+
- Python 3.11+
- Docker & Docker Compose
- Redis

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
uvicorn app.main:app --reload
```

### Run Everything with Docker (GPU host)
Build context is the **repository root** (`Dockerfile.backend` includes `docs/compliance-rubric.json`).

```bash
# Dev: bind-mounts backend + docs, Redis URL wired for Compose
docker compose up --build

# Production-style (no bind mounts; rebuild after code changes)
docker compose -f docker-compose.prod.yml up -d --build
```

### Connect Vercel → API + Supabase
1. Deploy the **frontend** on Vercel with **Root Directory** = `frontend`.
2. In Vercel **Environment Variables**, set:
   - `NEXT_PUBLIC_API_URL` — your **public** FastAPI base, e.g. `https://api.example.com/api` (must match how routes are mounted).
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase (anon/publishable key for the browser).
3. Deploy the **backend** on a **GPU VM** (e.g. Google Compute Engine with NVIDIA + Docker) or your own server: use `docker-compose.prod.yml`, fill `backend/.env`, place `gcp-credentials.json` for Vertex if used, open HTTPS (reverse proxy recommended).
4. CORS allows `localhost` and any `https://*.vercel.app` by default; add custom domains via `CORS_ORIGINS` in `backend/.env` if needed.

See `scripts/vercel-env-template.txt` for a checklist.

## Compliance Standards

This project is built around compliance from the ground up. See [`docs/compliance-rubric.json`](docs/compliance-rubric.json) for the full scoring rubric grounded in:

- **WCAG 2.1 Level AA** (criteria 1.2.2, 1.2.3, 1.2.5)
- **Section 508** (29 U.S.C. 794d)
- **ADA Title II** (public universities)
- **FCC Caption Quality Standards** (accuracy, synchronization, completeness, placement)
- **DCMP Captioning Key** (accuracy, consistency, clarity, readability, equality)

## License

MIT
