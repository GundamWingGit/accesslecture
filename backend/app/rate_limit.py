"""
Rate limiting for the AccessLecture API.

Uses in-memory storage (per Cloud Run instance). This is sufficient
for preventing abuse — each instance independently limits requests.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
