from datetime import datetime, timedelta, timezone

import bcrypt
from jose import JWTError, jwt

from app.core.config import settings


# ─── Password ────────────────────────────────────────────────────────────────

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(rounds=12)).decode()


class DBUnavailableError(Exception):
    """Raised when Supabase is unreachable — caller should return 503."""


async def authenticate_user(username: str, password: str) -> bool:
    """Verify credentials against users table in Supabase.

    Raises DBUnavailableError if Supabase cannot be reached,
    so callers can distinguish infrastructure failure from bad credentials.
    """
    from app.services import supabase_db
    user = await supabase_db.get_user_by_username(username)
    if user is None and not supabase_db._ready():
        raise DBUnavailableError("Supabase not configured")
    if not user:
        return False
    return verify_password(password, user["password_hash"])


# ─── JWT ─────────────────────────────────────────────────────────────────────

def create_access_token(username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=settings.auth_token_expire_hours)
    return jwt.encode(
        {"sub": username, "exp": expire},
        settings.auth_secret_key,
        algorithm=settings.auth_algorithm,
    )


def decode_token(token: str) -> str | None:
    """Return username if token is valid, else None."""
    try:
        payload = jwt.decode(
            token,
            settings.auth_secret_key,
            algorithms=[settings.auth_algorithm],
        )
        return payload.get("sub")
    except JWTError:
        return None
