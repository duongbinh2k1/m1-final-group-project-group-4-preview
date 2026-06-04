import re

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.api.deps import require_auth
from app.core.auth import DBUnavailableError, authenticate_user, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_]{1,50}$")


class LoginRequest(BaseModel):
    username: str
    password: str

    @field_validator("username")
    @classmethod
    def _validate_username(cls, v: str) -> str:
        if not _USERNAME_RE.match(v):
            raise ValueError("Invalid username format")
        return v


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    username: str


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest):
    try:
        ok = await authenticate_user(body.username, body.password)
    except DBUnavailableError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Auth service unavailable — try again later",
        )
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    return TokenResponse(access_token=create_access_token(body.username))


@router.get("/me", response_model=UserResponse)
def me(username: str = Depends(require_auth)):
    return UserResponse(username=username)


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password:     str = Field(..., min_length=8, description="Minimum 8 characters")


@router.put("/change-password", status_code=204)
async def change_password(
    body:     ChangePasswordRequest,
    username: str = Depends(require_auth),
):
    from app.core.auth import hash_password
    from app.services import supabase_db

    # Verify current password first
    try:
        ok = await authenticate_user(username, body.current_password)
    except DBUnavailableError:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail="Auth service unavailable")

    if not ok:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, detail="Current password is incorrect")

    new_hash = hash_password(body.new_password)
    success  = await supabase_db.update_user_password(username, new_hash)
    if not success:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to update password")
