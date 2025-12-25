from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlmodel import Session, select

from ai_organizer.core.auth_dep import get_db, get_current_user
from ai_organizer.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from ai_organizer.models import User, RefreshToken

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterIn(BaseModel):
    email: EmailStr
    password: str


class TokenOut(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=dict)
def register(payload: RegisterIn, session: Session = Depends(get_db)):
    existing = session.exec(select(User).where(User.email == payload.email)).first()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    user = User(email=payload.email, password_hash=hash_password(payload.password))
    session.add(user)
    session.commit()
    session.refresh(user)
    return {"ok": True, "userId": user.id}


@router.post("/login", response_model=TokenOut)
def login(form: OAuth2PasswordRequestForm = Depends(), session: Session = Depends(get_db)):
    # OAuth2PasswordRequestForm uses: username + password
    user = session.exec(select(User).where(User.email == form.username)).first()
    if not user or not verify_password(form.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

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

    return TokenOut(access_token=access, refresh_token=refresh)


class RefreshIn(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=TokenOut)
def refresh(payload: RefreshIn, session: Session = Depends(get_db)):
    # 1) cryptographic validation + exp validation (jwt)
    try:
        data = decode_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # 2) ensure correct token type
    if data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    email = data.get("sub")
    jti = data.get("jti")
    if not email or not jti:
        raise HTTPException(status_code=401, detail="Malformed refresh token")

    # 3) DB validation (revocation + server-side expiry authority)
    rt = session.exec(select(RefreshToken).where(RefreshToken.jti == jti)).first()
    if not rt or rt.revoked:
        raise HTTPException(status_code=401, detail="Refresh token revoked/unknown")

    db_exp = rt.expires_at
    if db_exp.tzinfo is None:
        db_exp = db_exp.replace(tzinfo=timezone.utc)

    if db_exp < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Refresh token expired")

    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

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

    return TokenOut(access_token=access, refresh_token=new_refresh)


class LogoutIn(BaseModel):
    refresh_token: str


@router.post("/logout", response_model=dict)
def logout(payload: LogoutIn, session: Session = Depends(get_db)):
    try:
        data = decode_token(payload.refresh_token)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # ✅ NEW: require refresh token specifically
    if data.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    jti = data.get("jti")
    if not jti:
        raise HTTPException(status_code=400, detail="Malformed refresh token")

    rt = session.exec(select(RefreshToken).where(RefreshToken.jti == jti)).first()
    if rt:
        rt.revoked = True
        session.commit()

    return {"ok": True}


@router.get("/me", response_model=dict)
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "email": user.email}
