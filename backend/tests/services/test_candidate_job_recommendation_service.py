from __future__ import annotations

from app.models.candidate import Candidate
from app.repositories.job_repository import create_job
from app.schemas.job import JobCreate
from app.services.candidate_job_recommendation_service import (
    get_candidate_job_recommendations,
)


def _create_job(session, *, title: str, skills: list[str]):
    job = create_job(
        session,
        JobCreate(
            title=title,
            description=f"{title} role",
            required_skills_text=", ".join(skills),
            status="draft",
        ),
    )
    job.structured_jd_json = {
        "technical_skills": [
            {"name": skill, "canonical": skill.lower(), "requirement_type": "must_have"}
            for skill in skills
        ],
        "platforms_cloud": [],
        "tooling_devops": [],
        "required_skills": [
            {"name": skill, "canonical": skill.lower(), "requirement_type": "must_have"}
            for skill in skills
        ],
    }
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def _create_candidate(session, *, job_id: int, skills: list[str]) -> Candidate:
    candidate = Candidate(
        job_id=job_id,
        full_name="Cross Fit Candidate",
        email=None,
        resume_text="GitHub: https://github.com/example/cross-fit-candidate",
        skills_text="\n".join(skills),
        source_type="cv_pdf",
        source_file_name="cross-fit-candidate.pdf",
        extract_source="text_layer",
        parse_status="processed",
        parse_source="rule_based",
        parse_confidence=0.93,
        graph_sync_status="synced",
        graph_sync_error=None,
        graph_synced_at=None,
        verification_status="verified",
        verification_score=90.0,
        verification_summary="Verified project evidence.",
        verified_links_json=[
            {
                "url": "https://github.com/example/cross-fit-candidate",
                "final_url": "https://github.com/example/cross-fit-candidate",
                "reachable": True,
                "status_code": 200,
                "claim_match_status": "matched",
            }
        ],
        screening_decision="reject",
        screening_reason="Current job is not a strong fit.",
        structured_cv_json={
            "technical_skills": [
                {
                    "name": skill,
                    "canonical": skill.lower(),
                    "evidence": [{"text": f"{skill} project", "section_origin": "experience"}],
                }
                for skill in skills
            ],
            "platforms_cloud": [],
            "tooling_devops": [],
            "experience": [{"text": "Built production systems"}],
        },
        status="new",
    )
    session.add(candidate)
    session.commit()
    session.refresh(candidate)
    return candidate


def test_get_candidate_job_recommendations_returns_alternative_jobs_sorted_by_fit(session) -> None:
    current_job = _create_job(session, title="Java Engineer", skills=["Java", "Spring"])
    best_job = _create_job(session, title="Backend Python Engineer", skills=["Python", "FastAPI"])
    second_job = _create_job(session, title="Platform Engineer", skills=["Python", "Kubernetes"])
    _create_job(session, title="Frontend Engineer", skills=["React", "TypeScript"])
    candidate = _create_candidate(session, job_id=current_job.id, skills=["Python", "FastAPI", "Docker"])

    payload = get_candidate_job_recommendations(session, candidate=candidate)

    assert payload["candidate_id"] == candidate.id
    assert payload["current_job_id"] == current_job.id
    assert [item["job"]["id"] for item in payload["recommendations"]] == [best_job.id, second_job.id]
    assert payload["recommendations"][0]["job"]["title"] == "Backend Python Engineer"
    assert payload["recommendations"][0]["match_score"] > payload["recommendations"][1]["match_score"]
    assert payload["recommendations"][0]["match_summary"] == "Matched 2/2 job skills and 2/2 must-have skills."


def test_get_candidate_job_recommendations_excludes_zero_fit_jobs(session) -> None:
    current_job = _create_job(session, title="Data Analyst", skills=["SQL", "Excel"])
    _create_job(session, title="Frontend Engineer", skills=["React", "TypeScript"])
    candidate = _create_candidate(session, job_id=current_job.id, skills=["Python", "FastAPI"])

    payload = get_candidate_job_recommendations(session, candidate=candidate)

    assert payload["recommendations"] == []
