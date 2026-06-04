import socketio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import api_router
from app.core.config import settings
from app.core.events import lifespan
from app.services.broadcaster import sio


def create_app() -> socketio.ASGIApp:
    app = FastAPI(
        title="Mushroom Backend",
        version="0.1.0",
        docs_url="/docs",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router)

    @app.get("/")
    def root():
        return {"service": "mushroom-backend", "version": "0.1.0", "status": "ok"}

    # Wrap FastAPI with Socket.IO — /socket.io/* handled by sio
    return socketio.ASGIApp(sio, other_asgi_app=app)


socket_app = create_app()
