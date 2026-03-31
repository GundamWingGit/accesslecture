from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded

from app.config import get_settings
from app.rate_limit import limiter
from app.routers import transcription, cleanup, scoring, lectures, export, courses, billing

settings = get_settings()

app = FastAPI(
    title="AccessLecture API",
    description="Compliance-first lecture accessibility processing engine",
    version="0.1.0",
)

app.state.limiter = limiter


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."},
    )


def _parse_cors_origins() -> list[str]:
    return [o.strip() for o in settings.cors_origins.split(",") if o.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors_origins(),
    allow_origin_regex=settings.cors_origin_regex.strip() or None,
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
app.include_router(billing.router, prefix="/api/billing", tags=["billing"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "0.1.0"}
