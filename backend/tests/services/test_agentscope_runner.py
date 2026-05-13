from __future__ import annotations

import builtins

import pytest

from app.core.config import Settings
from app.services.agentscope_runner import (
    AgentScopeUnavailableError,
    run_agentscope_candidate_review,
)


def _make_settings() -> Settings:
    return Settings(
        postgres_db="skillgraph",
        postgres_user="skillgraph_user",
        postgres_password="skillgraph_password",
        postgres_host="localhost",
        postgres_port=5432,
        neo4j_uri="bolt://localhost:7687",
        neo4j_username="neo4j",
        neo4j_password="password",
        openrouter_api_key="test-key",
        openrouter_base_url="https://openrouter.ai/api/v1",
        openrouter_model="openai/gpt-5.5",
        jd_parser_mode="rule_based",
        jd_parser_temperature=0.1,
        jd_parser_max_output_tokens=12000,
        jd_parser_timeout_seconds=90,
        jd_parser_enable_fallback=True,
        cv_parser_mode="rule_based",
        cv_parser_temperature=0.1,
        cv_parser_max_output_tokens=12000,
        cv_parser_timeout_seconds=90,
        cv_parser_enable_fallback=True,
        matching_review_mode="agentscope",
        matching_review_timeout_seconds=60,
    )


def test_run_agentscope_candidate_review_raises_clear_error_when_agentscope_missing(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    original_import = builtins.__import__

    def _fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name.startswith("agentscope"):
            raise ImportError("agentscope missing")
        return original_import(name, globals, locals, fromlist, level)

    monkeypatch.setattr(builtins, "__import__", _fake_import)

    with pytest.raises(AgentScopeUnavailableError, match="AgentScope is not installed"):
        run_agentscope_candidate_review(
            payload={"candidate_name": "Test Candidate"},
            settings=_make_settings(),
        )
