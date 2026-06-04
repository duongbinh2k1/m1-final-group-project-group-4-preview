from fastapi import APIRouter, Depends

from app.api.deps import get_store
from app.core.store import AppStore
from app.models.schemas import HealthResponse, StateResponse

router = APIRouter(tags=["system"])


@router.get("/health", response_model=HealthResponse)
def health(store: AppStore = Depends(get_store)):
    return HealthResponse(
        status="ok",
        mqtt_status=store.mqtt_status,
        last_updated=store.last_updated,
        history_counts={
            "environment": len(store.history_environment),
            "devices":     len(store.history_devices),
            "ai":          len(store.history_ai),
        },
    )


@router.get("/state", response_model=StateResponse)
def get_state(store: AppStore = Depends(get_store)):
    """Full snapshot — FE calls once on load, then uses WebSocket."""
    return StateResponse(
        environment=store.environment,
        devices=store.devices,
        ai=store.ai,
        last_updated=store.last_updated,
        mqtt_status=store.mqtt_status,
    )
