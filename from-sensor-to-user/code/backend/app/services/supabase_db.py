"""
Supabase persistent storage — calls PostgREST REST API directly via httpx.

Why not the supabase-py SDK?
  The SDK pulls in `realtime` which requires websockets<16, conflicting with
  python-socketio's websockets==16.0.  We only need simple INSERT/SELECT so
  the raw REST API is cleaner and has zero extra deps.

Tables required (run docs/supabase_setup.sql in Supabase SQL Editor once).
"""
from __future__ import annotations

import httpx

_url: str = ""
_key: str = ""


def init(url: str, key: str) -> None:
    global _url, _key
    _url = url.rstrip("/")
    _key = key
    print("[Supabase] Configured")


def _headers(prefer_minimal: bool = True) -> dict:
    h = {
        "apikey":        _key,
        "Authorization": f"Bearer {_key}",
        "Content-Type":  "application/json",
    }
    if prefer_minimal:
        h["Prefer"] = "return=minimal"
    return h


def _ready() -> bool:
    return bool(_url and _key)


# ─── Writes (called via asyncio.run_coroutine_threadsafe) ─────────────────────

async def insert_environment(data: dict) -> None:
    if not _ready():
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.post(
                f"{_url}/rest/v1/environment_readings",
                json=data,
                headers=_headers(),
            )
            r.raise_for_status()
    except Exception as exc:
        print(f"[Supabase] insert_environment error: {exc}")


async def insert_devices(data: dict) -> None:
    if not _ready():
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.post(
                f"{_url}/rest/v1/device_states",
                json=data,
                headers=_headers(),
            )
            r.raise_for_status()
    except Exception as exc:
        print(f"[Supabase] insert_devices error: {exc}")


async def insert_ai(data: dict) -> None:
    if not _ready():
        return
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.post(
                f"{_url}/rest/v1/ai_readings",
                json=data,
                headers=_headers(),
            )
            r.raise_for_status()
    except Exception as exc:
        print(f"[Supabase] insert_ai error: {exc}")


# ─── Reads (called from async API routes) ────────────────────────────────────

async def get_environment_history(limit: int = 100) -> list[dict]:
    if not _ready():
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{_url}/rest/v1/environment_readings",
                params={
                    "select":    "timestamp,air_temperature,air_humidity,soil_moisture",
                    "order":     "timestamp.desc",
                    "limit":     str(limit),
                },
                headers=_headers(prefer_minimal=False),
            )
            r.raise_for_status()
            return list(reversed(r.json()))
    except Exception as exc:
        print(f"[Supabase] get_environment_history error: {exc}")
        return []


async def get_devices_history(limit: int = 100) -> list[dict]:
    if not _ready():
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{_url}/rest/v1/device_states",
                params={
                    "select": "timestamp,fan,pump",
                    "order":  "timestamp.desc",
                    "limit":  str(limit),
                },
                headers=_headers(prefer_minimal=False),
            )
            r.raise_for_status()
            return list(reversed(r.json()))
    except Exception as exc:
        print(f"[Supabase] get_devices_history error: {exc}")
        return []


async def update_user_password(username: str, password_hash: str) -> bool:
    """Update bcrypt password_hash for an existing user. Returns True on success."""
    if not _ready():
        return False
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.patch(
                f"{_url}/rest/v1/users",
                params={"username": f"eq.{username}"},
                json={"password_hash": password_hash},
                headers=_headers(),
            )
            r.raise_for_status()
            return True
    except Exception as exc:
        print(f"[Supabase] update_user_password error: {exc}")
        return False


async def get_user_by_username(username: str) -> dict | None:
    """Return {username, password_hash} or None if not found."""
    if not _ready():
        return None
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(
                f"{_url}/rest/v1/users",
                params={
                    "select":   "username,password_hash",
                    "username": f"eq.{username}",
                    "limit":    "1",
                },
                headers=_headers(prefer_minimal=False),
            )
            r.raise_for_status()
            data = r.json()
            return data[0] if data else None
    except Exception as exc:
        print(f"[Supabase] get_user_by_username error: {exc}")
        return None


async def get_ai_history(limit: int = 100) -> list[dict]:
    if not _ready():
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                f"{_url}/rest/v1/ai_readings",
                params={
                    "select": "timestamp,status",
                    "order":  "timestamp.desc",
                    "limit":  str(limit),
                },
                headers=_headers(prefer_minimal=False),
            )
            r.raise_for_status()
            return list(reversed(r.json()))
    except Exception as exc:
        print(f"[Supabase] get_ai_history error: {exc}")
        return []
