"""Shared rate-limiter instance.

Kept in its own module to avoid circular imports:
  main.py   → imports limiter to attach to app.state
  auth.py   → imports limiter to decorate endpoints
Neither file imports the other.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
