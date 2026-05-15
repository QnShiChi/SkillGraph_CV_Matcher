from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.repositories.app_setting_repository import (
    OPENROUTER_API_KEY_SETTING,
    get_setting_value,
    upsert_setting,
)


def hydrate_runtime_settings(session: Session) -> Settings:
    settings = get_settings()
    stored_api_key = get_setting_value(session, OPENROUTER_API_KEY_SETTING)
    if stored_api_key is not None:
        settings.openrouter_api_key = stored_api_key
        return settings

    env_api_key = settings.openrouter_api_key
    if env_api_key:
        upsert_setting(session, OPENROUTER_API_KEY_SETTING, env_api_key)
    return settings


def get_runtime_settings(session: Session = Depends(get_db_session)) -> Settings:
    return hydrate_runtime_settings(session)
