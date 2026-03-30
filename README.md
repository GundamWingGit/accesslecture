# AccessLecture

**Turn any lecture into an accessible course asset in minutes using AI.**

A compliance-first, self-hostable platform that transforms lecture recordings into WCAG 2.1 / Section 508 compliant captions, transcripts, speaker labels, and accessibility scores. Built on open-source AI models, designed to run on university infrastructure.

## Architecture

```
Frontend (Next.js 15)  →  API Gateway  →  Processing Backend (Python/FastAPI)
       ↕                                         ↕
   Supabase                              faster-whisper + pyannote.audio
(Auth, DB, Storage, Realtime)            Gemini Flash / Local LLM
```

### Frontend
- **Next.js 15** (App Router) with Tailwind CSS + shadcn/ui
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

### Run Everything with Docker
```bash
docker compose up
```

## Compliance Standards

This project is built around compliance from the ground up. See [`docs/compliance-rubric.json`](docs/compliance-rubric.json) for the full scoring rubric grounded in:

- **WCAG 2.1 Level AA** (criteria 1.2.2, 1.2.3, 1.2.5)
- **Section 508** (29 U.S.C. 794d)
- **ADA Title II** (public universities)
- **FCC Caption Quality Standards** (accuracy, synchronization, completeness, placement)
- **DCMP Captioning Key** (accuracy, consistency, clarity, readability, equality)

## License

MIT
