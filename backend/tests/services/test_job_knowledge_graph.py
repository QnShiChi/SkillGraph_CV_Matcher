from types import SimpleNamespace

from app.services.job_knowledge_graph import get_job_knowledge_graph


class _FakeTx:
    def __init__(self, record):
        self.record = record

    def run(self, query, job_id):
        return [self.record]


class _FakeSession:
    def __init__(self, record):
        self.record = record

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute_read(self, func, job_id):
        return func(_FakeTx(self.record), job_id)


class _FakeDriver:
    def __init__(self, record):
        self.record = record
        self.closed = False

    def session(self):
        return _FakeSession(self.record)

    def close(self):
        self.closed = True


def test_get_job_knowledge_graph_reads_neo4j_projection_and_builds_nodes_and_edges() -> None:
    job = SimpleNamespace(
        id=42,
        title="Platform Engineer",
        status="draft",
        graph_sync_status="synced",
        parse_confidence=0.94,
    )
    driver = _FakeDriver(
        {
            "job": {
                "job_id": 42,
                "title": "Platform Engineer",
                "source_type": "jd_pdf",
                "parse_source": "rule_based",
                "parse_confidence": 0.94,
                "status": "draft",
            },
            "required_rows": [
                {
                    "canonical": "fastapi",
                    "display_name": "FastAPI",
                    "category": "tooling_devops",
                    "importance": 5,
                    "requirement_type": "must_have",
                    "confidence": 0.93,
                }
            ],
            "dependency_rows": [
                {
                    "canonical": "python",
                    "display_name": "Python",
                    "category": "technical_skills",
                }
            ],
                "prerequisite_rows": [
                    {"source": "python", "target": "fastapi"},
                ],
            }
        )

    payload = get_job_knowledge_graph(job, driver=driver)

    assert payload["available"] is True
    assert payload["job_id"] == 42
    assert {node["id"] for node in payload["nodes"]} == {"job:42", "fastapi", "python"}
    assert payload["edges"] == [
        {"source": "job:42", "target": "fastapi", "kind": "requires"},
        {"source": "python", "target": "fastapi", "kind": "prerequisite"},
    ]
    assert driver.closed is False
