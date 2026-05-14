from app.repositories.candidate_repository import create_candidate, list_candidates_for_job
from app.repositories.job_repository import create_job, get_job_by_id
from app.schemas.candidate import CandidateCreate
from app.schemas.job import JobCreate


def test_delete_job_removes_its_candidates(client, session) -> None:
    job = create_job(
        session,
        JobCreate(
            title="Backend Engineer",
            description="Delete me",
            required_skills_text="Python, FastAPI",
            status="draft",
        ),
    )
    create_candidate(
        session,
        CandidateCreate(
            job_id=job.id,
            full_name="Jane Candidate",
            email=None,
            resume_text=None,
            skills_text=None,
            status="new",
        ),
    )

    response = client.delete(f"/api/jobs/{job.id}")

    assert response.status_code == 204
    assert get_job_by_id(session, job.id) is None
    assert list_candidates_for_job(session, job.id) == []
