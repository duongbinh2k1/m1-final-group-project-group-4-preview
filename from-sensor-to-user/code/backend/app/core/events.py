import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.config import settings
from app.services import supabase_db
from app.services.mqtt import set_event_loop, start_mqtt_thread


_DEFAULT_SECRET = "change-this-secret-key-in-production"


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Guard: refuse to start with default JWT secret in any meaningful env
    if settings.auth_secret_key == _DEFAULT_SECRET:
        print("[AUTH] ⚠️  WARNING: using default JWT secret key — set AUTH_SECRET_KEY in .env")

    # Supabase
    if settings.supabase_url and settings.supabase_key:
        supabase_db.init(settings.supabase_url, settings.supabase_key)
    else:
        print("[Supabase] ⚠️  SUPABASE_URL / SUPABASE_KEY not set — DB features unavailable")

    # MQTT
    loop = asyncio.get_running_loop()
    set_event_loop(loop)
    start_mqtt_thread()

    print(f"\n🍄  Mushroom Backend ready")
    print(f"📡  MQTT  → {settings.mqtt_broker}:{settings.mqtt_port}")
    print(f"🔌  WS    → ws://localhost:{settings.server_port}/socket.io")
    print(f"📖  Docs  → http://localhost:{settings.server_port}/docs\n")

    yield

    print("\n[Shutdown] Goodbye 🍄")
