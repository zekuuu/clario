from fastapi import APIRouter
from pydantic import BaseModel

from app.services.legacy_data_service import LegacyAction, apply_legacy_action, legacy_status

router = APIRouter(prefix="/setup", tags=["setup"])


class LegacyDataRequest(BaseModel):
    action: LegacyAction


@router.get("/legacy-data")
async def get_legacy_data() -> dict[str, object]:
    return legacy_status()


@router.post("/legacy-data")
async def post_legacy_data(request: LegacyDataRequest) -> dict[str, object]:
    return apply_legacy_action(request.action)
