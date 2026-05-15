import pytest

from app.api.runtime_settings import get_runtime_settings
from app.core.config import get_settings
from app.repositories.app_setting_repository import OPENROUTER_API_KEY_SETTING, get_setting_value
from app.repositories.app_setting_repository import upsert_setting


def test_openrouter_api_key_settings_roundtrip(client, session) -> None:
    response = client.get("/api/settings/openrouter-api-key")

    assert response.status_code == 200
    assert response.json() == {
        "has_openrouter_api_key": False,
        "has_saved_openrouter_api_key": False,
        "active_source": "unset",
    }

    response = client.put(
        "/api/settings/openrouter-api-key",
        json={"api_key": "server-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "has_openrouter_api_key": True,
        "has_saved_openrouter_api_key": True,
        "active_source": "database",
    }
    assert get_setting_value(session, OPENROUTER_API_KEY_SETTING) == "server-secret"

    response = client.get("/api/settings/openrouter-api-key")
    assert response.status_code == 200
    assert response.json() == {
        "has_openrouter_api_key": True,
        "has_saved_openrouter_api_key": True,
        "active_source": "database",
    }

    response = client.delete("/api/settings/openrouter-api-key")
    assert response.status_code == 200
    assert response.json() == {
        "has_openrouter_api_key": False,
        "has_saved_openrouter_api_key": False,
        "active_source": "unset",
    }
    assert get_setting_value(session, OPENROUTER_API_KEY_SETTING) is None


def test_openrouter_api_key_validation_and_status(client, session, monkeypatch: pytest.MonkeyPatch) -> None:
    def _fake_validate(self) -> None:
        del self

    monkeypatch.setattr(
        "app.services.openrouter_client.OpenRouterClient.validate_connection",
        _fake_validate,
    )

    response = client.post(
        "/api/settings/openrouter-api-key/validate",
        json={"api_key": "server-secret"},
    )

    assert response.status_code == 200
    assert response.json()["connection_status"] == "connected"

    response = client.put(
        "/api/settings/openrouter-api-key",
        json={"api_key": "server-secret"},
    )
    assert response.status_code == 200

    response = client.get("/api/settings/openrouter-api-key/status")
    assert response.status_code == 200
    assert response.json()["connection_status"] == "connected"


def test_runtime_settings_hydrate_openrouter_key_from_database(session, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "")
    get_settings.cache_clear()

    upsert_setting(session, OPENROUTER_API_KEY_SETTING, "db-secret")

    runtime_settings = get_runtime_settings(session)

    assert runtime_settings.openrouter_api_key == "db-secret"
    assert get_settings().openrouter_api_key == "db-secret"


def test_runtime_settings_prefers_openrouter_key_from_env_over_database(
    session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "env-secret")
    get_settings.cache_clear()

    upsert_setting(session, OPENROUTER_API_KEY_SETTING, "db-secret")

    runtime_settings = get_runtime_settings(session)

    assert runtime_settings.openrouter_api_key == "env-secret"
    assert get_setting_value(session, OPENROUTER_API_KEY_SETTING) == "db-secret"


def test_runtime_settings_keeps_env_key_out_of_database_when_database_is_empty(
    session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "env-secret")
    get_settings.cache_clear()

    runtime_settings = get_runtime_settings(session)

    assert runtime_settings.openrouter_api_key == "env-secret"
    assert get_setting_value(session, OPENROUTER_API_KEY_SETTING) is None


def test_settings_clear_disables_env_key_until_user_saves_a_replacement(
    client,
    session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_validate(self) -> None:
        del self

    monkeypatch.setenv("OPENROUTER_API_KEY", "env-secret")
    monkeypatch.setattr(
        "app.services.openrouter_client.OpenRouterClient.validate_connection",
        _fake_validate,
    )
    get_settings.cache_clear()

    upsert_setting(session, OPENROUTER_API_KEY_SETTING, "db-secret")

    response = client.delete("/api/settings/openrouter-api-key")

    assert response.status_code == 200
    assert response.json() == {
        "has_openrouter_api_key": False,
        "has_saved_openrouter_api_key": False,
        "active_source": "unset",
    }

    response = client.get("/api/settings/openrouter-api-key/status")
    assert response.status_code == 200
    assert response.json()["connection_status"] == "unset"


def test_settings_save_replacement_key_after_clear_overrides_env_key(
    client,
    session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    def _fake_validate(self) -> None:
        del self

    monkeypatch.setenv("OPENROUTER_API_KEY", "env-secret")
    monkeypatch.setattr(
        "app.services.openrouter_client.OpenRouterClient.validate_connection",
        _fake_validate,
    )
    get_settings.cache_clear()

    upsert_setting(session, OPENROUTER_API_KEY_SETTING, "db-secret")

    response = client.delete("/api/settings/openrouter-api-key")
    assert response.status_code == 200

    response = client.put(
        "/api/settings/openrouter-api-key",
        json={"api_key": "replacement-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "has_openrouter_api_key": True,
        "has_saved_openrouter_api_key": True,
        "active_source": "database",
    }

    response = client.get("/api/settings/openrouter-api-key/status")
    assert response.status_code == 200
    assert response.json()["connection_status"] == "connected"

    runtime_settings = get_runtime_settings(session)
    assert runtime_settings.openrouter_api_key == "replacement-secret"
