"""
Authentication dependency for FastAPI routes.

Verifies the Supabase JWT from the Authorization header and returns the user ID.
The backend uses the service_role key to validate tokens server-side.
"""
import logging
from fastapi import Depends, HTTPException, Request

from app.services.supabase_client import get_supabase

logger = logging.getLogger(__name__)


def get_current_user_id(request: Request) -> str:
    """Extract and verify the Supabase JWT, return the user's ID."""
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header")

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status_code=401, detail="Empty token")

    try:
        sb = get_supabase()
        user_response = sb.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_response.user.id
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Auth verification failed: %s", e)
        raise HTTPException(status_code=401, detail="Authentication failed")
