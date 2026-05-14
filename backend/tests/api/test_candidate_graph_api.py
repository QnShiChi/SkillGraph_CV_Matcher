from app.repositories.candidate_repository import create_candidate
from app.schemas.candidate import CandidateCreate


def test_get_candidate_graph_returns_neo4j_projection(client, session, monkeypatch) -> None:
    candidate = create_candidate(
        session,
        CandidateCreate(
            full_name="Jane Candidate",
            email=None,
            resume_text=None,
            skills_text=None,
            status="new",
        ),
    )

    monkeypatch.setattr(
        "app.api.candidate_routes.get_candidate_knowledge_graph",
        lambda candidate: {
            "candidate_id": candidate.id,
            "candidate_name": candidate.full_name,
            "job_id": candidate.job_id,
            "job_title": None,
            "graph_sync_status": candidate.graph_sync_status,
            "available": True,
            "message": None,
            "node_count": 0,
            "edge_count": 0,
            "matched_count": 0,
            "missing_count": 0,
            "nodes": [],
            "edges": [],
        },
    )

    response = client.get(f"/api/candidates/{candidate.id}/graph")

    assert response.status_code == 200
    payload = response.json()
    assert payload["candidate_id"] == candidate.id
    assert payload["available"] is True
