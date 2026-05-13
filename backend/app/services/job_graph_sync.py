from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from neo4j import Driver

from app.db.neo4j import get_neo4j_driver
from app.models.job import Job


GRAPH_SAFE_GROUPS = ("technical_skills", "platforms_cloud", "tooling_devops")


def sync_job_to_graph(
    job: Job,
    *,
    driver: Driver | None = None,
    settings: Any | None = None,
) -> dict[str, Any]:
    del settings
    owned_driver = driver is None
    resolved_driver = driver or get_neo4j_driver()

    try:
        payload = _build_graph_payload(job)
        with resolved_driver.session() as session:
            session.execute_write(_sync_job_node_tx, payload["job"])
            for skill in payload["skills"]:
                session.execute_write(_sync_skill_node_tx, skill)
                session.execute_write(_sync_requires_edge_tx, payload["job"]["job_id"], skill)
            for relation in payload["prerequisite_edges"]:
                session.execute_write(_sync_prerequisite_edge_tx, relation)
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


def _build_graph_payload(job: Job) -> dict[str, Any]:
    structured = job.structured_jd_json or {}
    grouped_skills: list[dict[str, Any]] = []
    seen: set[str] = set()
    for group in GRAPH_SAFE_GROUPS:
        for skill in structured.get(group, []) or []:
            canonical = skill.get("canonical")
            if not canonical or canonical in seen:
                continue
            seen.add(canonical)
            grouped_skills.append({**skill, "category": group})

    prerequisite_edges: list[dict[str, str]] = []
    prerequisite_seen: set[tuple[str, str]] = set()
    for skill in grouped_skills:
        for prerequisite in skill.get("prerequisites", []) or []:
            edge = (prerequisite, skill["canonical"])
            if edge in prerequisite_seen:
                continue
            prerequisite_seen.add(edge)
            prerequisite_edges.append(
                {"from_canonical": prerequisite, "to_canonical": skill["canonical"]}
            )

    return {
        "job": {
            "job_id": job.id,
            "title": job.title,
            "source_type": job.source_type,
            "parse_source": job.parse_source,
            "parse_confidence": job.parse_confidence,
            "status": job.status,
        },
        "skills": grouped_skills,
        "prerequisite_edges": prerequisite_edges,
    }


def _sync_job_node_tx(tx, job_data: dict[str, Any]) -> None:
    tx.run(
        """
        MERGE (j:Job {job_id: $job_id})
        SET j.title = $title,
            j.source_type = $source_type,
            j.parse_source = $parse_source,
            j.parse_confidence = $parse_confidence,
            j.status = $status
        """,
        **job_data,
    )


def _sync_skill_node_tx(tx, skill_data: dict[str, Any]) -> None:
    tx.run(
        """
        MERGE (s:Skill {canonical: $canonical})
        SET s.display_name = $name,
            s.category = $category
        """,
        canonical=skill_data["canonical"],
        name=skill_data["name"],
        category=skill_data["category"],
    )


def _sync_requires_edge_tx(tx, job_id: int, skill_data: dict[str, Any]) -> None:
    tx.run(
        """
        MATCH (j:Job {job_id: $job_id})
        MATCH (s:Skill {canonical: $canonical})
        MERGE (j)-[r:REQUIRES]->(s)
        SET r.importance = $importance,
            r.requirement_type = $requirement_type,
            r.confidence = $confidence,
            r.section_origin = $section_origin,
            r.category = $category
        """,
        job_id=job_id,
        canonical=skill_data["canonical"],
        importance=skill_data["importance"],
        requirement_type=skill_data["requirement_type"],
        confidence=skill_data["confidence"],
        section_origin=skill_data["section_origin"],
        category=skill_data["category"],
    )


def _sync_prerequisite_edge_tx(tx, relation: dict[str, str]) -> None:
    tx.run(
        """
        MERGE (from_skill:Skill {canonical: $from_canonical})
        ON CREATE SET from_skill.display_name = $from_canonical,
                      from_skill.category = 'taxonomy'
        MERGE (to_skill:Skill {canonical: $to_canonical})
        ON CREATE SET to_skill.display_name = $to_canonical,
                      to_skill.category = 'taxonomy'
        MERGE (from_skill)-[:PREREQUISITE_OF]->(to_skill)
        """,
        **relation,
    )
