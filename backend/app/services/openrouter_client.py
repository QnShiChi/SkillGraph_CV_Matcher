from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import httpx


class OpenRouterError(RuntimeError):
    pass


class OpenRouterConfigurationError(OpenRouterError):
    pass


@dataclass(slots=True)
class OpenRouterClient:
    api_key: str
    base_url: str
    model: str
    temperature: float
    max_output_tokens: int
    timeout_seconds: int
    app_name: str

    def validate_connection(self) -> None:
        if not self.api_key:
            raise OpenRouterConfigurationError(
                "OPENROUTER_API_KEY is required when a parser mode uses OpenRouter."
            )

        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.get(
                    f"{self.base_url.rstrip('/')}/models",
                    headers=_build_headers(self.api_key, self.app_name),
                )
                response.raise_for_status()
        except httpx.TimeoutException as error:
            raise OpenRouterError("OpenRouter request timed out.") from error
        except httpx.HTTPStatusError as error:
            detail = _extract_error_detail(error.response)
            raise OpenRouterError(f"OpenRouter request failed: {detail}") from error
        except httpx.HTTPError as error:
            raise OpenRouterError("OpenRouter request failed.") from error

    def create_chat_completion(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
    ) -> str:
        if not self.api_key:
            raise OpenRouterConfigurationError(
                "OPENROUTER_API_KEY is required when a parser mode uses OpenRouter."
            )

        payload = {
            "model": self.model,
            "temperature": self.temperature,
            "max_tokens": self.max_output_tokens,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }
        try:
            with httpx.Client(timeout=self.timeout_seconds) as client:
                response = client.post(
                    f"{self.base_url.rstrip('/')}/chat/completions",
                    json=payload,
                    headers=_build_headers(self.api_key, self.app_name),
                )
                response.raise_for_status()
        except httpx.TimeoutException as error:
            raise OpenRouterError("OpenRouter request timed out.") from error
        except httpx.HTTPStatusError as error:
            detail = _extract_error_detail(error.response)
            raise OpenRouterError(f"OpenRouter request failed: {detail}") from error
        except httpx.HTTPError as error:
            raise OpenRouterError("OpenRouter request failed.") from error

        body = response.json()
        try:
            content = body["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise OpenRouterError("OpenRouter returned an unexpected response shape.") from error

        if isinstance(content, str):
            return content
        if isinstance(content, list):
            text_parts = [
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            ]
            if text_parts:
                return "".join(text_parts)

        raise OpenRouterError("OpenRouter returned empty response content.")


def _extract_error_detail(response: httpx.Response) -> str:
    try:
        payload: Any = response.json()
    except ValueError:
        return response.text or f"HTTP {response.status_code}"

    if isinstance(payload, dict):
        if isinstance(payload.get("error"), dict):
            message = payload["error"].get("message")
            if isinstance(message, str) and message:
                return message
        detail = payload.get("detail")
        if isinstance(detail, str) and detail:
            return detail

    return response.text or f"HTTP {response.status_code}"


def _build_headers(api_key: str, app_name: str) -> dict[str, str]:
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://skillgraph-cv-matcher.local",
        "X-Title": app_name,
    }
