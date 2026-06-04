from fastapi import APIRouter, Depends

from app.api.deps import require_auth
from app.api.routes import ai, auth, control, devices, environment, health

api_router = APIRouter(prefix="/api")

# Public — no auth required
api_router.include_router(auth.router)

# Protected — all endpoints require valid JWT
_protected = {"dependencies": [Depends(require_auth)]}
api_router.include_router(health.router,       **_protected)
api_router.include_router(environment.router,  **_protected)
api_router.include_router(devices.router,      **_protected)
api_router.include_router(ai.router,           **_protected)
api_router.include_router(control.router,      **_protected)
