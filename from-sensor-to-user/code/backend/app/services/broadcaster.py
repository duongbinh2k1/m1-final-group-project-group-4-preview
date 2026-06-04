import socketio

from app.core.auth import decode_token
from app.core.config import settings
from app.core.store import store

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=settings.cors_origins_list,
)


async def broadcast_state() -> None:
    await sio.emit("state", store.to_state_dict())


@sio.event
async def connect(sid: str, environ: dict, auth=None):
    token = (auth or {}).get("token", "")
    # Strip "Bearer " prefix if present
    if token.startswith("Bearer "):
        token = token[7:]

    if not decode_token(token):
        raise ConnectionRefusedError("Unauthorized")

    print(f"[WS] Client connected: {sid}")
    await sio.emit("state", store.to_state_dict(), to=sid)


@sio.event
async def disconnect(sid: str):
    print(f"[WS] Client disconnected: {sid}")
