from __future__ import annotations

from app.core.config import Settings
from app.models.candidate import Candidate
from app.repositories.job_repository import create_job
from app.schemas.job import JobCreate
from app.services.candidate_screening_service import _score_candidate, screen_and_rank_job_candidates


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
        "matching_review_mode": "deterministic",
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


def test_screen_and_rank_job_candidates_uses_agentscope_review_when_enabled(
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
        settings=_make_settings(matching_review_mode="agentscope"),
    )

    ranked = result["ranked_candidates"][0]
    assert ranked.match_summary == "AgentScope matcher accepted the candidate."
    assert ranked.final_report_json is not None
    assert ranked.final_report_json["explanation"] == "AgentScope explanation."
    assert "graph_scoring" in ranked.final_report_json


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


def test_score_candidate_uses_graph_partial_credit_when_exact_skill_is_missing(session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Graph Candidate",
        resume_text="GitHub: https://github.com/example/graph-candidate",
        technical=["Java", "Docker"],
    )
    candidate.verified_links_json = [{"final_url": "https://github.com/example/graph-candidate"}]

    job_payload = {
        "required_skills": [
            {"canonical": "spring_boot", "requirement_type": "must_have"},
            {"canonical": "docker", "requirement_type": "must_have"},
        ],
        "technical_skills": [{"canonical": "spring_boot"}],
        "platforms_cloud": [],
        "tooling_devops": [{"canonical": "docker"}],
    }

    result = _score_candidate(
        job_payload,
        candidate,
        graph_breakdown={
            "graph_available": True,
            "required_skill_count": 2,
            "credited_score": 1.5,
            "overlap_score": 0.75,
            "exact_matches": ["docker"],
            "prerequisite_matches": [
                {"required_skill": "spring_boot", "support_skill": "java", "credit": 0.5}
            ],
            "missing_skills": [],
        },
    )

    assert result["final_report_json"]["graph_scoring"]["overlap_score"] == 0.75
    assert result["final_report_json"]["graph_scoring"]["used_fallback"] is False
    assert result["final_report_json"]["graph_scoring"]["prerequisite_matches"] == [
        {"required_skill": "spring_boot", "support_skill": "java", "credit": 0.5}
    ]
    assert result["match_score"] == 65.0


def test_score_candidate_does_not_double_count_exact_and_prerequisite_support(session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="No Double Count Candidate",
        resume_text="GitHub: https://github.com/example/no-double-count",
        technical=["Spring_Boot", "Java"],
    )
    candidate.verified_links_json = [{"final_url": "https://github.com/example/no-double-count"}]

    result = _score_candidate(
        {
            "required_skills": [{"canonical": "spring_boot", "requirement_type": "must_have"}],
            "technical_skills": [{"canonical": "spring_boot"}],
            "platforms_cloud": [],
            "tooling_devops": [],
        },
        candidate,
        graph_breakdown={
            "graph_available": True,
            "required_skill_count": 1,
            "credited_score": 1.0,
            "overlap_score": 1.0,
            "exact_matches": ["spring_boot"],
            "prerequisite_matches": [],
            "missing_skills": [],
        },
    )

    assert result["final_report_json"]["graph_scoring"]["exact_matches"] == ["spring_boot"]
    assert result["final_report_json"]["graph_scoring"]["prerequisite_matches"] == []
    assert result["final_report_json"]["graph_scoring"]["used_fallback"] is False


def test_screen_and_rank_job_candidates_uses_graph_breakdown_when_available(
    session,
    monkeypatch,
) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Graph Enabled Candidate",
        resume_text="GitHub: https://github.com/example/graph-enabled",
        technical=["Java"],
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
        lambda url, timeout_seconds=5: {
            "url": url,
            "content": "Java Docker backend project.",
            "title": "Graph Enabled Candidate Project",
            "reachable": True,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_graph_breakdown",
        lambda **kwargs: {
            "graph_available": True,
            "required_skill_count": 4,
            "credited_score": 2.5,
            "overlap_score": 0.625,
            "exact_matches": ["docker", "python"],
            "prerequisite_matches": [
                {"required_skill": "fastapi", "support_skill": "python", "credit": 0.5}
            ],
            "missing_skills": ["aws"],
        },
    )

    result = screen_and_rank_job_candidates(session, job_id=job.id, settings=_make_settings())

    assert result["ranked_candidates"][0].final_report_json["graph_scoring"]["used_fallback"] is False
    assert result["ranked_candidates"][0].final_report_json["graph_scoring"]["overlap_score"] == 0.625


def test_screen_and_rank_job_candidates_falls_back_when_graph_query_fails(
    session,
    monkeypatch,
) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Fallback Candidate",
        resume_text="GitHub: https://github.com/example/fallback",
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
            "content": "Fallback Candidate Python FastAPI backend project.",
            "title": "Fallback Candidate Project",
            "reachable": True,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_graph_breakdown",
        lambda **kwargs: None,
    )

    result = screen_and_rank_job_candidates(session, job_id=job.id, settings=_make_settings())

    assert result["ranked_candidates"][0].final_report_json["graph_scoring"]["used_fallback"] is True


