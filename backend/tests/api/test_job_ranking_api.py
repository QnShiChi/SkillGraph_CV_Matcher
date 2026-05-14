from __future__ import annotations

from app.models.candidate import Candidate
from app.repositories.job_repository import create_job
from app.schemas.job import JobCreate


def _create_job(session):
    job = create_job(
        session,
        JobCreate(
            title="Backend Engineer",
            description="Build backend services",
            required_skills_text="Python",
            status="draft",
        ),
    )
    job.structured_jd_json = {
        "technical_skills": [
            {"name": "Python", "canonical": "python", "requirement_type": "must_have"},
            {"name": "FastAPI", "canonical": "fastapi", "requirement_type": "must_have"},
        ],
        "platforms_cloud": [],
        "tooling_devops": [],
        "required_skills": [
            {"name": "Python", "canonical": "python", "requirement_type": "must_have"},
            {"name": "FastAPI", "canonical": "fastapi", "requirement_type": "must_have"},
        ],
    }
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def _create_candidate(session, *, job_id: int, full_name: str, resume_text: str) -> Candidate:
    candidate = Candidate(
        job_id=job_id,
        full_name=full_name,
        email=None,
        resume_text=resume_text,
        skills_text="Python\nFastAPI",
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
                {"name": "Python", "canonical": "python", "evidence": [{"text": "Python API", "section_origin": "experience"}]},
                {"name": "FastAPI", "canonical": "fastapi", "evidence": [{"text": "FastAPI backend", "section_origin": "experience"}]},
            ],
            "platforms_cloud": [],
            "tooling_devops": [],
            "experience": [{"text": "Built production APIs"}],
        },
        status="new",
    )
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return candidate


def test_screen_and_rank_job_candidates_endpoint_returns_ranked_and_rejected_lists(
    client,
    session,
    monkeypatch,
) -> None:
    job = _create_job(session)
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Verified Candidate",
        resume_text="GitHub: https://github.com/example/verified-candidate",
    )
    _create_candidate(
        session,
        job_id=job.id,
        full_name="Rejected Candidate",
        resume_text="No links here",
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
            "content": "Verified Candidate Python FastAPI project with production APIs.",
            "title": "Verified Candidate Project",
            "reachable": True,
        },
    )
    monkeypatch.setattr(
        "app.services.candidate_screening_service.run_agentscope_candidate_review",
        lambda **kwargs: {
            "match_summary": "AgentScope approved the verified candidate.",
            "final_report_json": {
                "strengths": ["python", "fastapi"],
                "gaps": [],
                "explanation": "AgentScope explanation.",
                "critic_review": "Critic approved.",
            },
        },
    )

    response = client.post(f"/api/jobs/{job.id}/screen-and-rank")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_candidates"] == 2
    assert payload["ranked_count"] == 1
    assert payload["rejected_count"] == 1
    assert payload["ranked_candidates"][0]["full_name"] == "Verified Candidate"
    assert payload["ranked_candidates"][0]["screening_decision"] == "pass"
    assert payload["rejected_candidates"][0]["full_name"] == "Rejected Candidate"
    assert payload["rejected_candidates"][0]["screening_decision"] == "reject"


def test_get_job_ranking_returns_persisted_results(client, session) -> None:
    job = _create_job(session)
    candidate = _create_candidate(
        session,
        job_id=job.id,
        full_name="Persisted Candidate",
        resume_text="GitHub: https://github.com/example/persisted-candidate",
    )
    candidate.verification_status = "verified"
    candidate.verification_score = 90.0
    candidate.verification_summary = "Verified one GitHub project link."
    candidate.verified_links_json = [
        {
            "url": "https://github.com/example/persisted-candidate",
            "reachable": True,
            "status_code": 200,
            "final_url": "https://github.com/example/persisted-candidate",
            "reason": None,
        }
    ]
    candidate.screening_decision = "pass"
    candidate.match_score = 88.5
    candidate.match_rank = 1
    candidate.match_summary = "Matched 2/2 job skills."
    candidate.final_report_json = {"strengths": ["python", "fastapi"], "gaps": []}
    session.add(candidate)
    session.commit()

    response = client.get(f"/api/jobs/{job.id}/ranking")

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_candidates"] == 1
    assert payload["ranked_count"] == 1
    assert payload["rejected_count"] == 0
    assert payload["ranked_candidates"][0]["full_name"] == "Persisted Candidate"
    assert payload["ranked_candidates"][0]["match_rank"] == 1


def test_screen_and_rank_job_candidates_endpoint_returns_404_for_missing_job(client) -> None:
    response = client.post("/api/jobs/99999/screen-and-rank")

    assert response.status_code == 404
    assert response.json()["detail"] == "Job not found."
