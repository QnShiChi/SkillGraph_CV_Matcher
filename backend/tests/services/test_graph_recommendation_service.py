from __future__ import annotations

from app.services.graph_recommendation_service import (
    build_next_best_candidates,
    build_similar_candidates,
)


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
        return FakeResult(self.rows.pop(0))

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class FakeDriver:
    def __init__(self, rows):
        self.rows = rows

    def session(self):
        return FakeSession(self.rows)


def test_build_similar_candidates_shapes_rows() -> None:
    driver = FakeDriver(
        [[
            {
                "candidate_id": 33,
                "full_name": "LONG NGUYEN",
                "shared_skills": ["python", "docker"],
                "similarity_score": 0.67,
            }
        ]]
    )

    result = build_similar_candidates(driver=driver, job_id=21, candidate_id=32)

    assert result == [
        {
            "candidate_id": 33,
            "full_name": "LONG NGUYEN",
            "shared_skills": ["python", "docker"],
            "similarity_score": 0.67,
            "reason": "Shares backend and deployment strengths.",
        }
    ]


def test_build_next_best_candidates_shapes_rows() -> None:
    driver = FakeDriver(
        [
            [
                {
                    "candidate_id": 35,
                    "full_name": "HONG NGUYEN",
                }
            ],
            [
                {
                    "required_skill": "java",
                    "match_type": "exact",
                    "support_skill": None,
                    "credit": 1.0,
                },
                {
                    "required_skill": "spring_boot",
                    "match_type": "prerequisite",
                    "support_skill": "java",
                    "credit": 0.5,
                },
                {
                    "required_skill": "docker",
                    "match_type": "missing",
                    "support_skill": None,
                    "credit": 0.0,
                },
            ],
        ]
    )

    result = build_next_best_candidates(driver=driver, job_id=21, candidate_id=32)

    assert result == [
        {
            "candidate_id": 35,
            "full_name": "HONG NGUYEN",
            "shared_skills": ["java", "spring_boot"],
            "proximity_score": 0.5,
            "reason": "Also aligns with the backend requirements for this job.",
        }
    ]