def test_score_candidate_graph_scoring_summary_prefers_exact_and_prerequisite_language(
    session,
) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Summary Candidate",
        resume_text="GitHub: https://github.com/example/summary-candidate",
        technical=["Python", "Docker"],
    )
    candidate.verified_links_json = [{"final_url": "https://github.com/example/summary-candidate"}]

    result = _score_candidate(
        {
            "required_skills": [
                {"canonical": "fastapi", "requirement_type": "must_have"},
                {"canonical": "docker", "requirement_type": "must_have"},
            ],
            "technical_skills": [{"canonical": "fastapi"}],
            "platforms_cloud": [],
            "tooling_devops": [{"canonical": "docker"}],
        },
        candidate,
        graph_breakdown={
            "graph_available": True,
            "required_skill_count": 2,
            "credited_score": 1.5,
            "overlap_score": 0.75,
            "exact_matches": ["docker"],
            "prerequisite_matches": [
                {"required_skill": "fastapi", "support_skill": "python", "credit": 0.5}
            ],
            "missing_skills": [],
        },
    )

    summary = result["final_report_json"]["graph_scoring"]["summary"]
    assert "docker" in summary.lower()
    assert "fastapi" in summary.lower()
    assert "python" in summary.lower()


def test_score_candidate_graph_scoring_summary_reports_fallback(session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Fallback Summary Candidate",
        resume_text="GitHub: https://github.com/example/fallback-summary",
        technical=["Python"],
    )
    candidate.verified_links_json = [{"final_url": "https://github.com/example/fallback-summary"}]

    result = _score_candidate(
        job.structured_jd_json or {},
        candidate,
        graph_breakdown=None,
    )

    assert result["final_report_json"]["graph_scoring"]["summary"] == (
        "Graph scoring unavailable. Showing direct skill overlap fallback."
    )


def test_score_candidate_builds_skill_gap_analysis_from_graph_scoring(session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Gap Candidate",
        resume_text="GitHub: https://github.com/example/gap-candidate",
        technical=["Python", "Docker"],
    )
    candidate.verified_links_json = [{"final_url": "https://github.com/example/gap-candidate"}]

    result = _score_candidate(
        {
            "required_skills": [
                {"canonical": "fastapi", "requirement_type": "must_have"},
                {"canonical": "docker", "requirement_type": "must_have"},
                {"canonical": "aws", "requirement_type": "nice_to_have"},
            ],
            "technical_skills": [{"canonical": "fastapi"}],
            "platforms_cloud": [{"canonical": "aws"}],
            "tooling_devops": [{"canonical": "docker"}],
        },
        candidate,
        graph_breakdown={
            "graph_available": True,
            "required_skill_count": 3,
            "credited_score": 1.5,
            "overlap_score": 0.5,
            "exact_matches": ["docker"],
            "prerequisite_matches": [
                {"required_skill": "fastapi", "support_skill": "python", "credit": 0.5}
            ],
            "missing_skills": ["aws"],
        },
    )

    skill_gap = result["final_report_json"]["skill_gap_analysis"]
    assert skill_gap["ready_skills"] == ["docker"]
    assert skill_gap["near_gap_skills"] == [
        {"required_skill": "fastapi", "support_skill": "python"}
    ]
    assert skill_gap["hard_gap_skills"] == ["aws"]
    assert skill_gap["suggested_next_skills"] == ["fastapi", "aws"]
    assert "docker" in skill_gap["summary"].lower()
    assert "fastapi" in skill_gap["summary"].lower()
    assert "aws" in skill_gap["summary"].lower()


def test_score_candidate_skill_gap_analysis_handles_fallback_without_near_gaps(
    session,
) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Fallback Gap Candidate",
        resume_text="GitHub: https://github.com/example/fallback-gap",
        technical=["Python"],
    )
    candidate.verified_links_json = [{"final_url": "https://github.com/example/fallback-gap"}]

    result = _score_candidate(job.structured_jd_json or {}, candidate, graph_breakdown=None)

    skill_gap = result["final_report_json"]["skill_gap_analysis"]
    assert skill_gap["near_gap_skills"] == []
    assert skill_gap["ready_skills"] == []
    assert skill_gap["hard_gap_skills"]
    assert skill_gap["suggested_next_skills"] == skill_gap["hard_gap_skills"][:3]


