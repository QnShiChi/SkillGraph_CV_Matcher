from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SkillGraph CV Matcher API"
    postgres_db: str
    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int
    neo4j_uri: str
    neo4j_username: str
    neo4j_password: str
    openrouter_api_key: str | None = None
    openrouter_base_url: str = "https://openrouter.ai/api/v1"
    openrouter_model: str = "openai/gpt-5.5"
    jd_parser_mode: Literal["rule_based", "hybrid", "llm_only"] = "rule_based"
    jd_parser_temperature: float = 0.1
    jd_parser_max_output_tokens: int = 12000
    jd_parser_timeout_seconds: int = 90
    jd_parser_enable_fallback: bool = True
    cv_parser_mode: Literal["rule_based", "hybrid", "llm_only"] = "rule_based"
    cv_parser_temperature: float = 0.1
    cv_parser_max_output_tokens: int = 12000
    cv_parser_timeout_seconds: int = 90
    cv_parser_enable_fallback: bool = True

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def sqlalchemy_database_url(self) -> str:
        return (
            f"postgresql+psycopg://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
