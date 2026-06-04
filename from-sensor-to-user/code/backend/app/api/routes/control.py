import asyncio

from fastapi import APIRouter, Depends, HTTPException, status

from app.api.deps import get_store
from app.core.store import AppStore
from app.models.schemas import CommandPayload, ControlPayload
from app.services.mqtt import _loop, publish_command, publish_control

router = APIRouter(prefix="/control", tags=["control"])


def _broadcast():
    from app.services.broadcaster import broadcast_state
    if _loop and not _loop.is_closed():
        asyncio.run_coroutine_threadsafe(broadcast_state(), _loop)


@router.get("", response_model=ControlPayload)
def get_control(store: AppStore = Depends(get_store)):
    return store.control


@router.post("", response_model=ControlPayload)
def set_control(payload: ControlPayload, store: AppStore = Depends(get_store)):
    """
    Update control mode + thresholds (persistent, retained on MQTT).
    Config saved locally even if MQTT is down — firmware gets it on reconnect.
    """
    store.update_control(payload)
    _broadcast()

    if not publish_control(payload):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Config saved but MQTT is offline — firmware will receive it on reconnect.",
        )
    return store.control


@router.post("/command", status_code=status.HTTP_204_NO_CONTENT)
def send_command(payload: CommandPayload):
    """
    Send a one-shot actuator command to firmware (not retained).
    Pump supports optional auto-off duration (seconds).
    Fan has no auto-off.
    """
    if not publish_command(payload):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MQTT is offline — command not sent.",
        )
