# backend/src/ai_organizer/api/routes/auth.py

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from ai_organizer.api.errors import create_error_response, conflict, unauthorized
from ai_organizer.core.auth_dep import get_db, get_current_user
from ai_organizer.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from ai_organizer.models import User, RefreshToken

router = APIRouter()

# -----------------------------
# Schemas
# -----------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str


class RegisterOut(BaseModel):
    ok: bool = True
    userId: int


class TokenOut(BaseModel):
    # ✅ Standardized to camelCase for consistency with other DTOs
    accessToken: str
    refreshToken: str
    tokenType: str = "bearer"


class RefreshIn(BaseModel):
    refresh_token: str


class LogoutIn(BaseModel):
    refresh_token: str


class MeOut(BaseModel):
    id: int
    email: EmailStr


# -----------------------------
# Helpers
# -----------------------------
def _ensure_utc(dt: datetime) -> datetime:
    # sqlite / sqlmodel μπορεί να δώσει naive datetime
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=timezone.utc)


def _decode_refresh_or_401(token: str) -> dict[str, Any]:
    try:
        data = decode_token(token)
    except Exception:
        # (ValueError/JWTError/etc.) → πάντα 401 προς τα έξω
        raise unauthorized("Invalid refresh token", details={"reason": "token_decode_failed"})

    if data.get("type") != "refresh":
        raise unauthorized("Invalid token type", details={"expected": "refresh", "actual": data.get("type")})

    sub = data.get("sub")
    jti = data.get("jti")
    if not sub or not jti:
        raise unauthorized("Malformed refresh token", details={"missing_fields": ["sub", "jti"] if not sub and not jti else (["sub"] if not sub else ["jti"])})

    return data


# -----------------------------
# Routes
# -----------------------------
@router.post("/register", response_model=RegisterOut)
def register(payload: RegisterIn, session: Session = Depends(get_db)) -> RegisterOut:
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise conflict("Email already registered", details={"email": payload.email})

    user = User(email=payload.email, password_hash=hash_password(payload.password))
    session.add(user)
    session.commit()
    session.refresh(user)

    return RegisterOut(userId=user.id)


@router.post("/login", response_model=TokenOut)
def login(
    form: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_db),
) -> TokenOut:
    # OAuth2PasswordRequestForm uses: username + password
    # Εδώ: username == email
    user = session.exec(select(User).where(User.email == form.username)).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise unauthorized("Invalid credentials", details={"reason": "invalid_email_or_password"})

    access = create_access_token(subject=user.email, extra={"uid": user.id})
    refresh, jti, expires_at = create_refresh_token(subject=user.email)

    session.add(
        RefreshToken(
            user_id=user.id,
            jti=jti,
            expires_at=expires_at,
            revoked=False,
        )
    )
    session.commit()

    return TokenOut(accessToken=access, refreshToken=refresh)


@router.post("/refresh", response_model=TokenOut)
def refresh(payload: RefreshIn, session: Session = Depends(get_db)) -> TokenOut:
    data = _decode_refresh_or_401(payload.refresh_token)

    email = data["sub"]
    jti = data["jti"]

    # DB validation: exists + not revoked
    rt = session.exec(select(RefreshToken).where(RefreshToken.jti == jti)).first()
    if not rt or rt.revoked:
        raise unauthorized("Refresh token revoked/unknown", details={"jti": jti, "reason": "revoked" if rt and rt.revoked else "not_found"})

    # DB expiry as source of truth
    db_exp = _ensure_utc(rt.expires_at)
    if db_exp < datetime.now(timezone.utc):
        raise unauthorized("Refresh token expired", details={"jti": jti, "expires_at": rt.expires_at.isoformat() if rt.expires_at else None})

    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        raise unauthorized("User not found", details={"email": email})

    # Rotation: revoke old refresh, issue new
    rt.revoked = True

    access = create_access_token(subject=user.email, extra={"uid": user.id})
    new_refresh, new_jti, new_exp = create_refresh_token(subject=user.email)

    session.add(
        RefreshToken(
            user_id=user.id,
            jti=new_jti,
            expires_at=new_exp,
            revoked=False,
        )
    )
    session.commit()

    return TokenOut(accessToken=access, refreshToken=new_refresh)


@router.post("/logout", response_model=dict)
def logout(payload: LogoutIn, session: Session = Depends(get_db)) -> dict:
    data = _decode_refresh_or_401(payload.refresh_token)
    jti = data["jti"]

    rt = session.exec(select(RefreshToken).where(RefreshToken.jti == jti)).first()
    if rt and not rt.revoked:
        rt.revoked = True
        session.commit()

    return {"ok": True}


@router.get("/me", response_model=MeOut)
def me(user: User = Depends(get_current_user)) -> MeOut:
    return MeOut(id=user.id, email=user.email)
