from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.session import get_db_session
from app.repositories.app_setting_repository import (
    OPENROUTER_API_KEY_SETTING,
    delete_setting,
    get_setting_value,
    upsert_setting,
)
from app.core.config import get_settings
from app.schemas.settings import (
    OpenRouterApiKeyStatus,
    OpenRouterApiKeyUpdate,
    OpenRouterApiKeyValidationRequest,
    OpenRouterConnectionStatus,
)
from app.services.openrouter_client import OpenRouterClient, OpenRouterError

router = APIRouter(prefix="/api/settings", tags=["settings"])


@router.get("/openrouter-api-key", response_model=OpenRouterApiKeyStatus)
def get_openrouter_api_key(session: Session = Depends(get_db_session)) -> OpenRouterApiKeyStatus:
    return OpenRouterApiKeyStatus(
        has_openrouter_api_key=bool(get_setting_value(session, OPENROUTER_API_KEY_SETTING))
    )


@router.put("/openrouter-api-key", response_model=OpenRouterApiKeyStatus)
def put_openrouter_api_key(
    payload: OpenRouterApiKeyUpdate,
    session: Session = Depends(get_db_session),
) -> OpenRouterApiKeyStatus:
    api_key = payload.api_key.strip()
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API key cannot be empty.",
        )

    upsert_setting(session, OPENROUTER_API_KEY_SETTING, api_key)
    return OpenRouterApiKeyStatus(has_openrouter_api_key=True)


@router.delete("/openrouter-api-key", response_model=OpenRouterApiKeyStatus)
def delete_openrouter_api_key(
    session: Session = Depends(get_db_session),
) -> OpenRouterApiKeyStatus:
    delete_setting(session, OPENROUTER_API_KEY_SETTING)
    return OpenRouterApiKeyStatus(has_openrouter_api_key=False)


@router.get("/openrouter-api-key/status", response_model=OpenRouterConnectionStatus)
def get_openrouter_api_key_status(
    session: Session = Depends(get_db_session),
) -> OpenRouterConnectionStatus:
    api_key = get_setting_value(session, OPENROUTER_API_KEY_SETTING)
    return _check_openrouter_connection(api_key)


@router.post("/openrouter-api-key/validate", response_model=OpenRouterConnectionStatus)
def validate_openrouter_api_key(
    payload: OpenRouterApiKeyValidationRequest,
) -> OpenRouterConnectionStatus:
    return _check_openrouter_connection(payload.api_key.strip())


def _check_openrouter_connection(api_key: str | None) -> OpenRouterConnectionStatus:
    if not api_key:
        return OpenRouterConnectionStatus(connection_status="unset", detail=None)

    settings = get_settings()
    client = OpenRouterClient(
        api_key=api_key,
        base_url=settings.openrouter_base_url,
        model=settings.openrouter_model,
        temperature=0.0,
        max_output_tokens=1,
        timeout_seconds=15,
        app_name=settings.app_name,
    )
    try:
        client.validate_connection()
        return OpenRouterConnectionStatus(connection_status="connected", detail="Connected to OpenRouter.")
    except OpenRouterError as error:
        return OpenRouterConnectionStatus(connection_status="failed", detail=str(error))
