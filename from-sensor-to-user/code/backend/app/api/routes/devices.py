from fastapi import APIRouter, Depends, Query

from app.api.deps import get_store
from app.core.store import AppStore
from app.models.schemas import DevicesPayload, HistoryResponse
from app.services import supabase_db

router = APIRouter(prefix="/devices", tags=["devices"])


@router.get("/latest", response_model=DevicesPayload | None)
def get_latest(store: AppStore = Depends(get_store)):
    """Latest device state (from in-memory, always fast)."""
    return store.devices


@router.get("/history", response_model=HistoryResponse)
async def get_history(limit: int = Query(default=100, ge=1, le=1000)):
    """Device state history from Supabase (persistent)."""
    data = await supabase_db.get_devices_history(limit)
    return HistoryResponse(data=data, count=len(data))
