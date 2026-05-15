from pydantic import BaseModel, Field


class OpenRouterApiKeyUpdate(BaseModel):
    api_key: str = Field(min_length=1)


class OpenRouterApiKeyStatus(BaseModel):
    has_openrouter_api_key: bool


class OpenRouterApiKeyValidationRequest(BaseModel):
    api_key: str = Field(min_length=1)


class OpenRouterConnectionStatus(BaseModel):
    connection_status: str
    detail: str | None = None
