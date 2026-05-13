from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from neo4j import Driver

from app.db.neo4j import get_neo4j_driver
from app.models.candidate import Candidate


GRAPH_SAFE_GROUPS = ("technical_skills", "platforms_cloud", "tooling_devops")


def sync_candidate_to_graph(
    candidate: Candidate,
    *,
    driver: Driver | None = None,
    settings: Any | None = None,
) -> dict[str, Any]:
    del settings
    owned_driver = driver is None
    resolved_driver = driver or get_neo4j_driver()

    try:
        payload = _build_candidate_graph_payload(candidate)
        with resolved_driver.session() as session:
            session.execute_write(_sync_candidate_node_tx, payload["candidate"])
            for skill in payload["skills"]:
                session.execute_write(_sync_skill_node_tx, skill)
                session.execute_write(_sync_has_skill_edge_tx, payload["candidate"]["candidate_id"], skill)
            if payload["job_candidate_edge"] is not None:
                session.execute_write(_sync_job_candidate_edge_tx, payload["job_candidate_edge"])
        return {
            "status": "synced",
            "error": None,
            "synced_at": datetime.now(timezone.utc),
        }
    except Exception as exc:
        return {
            "status": "failed",
            "error": str(exc),
            "synced_at": None,
        }
    finally:
        if owned_driver:
            resolved_driver.close()


def _build_candidate_graph_payload(candidate: Candidate) -> dict[str, Any]:
    structured = candidate.structured_cv_json or {}
    skills: list[dict[str, Any]] = []
    seen: set[str] = set()
    for group in GRAPH_SAFE_GROUPS:
        for skill in structured.get(group, []) or []:
            canonical = skill.get("canonical")
            if not canonical or canonical in seen:
                continue
            seen.add(canonical)
            skills.append(
                {
                    **skill,
                    "category": group,
                    "evidence_count": len(skill.get("evidence", []) or []),
                }
            )
    return {
        "candidate": {
            "candidate_id": candidate.id,
            "job_id": candidate.job_id,
            "full_name": candidate.full_name,
            "source_type": candidate.source_type,
            "parse_source": candidate.parse_source,
            "parse_confidence": candidate.parse_confidence,
            "status": candidate.status,
        },
        "skills": skills,
        "job_candidate_edge": {
            "job_id": candidate.job_id,
            "candidate_id": candidate.id,
        }
        if candidate.job_id is not None
        else None,
    }


def _sync_candidate_node_tx(tx, candidate_data: dict[str, Any]) -> None:
    tx.run(
        """
        MERGE (c:Candidate {candidate_id: $candidate_id})
        SET c.full_name = $full_name,
            c.source_type = $source_type,
            c.parse_source = $parse_source,
            c.parse_confidence = $parse_confidence,
            c.status = $status
        """,
        **candidate_data,
    )


def _sync_skill_node_tx(tx, skill_data: dict[str, Any]) -> None:
    tx.run(
        """
        MERGE (s:Skill {canonical: $canonical})
        SET s.display_name = $name,
            s.category = CASE
              WHEN s.category IS NULL OR s.category = 'taxonomy' THEN $category
              ELSE s.category
            END
        """,
        canonical=skill_data["canonical"],
        name=skill_data["name"],
        category=skill_data["category"],
    )


def _sync_has_skill_edge_tx(tx, candidate_id: int, skill_data: dict[str, Any]) -> None:
    tx.run(
        """
        MATCH (c:Candidate {candidate_id: $candidate_id})
        MATCH (s:Skill {canonical: $canonical})
        MERGE (c)-[r:HAS_SKILL]->(s)
        SET r.confidence = $confidence,
            r.section_origin = $section_origin,
            r.category = $category,
            r.evidence_count = $evidence_count
        """,
        candidate_id=candidate_id,
        canonical=skill_data["canonical"],
        confidence=skill_data["confidence"],
        section_origin=skill_data["section_origin"],
        category=skill_data["category"],
        evidence_count=skill_data["evidence_count"],
    )


def _sync_job_candidate_edge_tx(tx, edge_data: dict[str, Any]) -> None:
    tx.run(
        """
        MATCH (j:Job {job_id: $job_id})
        MATCH (c:Candidate {candidate_id: $candidate_id})
        MERGE (j)-[:HAS_CANDIDATE]->(c)
        """,
        **edge_data,
    )
