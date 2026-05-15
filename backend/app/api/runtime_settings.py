from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db_session
from app.repositories.app_setting_repository import (
    OPENROUTER_API_KEY_SETTING,
    get_setting_value,
)


def get_runtime_settings(session: Session = Depends(get_db_session)) -> Settings:
    settings = get_settings()
    stored_api_key = get_setting_value(session, OPENROUTER_API_KEY_SETTING)
    if stored_api_key is None:
        return settings

    return settings.model_copy(update={"openrouter_api_key": stored_api_key})
