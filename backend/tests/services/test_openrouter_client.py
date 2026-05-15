from __future__ import annotations

import httpx
import pytest

from app.services.openrouter_client import OpenRouterClient, OpenRouterError


class _FakeResponse:
    def __init__(self, payload: dict, status_code: int = 200) -> None:
        self._payload = payload
        self.status_code = status_code
        self.text = str(payload)

    def raise_for_status(self) -> None:
        if self.status_code >= 400:
            request = httpx.Request("POST", "https://openrouter.ai/api/v1/chat/completions")
            response = httpx.Response(self.status_code, request=request, json=self._payload)
            raise httpx.HTTPStatusError("bad response", request=request, response=response)

    def json(self) -> dict:
        return self._payload


class _FakeClient:
    def __init__(
        self,
        *,
        post_response: _FakeResponse | Exception | None = None,
        get_response: _FakeResponse | Exception | None = None,
    ) -> None:
        self._post_response = post_response
        self._get_response = get_response
        self.post_calls: list[tuple[tuple, dict]] = []
        self.get_calls: list[tuple[tuple, dict]] = []

    def __enter__(self) -> "_FakeClient":
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        return None

    def post(self, *_args, **_kwargs):
        self.post_calls.append((_args, _kwargs))
        if isinstance(self._post_response, Exception):
            raise self._post_response
        if self._post_response is None:
            raise AssertionError("Unexpected POST request")
        return self._post_response

    def get(self, *_args, **_kwargs):
        self.get_calls.append((_args, _kwargs))
        if isinstance(self._get_response, Exception):
            raise self._get_response
        if self._get_response is None:
            raise AssertionError("Unexpected GET request")
        return self._get_response


def _make_client() -> OpenRouterClient:
    return OpenRouterClient(
        api_key="test-key",
        base_url="https://openrouter.ai/api/v1",
        model="openai/gpt-5.5",
        temperature=0.1,
        max_output_tokens=1000,
        timeout_seconds=30,
        app_name="SkillGraph CV Matcher API",
    )


def test_openrouter_client_returns_message_content(monkeypatch: pytest.MonkeyPatch) -> None:
    response = _FakeResponse(
        {
            "choices": [
                {
                    "message": {
                        "content": '{"title":"Backend Engineer","summary":"Build APIs","required_skills":[]}',
                    }
                }
            ]
        }
    )
    monkeypatch.setattr(httpx, "Client", lambda **_kwargs: _FakeClient(post_response=response))

    result = _make_client().create_chat_completion(
        system_prompt="system",
        user_prompt="user",
    )

    assert '"title":"Backend Engineer"' in result


def test_openrouter_client_raises_on_http_error(monkeypatch: pytest.MonkeyPatch) -> None:
    response = _FakeResponse({"error": {"message": "provider error"}}, status_code=502)
    monkeypatch.setattr(httpx, "Client", lambda **_kwargs: _FakeClient(post_response=response))

    with pytest.raises(OpenRouterError, match="provider error"):
        _make_client().create_chat_completion(
            system_prompt="system",
            user_prompt="user",
        )


def test_openrouter_client_raises_on_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    timeout = httpx.TimeoutException("timed out")
    monkeypatch.setattr(httpx, "Client", lambda **_kwargs: _FakeClient(post_response=timeout))

    with pytest.raises(OpenRouterError, match="timed out"):
        _make_client().create_chat_completion(
            system_prompt="system",
            user_prompt="user",
        )


def test_openrouter_client_validate_connection_uses_authenticated_chat_completion(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = _FakeResponse(
        {
            "choices": [
                {
                    "message": {
                        "content": "OK",
                    }
                }
            ]
        }
    )
    fake_client = _FakeClient(post_response=response)
    monkeypatch.setattr(httpx, "Client", lambda **_kwargs: fake_client)

    _make_client().validate_connection()

    assert len(fake_client.post_calls) == 1
    assert len(fake_client.get_calls) == 0


def test_openrouter_client_validate_connection_raises_when_authenticated_request_fails(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = _FakeResponse({"error": {"message": "Missing Authentication header"}}, status_code=401)
    monkeypatch.setattr(httpx, "Client", lambda **_kwargs: _FakeClient(post_response=response))

    with pytest.raises(OpenRouterError, match="Missing Authentication header"):
        _make_client().validate_connection()
