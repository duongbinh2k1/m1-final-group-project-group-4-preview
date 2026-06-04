from fastapi import APIRouter, Depends, Query

from app.api.deps import get_store
from app.core.store import AppStore
from app.models.schemas import EnvironmentPayload, HistoryResponse
from app.services import supabase_db

router = APIRouter(prefix="/environment", tags=["environment"])


@router.get("/latest", response_model=EnvironmentPayload | None)
def get_latest(store: AppStore = Depends(get_store)):
    """Latest environment reading (from in-memory, always fast)."""
    return store.environment


@router.get("/history", response_model=HistoryResponse)
async def get_history(limit: int = Query(default=100, ge=1, le=1000)):
    """Environment history from Supabase (persistent)."""
    data = await supabase_db.get_environment_history(limit)
    return HistoryResponse(data=data, count=len(data))
