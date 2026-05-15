from app.core.config import get_settings


def test_cors_allowed_origins_defaults_to_localhost(monkeypatch) -> None:
    monkeypatch.delenv("CORS_ALLOWED_ORIGINS", raising=False)
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.cors_allowed_origins == ["http://localhost:3000"]


def test_cors_allowed_origins_supports_comma_separated_values(monkeypatch) -> None:
    monkeypatch.setenv(
        "CORS_ALLOWED_ORIGINS",
        "https://skillgraph.eduteam.vn, https://www.skillgraph.eduteam.vn ,http://localhost:3000",
    )
    get_settings.cache_clear()

    settings = get_settings()

    assert settings.cors_allowed_origins == [
        "https://skillgraph.eduteam.vn",
        "https://www.skillgraph.eduteam.vn",
        "http://localhost:3000",
    ]
