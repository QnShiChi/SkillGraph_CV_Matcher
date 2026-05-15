from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.candidate import Candidate
from app.repositories.job_repository import list_jobs
from app.schemas.job import JobRead
from app.services.candidate_screening_service import _score_candidate


def get_candidate_job_recommendations(
    session: Session,
    *,
    candidate: Candidate,
    limit: int = 3,
) -> dict:
    recommendations: list[dict] = []

    for job in list_jobs(session):
        if job.id == candidate.job_id:
            continue
        if not isinstance(job.structured_jd_json, dict) or not job.structured_jd_json:
            continue

        score_payload = _score_candidate(job.structured_jd_json, candidate)
        report = score_payload.get("final_report_json") or {}
        strengths = report.get("strengths")
        gaps = report.get("gaps")

        recommendations.append(
            {
                "job": JobRead.model_validate(job).model_dump(),
                "match_score": score_payload["match_score"],
                "match_summary": score_payload["match_summary"],
                "strengths": strengths if isinstance(strengths, list) else [],
                "gaps": gaps if isinstance(gaps, list) else [],
            }
        )

    recommendations.sort(
        key=lambda item: (
            -item["match_score"],
            item["job"]["title"].lower(),
        )
    )

    filtered = [item for item in recommendations if item["strengths"]][:limit]
    return {
        "candidate_id": candidate.id,
        "current_job_id": candidate.job_id,
        "recommendations": filtered,
    }
