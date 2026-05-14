from types import SimpleNamespace

from app.services.candidate_knowledge_graph import get_candidate_knowledge_graph


class _FakeTx:
    def __init__(self, record):
        self.record = record

    def run(self, query, candidate_id, job_id):
        return [self.record]


class _FakeSession:
    def __init__(self, record):
        self.record = record

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute_read(self, func, candidate_id, job_id):
        return func(_FakeTx(self.record), candidate_id, job_id)


class _FakeDriver:
    def __init__(self, record):
        self.record = record
        self.closed = False

    def session(self):
        return _FakeSession(self.record)

    def close(self):
        self.closed = True


def test_get_candidate_knowledge_graph_reads_neo4j_projection_and_builds_nodes_and_edges() -> None:
    candidate = SimpleNamespace(
        id=8,
        full_name="Jane Candidate",
        job_id=42,
        graph_sync_status="synced",
    )
    driver = _FakeDriver(
        {
            "candidate": {
                "candidate_id": 8,
                "full_name": "Jane Candidate",
            },
            "job": {
                "job_id": 42,
                "title": "Platform Engineer",
            },
            "possessed_rows": [
                {
                    "canonical": "python",
                    "display_name": "Python",
                    "category": "technical_skills",
                    "confidence": 0.96,
                },
                {
                    "canonical": "fastapi",
                    "display_name": "FastAPI",
                    "category": "technical_skills",
                    "confidence": 0.91,
                },
            ],
            "required_rows": [
                {
                    "canonical": "fastapi",
                    "display_name": "FastAPI",
                    "category": "technical_skills",
                    "requirement_type": "must_have",
                    "confidence": 0.93,
                },
                {
                    "canonical": "postgresql",
                    "display_name": "PostgreSQL",
                    "category": "technical_skills",
                    "requirement_type": "must_have",
                    "confidence": 0.9,
                },
            ],
            "prerequisite_node_rows": [
                {
                    "canonical": "python",
                    "display_name": "Python",
                    "category": "technical_skills",
                }
            ],
            "dependent_node_rows": [
                {
                    "canonical": "fastapi",
                    "display_name": "FastAPI",
                    "category": "technical_skills",
                }
            ],
            "prerequisite_rows": [
                {"source": "python", "target": "fastapi"},
            ],
        }
    )

    payload = get_candidate_knowledge_graph(candidate, driver=driver)

    assert payload["available"] is True
    assert payload["candidate_id"] == 8
    assert payload["job_title"] == "Platform Engineer"
    assert payload["matched_count"] == 1
    assert payload["missing_count"] == 1
    assert {node["id"] for node in payload["nodes"]} == {"python", "fastapi", "postgresql"}
    assert {"source": "python", "target": "fastapi", "kind": "prerequisite"} in payload["edges"]
