import pytest

from app.repositories.app_setting_repository import OPENROUTER_API_KEY_SETTING, get_setting_value


def test_openrouter_api_key_settings_roundtrip(client, session) -> None:
    response = client.get("/api/settings/openrouter-api-key")

    assert response.status_code == 200
    assert response.json() == {"has_openrouter_api_key": False}

    response = client.put(
        "/api/settings/openrouter-api-key",
        json={"api_key": "server-secret"},
    )

    assert response.status_code == 200
    assert response.json() == {"has_openrouter_api_key": True}
    assert get_setting_value(session, OPENROUTER_API_KEY_SETTING) == "server-secret"

    response = client.get("/api/settings/openrouter-api-key")
    assert response.status_code == 200
    assert response.json() == {"has_openrouter_api_key": True}

    response = client.delete("/api/settings/openrouter-api-key")
    assert response.status_code == 200
    assert response.json() == {"has_openrouter_api_key": False}
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
