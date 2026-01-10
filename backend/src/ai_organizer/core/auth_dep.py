from __future__ import annotations

from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlmodel import Session, select

from ai_organizer.api.errors import unauthorized
from ai_organizer.core.db import engine
from ai_organizer.core.security import decode_token
from ai_organizer.models import User


# Αυτό κάνει το Swagger να δείχνει "Authorize" και να στέλνει Bearer token.
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def get_db() -> Generator[Session, None, None]:
    with Session(engine) as session:
        yield session


def _unauthorized(detail: str = "Not authenticated", details: dict | None = None) -> HTTPException:
    # WWW-Authenticate: Bearer είναι σημαντικό (το βλέπεις και στα response headers).
    # Use standard error helper but preserve WWW-Authenticate header
    exc = unauthorized(detail, details=details)
    # HTTPException.headers is a dict, merge with WWW-Authenticate
    if exc.headers:
        exc.headers["WWW-Authenticate"] = "Bearer"
    else:
        exc.headers = {"WWW-Authenticate": "Bearer"}
    return exc


def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(get_db),
) -> User:
    # decode_token() πρέπει να γυρίζει dict π.χ. {"sub": "...", "type": "access", ...}
    try:
        payload = decode_token(token)
    except Exception:
        raise _unauthorized("Invalid token")

    if not isinstance(payload, dict):
        raise _unauthorized("Invalid token payload")

    if payload.get("type") != "access":
        raise _unauthorized("Invalid token type")

    email = payload.get("sub")
    if not email:
        raise _unauthorized("Missing subject")

    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        raise _unauthorized("User not found")

    return user
