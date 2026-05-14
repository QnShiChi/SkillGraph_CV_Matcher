from __future__ import annotations

from typing import Any

from neo4j import Driver

from app.db.neo4j import get_neo4j_driver
from app.models.job import Job


def get_job_knowledge_graph(
    job: Job,
    *,
    driver: Driver | None = None,
) -> dict[str, Any]:
    owned_driver = driver is None
    resolved_driver = driver or get_neo4j_driver()

    try:
        with resolved_driver.session() as session:
            records = list(session.execute_read(_fetch_job_graph_tx, job.id))

        if not records:
            return {
                "job_id": job.id,
                "title": job.title,
                "status": job.status,
                "graph_sync_status": job.graph_sync_status,
                "available": False,
                "message": "No Neo4j projection found for this job yet.",
                "node_count": 0,
                "edge_count": 0,
                "nodes": [],
                "edges": [],
            }

        record = records[0]
        return _build_job_knowledge_graph_payload(job, record)
    except Exception as exc:
        return {
            "job_id": job.id,
            "title": job.title,
            "status": job.status,
            "graph_sync_status": job.graph_sync_status,
            "available": False,
            "message": str(exc),
            "node_count": 0,
            "edge_count": 0,
            "nodes": [],
            "edges": [],
        }
    finally:
        if owned_driver:
            resolved_driver.close()


def _fetch_job_graph_tx(tx, job_id: int):
    result = tx.run(
        """
        MATCH (j:Job {job_id: $job_id})
        OPTIONAL MATCH (j)-[requires:REQUIRES]->(skill:Skill)
        OPTIONAL MATCH (skill)-[prerequisite:PREREQUISITE_OF]->(dependency:Skill)
        RETURN
          j{.job_id, .title, .status, .source_type, .parse_source, .parse_confidence, .graph_sync_status} AS job,
          collect(DISTINCT CASE WHEN skill IS NULL THEN NULL ELSE {
            canonical: skill.canonical,
            display_name: skill.display_name,
            category: skill.category,
            importance: requires.importance,
            requirement_type: requires.requirement_type,
            confidence: requires.confidence,
            section_origin: requires.section_origin
          } END) AS required_rows,
          collect(DISTINCT CASE WHEN dependency IS NULL THEN NULL ELSE {
            canonical: dependency.canonical,
            display_name: dependency.display_name,
            category: dependency.category
          } END) AS dependency_rows,
          collect(DISTINCT CASE WHEN skill IS NULL OR dependency IS NULL THEN NULL ELSE {
            source: skill.canonical,
            target: dependency.canonical
          } END) AS prerequisite_rows
        """,
        job_id=job_id,
    )

    if hasattr(result, "data"):
        return result.data()

    return list(result)


def _build_job_knowledge_graph_payload(job: Job, record: dict[str, Any]) -> dict[str, Any]:
    required_rows = [row for row in _normalize_rows(record.get("required_rows", [])) if row]
    dependency_rows = [row for row in _normalize_rows(record.get("dependency_rows", [])) if row]
    prerequisite_rows = [row for row in _normalize_rows(record.get("prerequisite_rows", [])) if row]

    nodes: list[dict[str, Any]] = [
        {
            "id": f"job:{job.id}",
            "label": job.title,
            "kind": "job",
            "subtitle": f"{job.status} · {round((job.parse_confidence or 0) * 100)}% confidence",
            "category": None,
            "importance": None,
            "requirement_type": None,
        }
    ]
    node_ids = {f"job:{job.id}"}

    for row in required_rows:
        canonical = row.get("canonical")
        if not canonical or canonical in node_ids:
            continue
        node_ids.add(canonical)
        nodes.append(
            {
                "id": canonical,
                "label": row.get("display_name") or canonical,
                "kind": "skill",
                "subtitle": _format_skill_subtitle(row),
                "category": row.get("category"),
                "importance": row.get("importance"),
                "requirement_type": row.get("requirement_type"),
            }
        )

    for row in dependency_rows:
        canonical = row.get("canonical")
        if not canonical or canonical in node_ids:
            continue
        node_ids.add(canonical)
        nodes.append(
            {
                "id": canonical,
                "label": row.get("display_name") or canonical,
                "kind": "dependency",
                "subtitle": "Neo4j prerequisite",
                "category": row.get("category"),
                "importance": None,
                "requirement_type": None,
            }
        )

    edges: list[dict[str, Any]] = []
    edge_keys: set[tuple[str, str, str]] = set()
    for row in required_rows:
        canonical = row.get("canonical")
        if canonical and canonical in node_ids:
            key = (f"job:{job.id}", canonical, "requires")
            if key not in edge_keys:
                edge_keys.add(key)
                edges.append(
                    {
                        "source": f"job:{job.id}",
                        "target": canonical,
                        "kind": "requires",
                    }
                )

    edge_keys: set[tuple[str, str]] = set()
    for row in prerequisite_rows:
        source = row.get("source")
        target = row.get("target")
        if not source or not target:
            continue
        key = (source, target, "prerequisite")
        if key in edge_keys:
            continue
        edge_keys.add(key)
        if source not in node_ids:
            node_ids.add(source)
            nodes.append(
                {
                    "id": source,
                    "label": source,
                    "kind": "dependency",
                    "subtitle": "Neo4j prerequisite",
                    "category": None,
                    "importance": None,
                    "requirement_type": None,
                }
            )
        if target not in node_ids:
            node_ids.add(target)
            nodes.append(
                {
                    "id": target,
                    "label": target,
                    "kind": "skill",
                    "subtitle": "Neo4j skill",
                    "category": None,
                    "importance": None,
                    "requirement_type": None,
                }
            )
        edges.append({"source": source, "target": target, "kind": "prerequisite"})

    return {
        "job_id": job.id,
        "title": job.title,
        "status": job.status,
        "graph_sync_status": job.graph_sync_status,
        "available": True,
        "message": None,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "nodes": nodes,
        "edges": edges,
    }


def _normalize_rows(rows: Any) -> list[dict[str, Any]]:
    if rows is None:
        return []

    normalized: list[dict[str, Any]] = []
    for row in rows:
        if row is None:
            continue
        if isinstance(row, dict):
            normalized.append(row)
        else:
            normalized.append(dict(row))
    return normalized


def _format_skill_subtitle(row: dict[str, Any]) -> str:
    requirement_type = str(row.get("requirement_type") or "required").replace("_", " ")
    confidence = row.get("confidence")

    if confidence is None:
        return requirement_type

    return f"{requirement_type} · {round(float(confidence) * 100)}%"
