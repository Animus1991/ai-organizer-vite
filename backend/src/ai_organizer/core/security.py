from __future__ import annotations

from datetime import datetime, timedelta, timezone
import secrets
from typing import Any, Dict

from jose import jwt, JWTError
from passlib.context import CryptContext

from ai_organizer.core.config import settings

# bcrypt_sha256 = bcrypt + pre-hash (SHA-256) ώστε να μην υπάρχει όριο 72 bytes
pwd_context = CryptContext(schemes=["bcrypt_sha256"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def create_access_token(subject: str, extra: Dict[str, Any] | None = None) -> str:
    now = _now()
    exp = now + timedelta(minutes=settings.AIORG_ACCESS_MINUTES)

    payload: Dict[str, Any] = {
        "sub": subject,
        "type": "access",
        "iat": int(now.timestamp()),
        "exp": int(exp.timestamp()),
    }
    if extra:
        payload.update(extra)

    return jwt.encode(payload, settings.AIORG_JWT_SECRET, algorithm=settings.AIORG_JWT_ALG)


def create_refresh_token(subject: str) -> tuple[str, str, datetime]:
    now = _now()
    jti = secrets.token_urlsafe(24)
    expires_at = now + timedelta(days=settings.AIORG_REFRESH_DAYS)

    payload: Dict[str, Any] = {
        "sub": subject,
        "type": "refresh",
        "jti": jti,
        "iat": int(now.timestamp()),
        "exp": int(expires_at.timestamp()),
    }

    token = jwt.encode(payload, settings.AIORG_JWT_SECRET, algorithm=settings.AIORG_JWT_ALG)
    return token, jti, expires_at


def decode_token(token: str) -> Dict[str, Any]:
    try:
        return jwt.decode(token, settings.AIORG_JWT_SECRET, algorithms=[settings.AIORG_JWT_ALG])
    except JWTError as e:
        raise ValueError("Invalid token") from e
