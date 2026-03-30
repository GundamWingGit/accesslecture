from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import transcription, cleanup, scoring, lectures, export, courses

settings = get_settings()

app = FastAPI(
    title="AccessLecture API",
    description="Compliance-first lecture accessibility processing engine",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://*.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lectures.router, prefix="/api/lectures", tags=["lectures"])
app.include_router(transcription.router, prefix="/api/transcription", tags=["transcription"])
app.include_router(cleanup.router, prefix="/api/cleanup", tags=["cleanup"])
app.include_router(scoring.router, prefix="/api/scoring", tags=["scoring"])
app.include_router(export.router, prefix="/api/export", tags=["export"])
app.include_router(courses.router, prefix="/api/courses", tags=["courses"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
