from pydantic import BaseModel, Field
from typing import Literal


class OpenRouterApiKeyUpdate(BaseModel):
    api_key: str = Field(min_length=1)


class OpenRouterApiKeyStatus(BaseModel):
    has_openrouter_api_key: bool
    has_saved_openrouter_api_key: bool
    active_source: Literal["env", "database", "unset"]


class OpenRouterApiKeyValidationRequest(BaseModel):
    api_key: str = Field(min_length=1)


class OpenRouterConnectionStatus(BaseModel):
    connection_status: str
    detail: str | None = None
