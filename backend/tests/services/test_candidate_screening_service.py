from __future__ import annotations

from app.core.config import Settings
from app.models.candidate import Candidate
from app.repositories.job_repository import create_job
from app.schemas.job import JobCreate
from app.services.candidate_screening_service import screen_and_rank_job_candidates


def _create_job(session):
    job = create_job(
        session,
        JobCreate(
            title="Backend Engineer",
            description="Build backend services",
            required_skills_text="Python\nFastAPI\nPostgreSQL",
            status="draft",
        ),
    )
    job.structured_jd_json = {
        "technical_skills": [
            {"name": "Python", "canonical": "python", "requirement_type": "must_have"},
            {"name": "FastAPI", "canonical": "fastapi", "requirement_type": "must_have"},
        ],
        "platforms_cloud": [
            {"name": "AWS", "canonical": "aws", "requirement_type": "nice_to_have"},
        ],
        "tooling_devops": [
            {"name": "Docker", "canonical": "docker", "requirement_type": "nice_to_have"},
        ],
        "required_skills": [
            {"name": "Python", "canonical": "python", "requirement_type": "must_have"},
            {"name": "FastAPI", "canonical": "fastapi", "requirement_type": "must_have"},
            {"name": "AWS", "canonical": "aws", "requirement_type": "nice_to_have"},
            {"name": "Docker", "canonical": "docker", "requirement_type": "nice_to_have"},
        ],
    }
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def _make_settings(**overrides) -> Settings:
    values = {
        "postgres_db": "skillgraph",
        "postgres_user": "skillgraph_user",
        "postgres_password": "skillgraph_password",
        "postgres_host": "localhost",
        "postgres_port": 5432,
        "neo4j_uri": "bolt://localhost:7687",
        "neo4j_username": "neo4j",
        "neo4j_password": "password",
        "openrouter_api_key": "test-key",
        "openrouter_base_url": "https://openrouter.ai/api/v1",
        "openrouter_model": "openai/gpt-5.5",
        "jd_parser_mode": "rule_based",
        "jd_parser_temperature": 0.1,
        "jd_parser_max_output_tokens": 12000,
        "jd_parser_timeout_seconds": 90,
        "jd_parser_enable_fallback": True,
        "cv_parser_mode": "rule_based",
        "cv_parser_temperature": 0.1,
        "cv_parser_max_output_tokens": 12000,
        "cv_parser_timeout_seconds": 90,
        "cv_parser_enable_fallback": True,
        "matching_review_mode": "agentscope",
        "matching_review_timeout_seconds": 60,
    }
    values.update(overrides)
    return Settings(**values)


def _create_candidate(
    session,
    *,
    job_id: int,
    full_name: str,
    resume_text: str,
    technical: list[str],
    cloud: list[str] | None = None,
    tooling: list[str] | None = None,
) -> Candidate:
    candidate = Candidate(
        job_id=job_id,
        full_name=full_name,
        email=None,
        resume_text=resume_text,
        skills_text="\n".join(technical),
        source_type="cv_pdf",
        source_file_name=f"{full_name}.pdf",
        extract_source="text_layer",
        parse_status="processed",
        parse_source="rule_based",
        parse_confidence=0.8,
        graph_sync_status="synced",
        graph_sync_error=None,
        graph_synced_at=None,
        structured_cv_json={
            "technical_skills": [
                {
                    "name": name,
                    "canonical": name.lower(),
                    "evidence": [{"text": f"Built with {name}", "section_origin": "experience"}],
                }
                for name in technical
            ],
            "platforms_cloud": [
                {"name": name, "canonical": name.lower()}
                for name in (cloud or [])
            ],
            "tooling_devops": [
                {"name": name, "canonical": name.lower()}
                for name in (tooling or [])
            ],
            "experience": [{"text": "Built APIs in production"}],
        },
        status="new",
    )
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return candidate


def test_screen_and_rank_job_candidates_rejects_candidate_without_project_link(session) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="No Link Candidate",
        resume_text="Summary\nPython engineer with FastAPI and Docker experience.",
        technical=["Python", "FastAPI"],
        tooling=["Docker"],
    )

    result = screen_and_rank_job_candidates(
        session,
        job_id=job.id,
        settings=_make_settings(),
    )

    assert result["total_candidates"] == 1
    assert result["ranked_count"] == 0
    assert result["rejected_count"] == 1
    rejected = result["rejected_candidates"][0]
    assert rejected.screening_decision == "reject"
    assert rejected.verification_status == "missing_evidence"
    assert rejected.match_rank is None


def test_screen_and_rank_job_candidates_rejects_candidate_with_invalid_project_link(
    session,
    monkeypatch,
) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Broken Link Candidate",
        resume_text="Summary\nGitHub: https://github.com/example/missing-repo",
        technical=["Python", "FastAPI"],
    )

    monkeypatch.setattr(
        "app.services.candidate_screening_service._probe_link",
        lambda url, timeout_seconds=5: {
            "url": url,
            "reachable": False,
            "status_code": None,
            "final_url": url,
            "reason": "network error",
        },
    )

    result = screen_and_rank_job_candidates(
        session,
        job_id=job.id,
        settings=_make_settings(),
    )

    assert result["ranked_count"] == 0
    assert result["rejected_count"] == 1
    rejected = result["rejected_candidates"][0]
    assert rejected.verification_status == "invalid_link"
    assert rejected.screening_reason is not None


