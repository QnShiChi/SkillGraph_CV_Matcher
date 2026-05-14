from __future__ import annotations

from app.services.graph_match_service import build_graph_skill_breakdown


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


def test_build_graph_skill_breakdown_returns_exact_prerequisite_and_missing_rows() -> None:
    driver = FakeDriver(
        [
            {
                "required_skill": "spring_boot",
                "match_type": "exact",
                "support_skill": None,
                "credit": 1.0,
            },
            {
                "required_skill": "postgresql",
                "match_type": "prerequisite",
                "support_skill": "sql",
                "credit": 0.5,
            },
            {
                "required_skill": "docker",
                "match_type": "missing",
                "support_skill": None,
                "credit": 0.0,
            },
        ]
    )

    result = build_graph_skill_breakdown(driver=driver, job_id=21, candidate_id=33)

    assert result["graph_available"] is True
    assert result["required_skill_count"] == 3
    assert result["credited_score"] == 1.5
    assert result["overlap_score"] == 0.5
    assert result["exact_matches"] == ["spring_boot"]
    assert result["prerequisite_matches"] == [
        {"required_skill": "postgresql", "support_skill": "sql", "credit": 0.5}
    ]
    assert result["missing_skills"] == ["docker"]


def test_build_graph_skill_breakdown_returns_zeroed_payload_for_empty_result() -> None:
    driver = FakeDriver([])

    result = build_graph_skill_breakdown(driver=driver, job_id=21, candidate_id=33)

    assert result["graph_available"] is True
    assert result["required_skill_count"] == 0
    assert result["credited_score"] == 0.0
    assert result["overlap_score"] == 0.0
    assert result["exact_matches"] == []
    assert result["prerequisite_matches"] == []
    assert result["missing_skills"] == []
