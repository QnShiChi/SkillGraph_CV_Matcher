from __future__ import annotations

import asyncio
import json
from typing import Any

from app.core.config import Settings

class AgentScopeUnavailableError(RuntimeError):
    pass


def run_agentscope_candidate_review(
    *,
    payload: dict[str, Any],
    settings: Settings,
) -> dict[str, Any]:
    """Lazy AgentScope seam for future matcher/explainer/critic orchestration.

    The workflow keeps deterministic verification/ranking as the source of truth,
    then layers AgentScope-based matcher/explainer/critic review on top for
    richer HR-facing output when enabled.
    """
    try:
        from agentscope.agent import ReActAgent
        from agentscope.formatter import OpenAIMultiAgentFormatter
        from agentscope.memory import InMemoryMemory
        from agentscope.message import Msg
        from agentscope.model import OpenAIChatModel
    except ImportError as error:  # pragma: no cover - optional runtime dependency
        raise AgentScopeUnavailableError(
            "AgentScope is not installed. Install backend dependencies with agentscope support to enable multi-agent review."
        ) from error

    return asyncio.run(
        _run_review_pipeline(
            payload=payload,
            settings=settings,
            ReActAgent=ReActAgent,
            OpenAIMultiAgentFormatter=OpenAIMultiAgentFormatter,
            InMemoryMemory=InMemoryMemory,
            Msg=Msg,
            OpenAIChatModel=OpenAIChatModel,
        )
    )


async def _run_review_pipeline(
    *,
    payload: dict[str, Any],
    settings: Settings,
    ReActAgent,
    OpenAIMultiAgentFormatter,
    InMemoryMemory,
    Msg,
    OpenAIChatModel,
) -> dict[str, Any]:
    formatter = OpenAIMultiAgentFormatter()
    model = OpenAIChatModel(
        model_name=settings.openrouter_model,
        api_key=settings.openrouter_api_key or "",
        stream=False,
        client_kwargs={"base_url": settings.openrouter_base_url},
        generate_kwargs={
            "temperature": 0.1,
            "max_tokens": settings.cv_parser_max_output_tokens,
            "response_format": {"type": "json_object"},
        },
    )

    matcher = ReActAgent(
        name="Matcher",
        sys_prompt=(
            "You are the Matcher Agent. Evaluate the candidate against the job and "
            "return JSON with keys: match_summary, strengths, gaps."
        ),
        model=model,
        formatter=formatter,
        memory=InMemoryMemory(),
    )
    explainer = ReActAgent(
        name="Explainer",
        sys_prompt=(
            "You are the Explainer Agent. Turn the matcher result into a concise HR-facing "
            "JSON object with keys: explanation, strengths, gaps."
        ),
        model=model,
        formatter=formatter,
        memory=InMemoryMemory(),
    )
    critic = ReActAgent(
        name="Critic",
        sys_prompt=(
            "You are the Critic Agent. Review the explanation for evidence consistency and "
            "return JSON with keys: critic_review, approved_summary."
        ),
        model=model,
        formatter=formatter,
        memory=InMemoryMemory(),
    )

    matcher_msg = await matcher(
        Msg(
            name="workflow",
            role="user",
            content=json.dumps(payload),
        )
    )
    matcher_data = _load_json_payload(matcher_msg)

    explainer_msg = await explainer(
        Msg(
            name="workflow",
            role="user",
            content=json.dumps(
                {
                    "candidate_name": payload.get("candidate_name"),
                    "matcher_result": matcher_data,
                    "verified_links": payload.get("verified_links", []),
                }
            ),
        )
    )
    explainer_data = _load_json_payload(explainer_msg)

    critic_msg = await critic(
        Msg(
            name="workflow",
            role="user",
            content=json.dumps(
                {
                    "candidate_name": payload.get("candidate_name"),
                    "matcher_result": matcher_data,
                    "explainer_result": explainer_data,
                    "deterministic_summary": payload.get("deterministic_summary"),
                }
            ),
        )
    )
    critic_data = _load_json_payload(critic_msg)

    return {
        "match_summary": matcher_data.get(
            "match_summary",
            payload.get("deterministic_summary", "AgentScope review completed."),
        ),
        "final_report_json": {
            "strengths": explainer_data.get("strengths", matcher_data.get("strengths", [])),
            "gaps": explainer_data.get("gaps", matcher_data.get("gaps", [])),
            "explanation": explainer_data.get(
                "explanation",
                payload.get("deterministic_summary", "AgentScope explanation unavailable."),
            ),
            "critic_review": critic_data.get(
                "critic_review",
                critic_data.get("approved_summary", "Critic review unavailable."),
            ),
        },
    }


def _load_json_payload(message) -> dict[str, Any]:
    metadata = getattr(message, "metadata", None)
    if isinstance(metadata, dict):
        return metadata

    text = None
    if hasattr(message, "get_text_content"):
        text = message.get_text_content()
    elif hasattr(message, "content"):
        text = message.content

    if isinstance(text, str):
        try:
            payload = json.loads(text)
            if isinstance(payload, dict):
                return payload
        except json.JSONDecodeError as error:
            raise AgentScopeUnavailableError("AgentScope returned non-JSON content.") from error

    raise AgentScopeUnavailableError("AgentScope returned no structured review payload.")
