from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.app_setting import AppSetting


OPENROUTER_API_KEY_SETTING = "openrouter_api_key"


def get_setting(session: Session, key: str) -> AppSetting | None:
    return session.get(AppSetting, key)


def get_setting_value(session: Session, key: str) -> str | None:
    setting = get_setting(session, key)
    return setting.value if setting else None


def upsert_setting(session: Session, key: str, value: str) -> AppSetting:
    setting = get_setting(session, key)
    if setting is None:
        setting = AppSetting(key=key, value=value)
    else:
        setting.value = value

    session.add(setting)
    session.commit()
    session.refresh(setting)
    return setting


def delete_setting(session: Session, key: str) -> None:
    session.execute(delete(AppSetting).where(AppSetting.key == key))
    session.commit()