def test_screen_and_rank_job_candidates_ranks_only_verified_candidates(session, monkeypatch) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Top Candidate",
        resume_text=(
            "Learn English Project\n"
            "Vue.js JavaScript ASP.NET Core REST API progress tracking quiz authentication.\n"
            "GitHub: https://github.com/example/top-candidate\n"
            "Portfolio: https://top.example.dev/project-api"
        ),
        technical=["Python", "FastAPI"],
        cloud=["AWS"],
        tooling=["Docker"],
    )
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Second Candidate",
        resume_text=(
            "Task Manager Platform\n"
            "Python dashboard Docker project with backend APIs.\n"
            "Portfolio: https://candidate.example.dev/project"
        ),
        technical=["Python"],
        tooling=["Docker"],
    )

    monkeypatch.setattr(
        "app.services.candidate_screening_service._probe_link",
        lambda url, timeout_seconds=5: {
            "url": url,
            "reachable": True,
            "status_code": 200,
            "final_url": url,
            "reason": None,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._fetch_link_content",
        lambda url, timeout_seconds=5: (
            {
                "url": url,
                "content": "Task Manager Platform Python dashboard Docker backend APIs kanban tasks.",
                "title": "Task Manager Platform",
                "reachable": True,
            }
            if "candidate.example.dev" in url
            else {
                "url": url,
                "content": "Learn English Project Vue.js JavaScript ASP.NET Core REST API progress tracking quiz authentication.",
                "title": "Learn English Project",
                "reachable": True,
            }
        ),
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service.run_agentscope_candidate_review",
        lambda **kwargs: {
            "match_summary": "AgentScope reviewed the candidate.",
            "final_report_json": {
                "strengths": ["python"],
                "gaps": [],
                "explanation": "AgentScope explanation.",
                "critic_review": "Approved by critic.",
            },
        },
    )

    result = screen_and_rank_job_candidates(
        session,
        job_id=job.id,
        settings=_make_settings(),
    )

    assert result["total_candidates"] == 2
    assert result["ranked_count"] == 2
    assert result["rejected_count"] == 0
    ranked = result["ranked_candidates"]
    assert [candidate.full_name for candidate in ranked] == ["Top Candidate", "Second Candidate"]
    assert ranked[0].match_rank == 1
    assert ranked[1].match_rank == 2
    assert ranked[0].match_score is not None
    assert ranked[1].match_score is not None
    assert ranked[0].match_score > ranked[1].match_score
    assert ranked[0].verification_status == "verified"
    assert ranked[0].verified_links_json is not None
    assert ranked[0].verified_links_json[0]["claim_match_status"] == "matched"


def test_screen_and_rank_job_candidates_uses_agentscope_review_for_verified_candidates(
    session,
    monkeypatch,
) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Agent Candidate",
        resume_text="GitHub: https://github.com/example/agent-candidate",
        technical=["Python", "FastAPI"],
    )

    monkeypatch.setattr(
        "app.services.candidate_screening_service._probe_link",
        lambda url, timeout_seconds=5: {
            "url": url,
            "reachable": True,
            "status_code": 200,
            "final_url": url,
            "reason": None,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._fetch_link_content",
        lambda url, timeout_seconds=5: {
            "url": url,
            "content": "Agent Candidate Python FastAPI backend project with APIs and deployment.",
            "title": "Agent Candidate Project",
            "reachable": True,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service.run_agentscope_candidate_review",
        lambda **kwargs: {
            "match_summary": "AgentScope matcher accepted the candidate.",
            "final_report_json": {
                "strengths": ["python", "fastapi"],
                "gaps": [],
                "explanation": "AgentScope explanation.",
                "critic_review": "AgentScope critic review.",
            },
        },
    )

    result = screen_and_rank_job_candidates(
        session,
        job_id=job.id,
        settings=_make_settings(),
    )

    ranked = result["ranked_candidates"][0]
    assert ranked.match_summary == "AgentScope matcher accepted the candidate."
    assert ranked.final_report_json is not None
    assert ranked.final_report_json["explanation"] == "AgentScope explanation."


def test_screen_and_rank_job_candidates_rejects_reachable_link_when_project_claim_does_not_match(
    session,
    monkeypatch,
) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Mismatch Candidate",
        resume_text=(
            "Inventory AI Platform\n"
            "Built with Python FastAPI recommendation engine.\n"
            "GitHub: https://github.com/example/mismatch-project"
        ),
        technical=["Python", "FastAPI"],
    )

    monkeypatch.setattr(
        "app.services.candidate_screening_service._probe_link",
        lambda url, timeout_seconds=5: {
            "url": url,
            "reachable": True,
            "status_code": 200,
            "final_url": url,
            "reason": None,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._fetch_link_content",
        lambda url, timeout_seconds=5: {
            "url": url,
            "content": "Wedding photography gallery booking website built with PHP and WordPress.",
            "title": "Wedding Gallery Site",
            "reachable": True,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service.run_agentscope_candidate_review",
        lambda **kwargs: {
            "match_summary": "AgentScope reviewed the mismatch candidate.",
            "final_report_json": {
                "strengths": [],
                "gaps": ["evidence mismatch"],
                "explanation": "AgentScope explanation.",
                "critic_review": "Rejected by critic.",
            },
        },
    )

    result = screen_and_rank_job_candidates(
        session,
        job_id=job.id,
        settings=_make_settings(),
    )

    assert result["ranked_count"] == 0
    assert result["rejected_count"] == 1
    rejected = result["rejected_candidates"][0]
    assert rejected.verification_status == "weak_evidence"
    assert rejected.screening_decision == "reject"
    assert rejected.verified_links_json is not None
    assert rejected.verified_links_json[0]["claim_match_status"] == "mismatch"
