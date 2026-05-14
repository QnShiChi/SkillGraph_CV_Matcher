from __future__ import annotations

from app.services.graph_job_recommendation_service import build_related_jobs


class FakeResult:
    def __init__(self, rows):
        self._rows = rows

    def data(self):
        return self._rows


class FakeSession:
    def __init__(self, rows):
        self.rows = rows
        self.runs = []

    def run(self, query, **params):
        self.runs.append((query, params))
        return FakeResult(self.rows)

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeDriver:
    def __init__(self, rows):
        self.rows = rows

    def session(self):
        return FakeSession(self.rows)


def test_build_related_jobs_shapes_rows() -> None:
    driver = FakeDriver(
        [
            {
                "job_id": 18,
                "title": "Backend Engineer",
                "shared_skills": ["python", "fastapi", "docker"],
                "similarity_score": 0.75,
            }
        ]
    )

    result = build_related_jobs(driver=driver, job_id=21)

    assert result == [
        {
            "job_id": 18,
            "title": "Backend Engineer",
            "shared_skills": ["python", "fastapi", "docker"],
            "similarity_score": 0.75,
            "reason": "Shares core backend and deployment requirements with the current job.",
        }
    ]


def test_build_related_jobs_returns_empty_list_for_empty_result() -> None:
    driver = FakeDriver([])

    result = build_related_jobs(driver=driver, job_id=21)

    assert result == []