def test_screen_and_rank_job_candidates_attaches_related_candidates(
    session,
    monkeypatch,
) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Primary Candidate",
        resume_text="GitHub: https://github.com/example/primary-candidate",
        technical=["Python", "FastAPI"],
    )
    second_candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Second Candidate",
        resume_text="GitHub: https://github.com/example/second-candidate",
        technical=["Python"],
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
            "content": "Python FastAPI backend project.",
            "title": "Primary Candidate Project",
            "reachable": True,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_graph_breakdown",
        lambda **kwargs: {
            "graph_available": True,
            "required_skill_count": 2,
            "credited_score": 2.0,
            "overlap_score": 1.0,
            "exact_matches": ["python", "fastapi"],
            "prerequisite_matches": [],
            "missing_skills": [],
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_related_candidates",
        lambda **kwargs: {
            "similar_candidates": [
                {
                    "candidate_id": second_candidate.id,
                    "full_name": "Second Candidate",
                    "shared_skills": ["python"],
                    "similarity_score": 0.5,
                    "reason": "Shares backend strengths.",
                }
            ],
            "next_best_candidates": [
                {
                    "candidate_id": second_candidate.id,
                    "full_name": "Second Candidate",
                    "shared_skills": ["java"],
                    "proximity_score": 0.4,
                    "reason": "Also aligns with this job.",
                }
            ],
        },
    )

    result = screen_and_rank_job_candidates(session, job_id=job.id, settings=_make_settings())

    related = result["ranked_candidates"][0].final_report_json["related_candidates"]
    assert related["similar_candidates"][0]["full_name"] == "Second Candidate"
    assert related["next_best_candidates"][0]["full_name"] == "Second Candidate"


def test_screen_and_rank_job_candidates_filters_related_candidates_to_ranked_set(
    session,
    monkeypatch,
) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Primary Candidate",
        resume_text="GitHub: https://github.com/example/primary-candidate",
        technical=["Python", "FastAPI"],
    )
    rejected_candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Rejected Candidate",
        resume_text="No links here",
        technical=["Python"],
    )
    second_ranked_candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Second Ranked Candidate",
        resume_text="GitHub: https://github.com/example/second-ranked",
        technical=["Python"],
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
            "content": "Python FastAPI backend project.",
            "title": "Project",
            "reachable": True,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_graph_breakdown",
        lambda **kwargs: {
            "graph_available": True,
            "required_skill_count": 2,
            "credited_score": 1.5,
            "overlap_score": 0.75,
            "exact_matches": ["python"],
            "prerequisite_matches": [],
            "missing_skills": ["fastapi"],
        },
    )

    def _mock_related_candidates(*, candidate_id: int, **kwargs):
        return {
            "similar_candidates": [
                {
                    "candidate_id": candidate_id,
                    "full_name": "Self Candidate",
                    "shared_skills": ["python"],
                    "similarity_score": 0.9,
                    "reason": "self",
                },
                {
                    "candidate_id": rejected_candidate.id,
                    "full_name": "Rejected Candidate",
                    "shared_skills": ["python"],
                    "similarity_score": 0.5,
                    "reason": "should be filtered",
                },
                {
                    "candidate_id": second_ranked_candidate.id,
                    "full_name": "Second Ranked Candidate",
                    "shared_skills": ["python"],
                    "similarity_score": 0.4,
                    "reason": "should remain",
                },
            ],
            "next_best_candidates": [
                {
                    "candidate_id": rejected_candidate.id,
                    "full_name": "Rejected Candidate",
                    "shared_skills": ["python"],
                    "proximity_score": 0.5,
                    "reason": "should be filtered",
                },
                {
                    "candidate_id": second_ranked_candidate.id,
                    "full_name": "Second Ranked Candidate",
                    "shared_skills": ["python"],
                    "proximity_score": 0.4,
                    "reason": "should remain",
                },
            ],
        }

    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_related_candidates",
        _mock_related_candidates,
    )

    result = screen_and_rank_job_candidates(session, job_id=job.id, settings=_make_settings())

    primary = next(candidate for candidate in result["ranked_candidates"] if candidate.full_name == "Primary Candidate")
    related = primary.final_report_json["related_candidates"]
    assert [item["full_name"] for item in related["similar_candidates"]] == ["Second Ranked Candidate"]
    assert [item["full_name"] for item in related["next_best_candidates"]] == ["Second Ranked Candidate"]


def test_screen_and_rank_job_candidates_attaches_related_jobs(
    session,
    monkeypatch,
) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Primary Candidate",
        resume_text="GitHub: https://github.com/example/primary-candidate",
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
            "content": "Python FastAPI backend project.",
            "title": "Primary Candidate Project",
            "reachable": True,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_graph_breakdown",
        lambda **kwargs: {
            "graph_available": True,
            "required_skill_count": 2,
            "credited_score": 2.0,
            "overlap_score": 1.0,
            "exact_matches": ["python", "fastapi"],
            "prerequisite_matches": [],
            "missing_skills": [],
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_related_candidates",
        lambda **kwargs: {
            "similar_candidates": [],
            "next_best_candidates": [],
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service._load_related_jobs",
        lambda **kwargs: [
            {
                "job_id": 18,
                "title": "Backend Engineer",
                "shared_skills": ["python", "fastapi"],
                "similarity_score": 0.75,
                "reason": "Shares core backend requirements.",
            }
        ],
    )

    result = screen_and_rank_job_candidates(session, job_id=job.id, settings=_make_settings())

    related_jobs = result["ranked_candidates"][0].final_report_json["related_jobs"]
    assert related_jobs[0]["title"] == "Backend Engineer"
