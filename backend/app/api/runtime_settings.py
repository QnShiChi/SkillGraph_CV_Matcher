from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.repositories.app_setting_repository import (
    OPENROUTER_API_KEY_SETTING,
    get_setting_value,
)

OPENROUTER_API_KEY_MODE_SETTING = "openrouter_api_key_mode"
OPENROUTER_API_KEY_MODE_DATABASE_OVERRIDE = "database_override"


def resolve_openrouter_api_key(session: Session) -> tuple[str | None, str]:
    settings = get_settings()
    stored_api_key = get_setting_value(session, OPENROUTER_API_KEY_SETTING)
    key_mode = get_setting_value(session, OPENROUTER_API_KEY_MODE_SETTING)

    if key_mode == OPENROUTER_API_KEY_MODE_DATABASE_OVERRIDE:
        if stored_api_key:
            return stored_api_key, "database"
        return None, "unset"

    env_api_key = settings.openrouter_api_key.strip() if settings.openrouter_api_key else None
    if env_api_key:
        return env_api_key, "env"

    if stored_api_key:
        return stored_api_key, "database"

    return None, "unset"


def hydrate_runtime_settings(session: Session) -> Settings:
    settings = get_settings()
    resolved_api_key, _ = resolve_openrouter_api_key(session)
    settings.openrouter_api_key = resolved_api_key
    return settings


def get_runtime_settings(session: Session = Depends(get_db_session)) -> Settings:
    return hydrate_runtime_settings(session)
