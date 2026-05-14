from app.repositories.job_repository import create_job
from app.schemas.job import JobCreate


def test_get_job_graph_returns_neo4j_projection(client, session, monkeypatch) -> None:
    job = create_job(
        session,
        JobCreate(
            title="Platform Engineer",
            description="Graph workspace",
            required_skills_text="Python, FastAPI",
            status="draft",
        ),
    )

    monkeypatch.setattr(
        "app.api.job_routes.get_job_knowledge_graph",
        lambda job: {
            "job_id": job.id,
            "title": job.title,
            "status": job.status,
            "graph_sync_status": job.graph_sync_status,
            "available": True,
            "message": None,
            "node_count": 0,
            "edge_count": 0,
            "nodes": [],
            "edges": [],
        },
    )

    response = client.get(f"/api/jobs/{job.id}/graph")

    assert response.status_code == 200
    payload = response.json()
    assert payload["job_id"] == job.id
    assert payload["available"] is True
