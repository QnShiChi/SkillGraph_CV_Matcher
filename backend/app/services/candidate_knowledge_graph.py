from __future__ import annotations

from typing import Any

from neo4j import Driver

from app.db.neo4j import get_neo4j_driver
from app.models.candidate import Candidate


def get_candidate_knowledge_graph(
    candidate: Candidate,
    *,
    driver: Driver | None = None,
) -> dict[str, Any]:
    owned_driver = driver is None
    resolved_driver = driver or get_neo4j_driver()

    try:
        with resolved_driver.session() as session:
            records = list(session.execute_read(_fetch_candidate_graph_tx, candidate.id, candidate.job_id))

        if not records:
            return {
                "candidate_id": candidate.id,
                "candidate_name": candidate.full_name,
                "job_id": candidate.job_id,
                "job_title": None,
                "graph_sync_status": candidate.graph_sync_status,
                "available": False,
                "message": "No Neo4j projection found for this candidate yet.",
                "node_count": 0,
                "edge_count": 0,
                "matched_count": 0,
                "missing_count": 0,
                "nodes": [],
                "edges": [],
            }

        return _build_candidate_knowledge_graph_payload(candidate, records[0])
    except Exception as exc:
        return {
            "candidate_id": candidate.id,
            "candidate_name": candidate.full_name,
            "job_id": candidate.job_id,
            "job_title": None,
            "graph_sync_status": candidate.graph_sync_status,
            "available": False,
            "message": str(exc),
            "node_count": 0,
            "edge_count": 0,
            "matched_count": 0,
            "missing_count": 0,
            "nodes": [],
            "edges": [],
        }
    finally:
        if owned_driver:
            resolved_driver.close()


def _fetch_candidate_graph_tx(tx, candidate_id: int, job_id: int | None):
    result = tx.run(
        """
        MATCH (c:Candidate {candidate_id: $candidate_id})
        OPTIONAL MATCH (c)-[has:HAS_SKILL]->(owned:Skill)
        WITH c,
          collect(DISTINCT CASE WHEN owned IS NULL THEN NULL ELSE {
            canonical: owned.canonical,
            display_name: owned.display_name,
            category: coalesce(has.category, owned.category),
            confidence: has.confidence,
            section_origin: has.section_origin,
            evidence_count: has.evidence_count
          } END) AS possessed_rows
        OPTIONAL MATCH (j:Job {job_id: $job_id})
        OPTIONAL MATCH (j)-[requires:REQUIRES]->(required:Skill)
        WITH c, j, possessed_rows,
          collect(DISTINCT CASE WHEN required IS NULL THEN NULL ELSE {
            canonical: required.canonical,
            display_name: required.display_name,
            category: coalesce(requires.category, required.category),
            importance: requires.importance,
            requirement_type: requires.requirement_type,
            confidence: requires.confidence
          } END) AS required_rows
        WITH c, j, possessed_rows, required_rows,
          [row IN possessed_rows WHERE row IS NOT NULL | row.canonical] +
          [row IN required_rows WHERE row IS NOT NULL | row.canonical] AS selected_ids
        OPTIONAL MATCH (prereq:Skill)-[:PREREQUISITE_OF]->(skill:Skill)
        WHERE prereq.canonical IN selected_ids OR skill.canonical IN selected_ids
        RETURN
          c{.candidate_id, .full_name, .status, .parse_source, .parse_confidence, .graph_sync_status} AS candidate,
          CASE WHEN j IS NULL THEN NULL ELSE j{.job_id, .title, .status} END AS job,
          possessed_rows,
          required_rows,
          collect(DISTINCT CASE WHEN prereq IS NULL THEN NULL ELSE {
            canonical: prereq.canonical,
            display_name: prereq.display_name,
            category: prereq.category
          } END) AS prerequisite_node_rows,
          collect(DISTINCT CASE WHEN skill IS NULL THEN NULL ELSE {
            canonical: skill.canonical,
            display_name: skill.display_name,
            category: skill.category
          } END) AS dependent_node_rows,
          collect(DISTINCT CASE WHEN prereq IS NULL OR skill IS NULL THEN NULL ELSE {
            source: prereq.canonical,
            target: skill.canonical
          } END) AS prerequisite_rows
        """,
        candidate_id=candidate_id,
        job_id=job_id,
    )

    if hasattr(result, "data"):
        return result.data()

    return list(result)


def _build_candidate_knowledge_graph_payload(candidate: Candidate, record: dict[str, Any]) -> dict[str, Any]:
    possessed_rows = [row for row in _normalize_rows(record.get("possessed_rows", [])) if row]
    required_rows = [row for row in _normalize_rows(record.get("required_rows", [])) if row]
    prerequisite_node_rows = [row for row in _normalize_rows(record.get("prerequisite_node_rows", [])) if row]
    dependent_node_rows = [row for row in _normalize_rows(record.get("dependent_node_rows", [])) if row]
    prerequisite_rows = [row for row in _normalize_rows(record.get("prerequisite_rows", [])) if row]

    possessed_by_id = {row["canonical"]: row for row in possessed_rows if row.get("canonical")}
    required_by_id = {row["canonical"]: row for row in required_rows if row.get("canonical")}

    matched_ids = [skill_id for skill_id in required_by_id if skill_id in possessed_by_id]
    missing_ids = [skill_id for skill_id in required_by_id if skill_id not in possessed_by_id]

    nodes: list[dict[str, Any]] = []
    node_ids: set[str] = set()

    def add_node(node_id: str, label: str, status: str, subtitle: str, category: str | None) -> None:
        if not node_id or node_id in node_ids:
            return
        node_ids.add(node_id)
        nodes.append(
            {
                "id": node_id,
                "label": label,
                "status": status,
                "subtitle": subtitle,
                "category": category,
            }
        )

    for skill_id, row in possessed_by_id.items():
        status = "possessed"
        if skill_id not in required_by_id:
            status = "related"
        add_node(
            skill_id,
            row.get("display_name") or skill_id,
            status,
            _format_possessed_subtitle(row, skill_id in required_by_id),
            row.get("category"),
        )

    for skill_id, row in required_by_id.items():
        if skill_id in possessed_by_id:
            continue
        add_node(
            skill_id,
            row.get("display_name") or skill_id,
            "missing",
            _format_required_subtitle(row),
            row.get("category"),
        )

    for row in prerequisite_node_rows + dependent_node_rows:
        skill_id = row.get("canonical")
        if not skill_id or skill_id in required_by_id or skill_id in possessed_by_id:
            continue
        add_node(
            skill_id,
            row.get("display_name") or skill_id,
            "related",
            "neo4j relation",
            row.get("category"),
        )

    edges: list[dict[str, Any]] = []
    edge_keys: set[tuple[str, str, str]] = set()
    for row in prerequisite_rows:
        source = row.get("source")
        target = row.get("target")
        if not source or not target:
            continue
        if source not in node_ids or target not in node_ids:
            continue
        key = (source, target, "prerequisite")
        if key in edge_keys:
            continue
        edge_keys.add(key)
        edges.append({"source": source, "target": target, "kind": "prerequisite"})

    anchor_id = matched_ids[0] if matched_ids else (next(iter(possessed_by_id), None) or next(iter(required_by_id), None))
    if anchor_id:
        for node in nodes:
            node_id = node["id"]
            if node_id == anchor_id:
                continue
            key = tuple(sorted((anchor_id, node_id))) + ("related",)
            if any(
                existing["kind"] == "prerequisite"
                and ((existing["source"] == anchor_id and existing["target"] == node_id) or (existing["source"] == node_id and existing["target"] == anchor_id))
                for existing in edges
            ):
                continue
            if key in edge_keys:
                continue
            edge_keys.add(key)
            edges.append({"source": anchor_id, "target": node_id, "kind": "related"})

    job_row = record.get("job") or {}

    return {
        "candidate_id": candidate.id,
        "candidate_name": candidate.full_name,
        "job_id": candidate.job_id,
        "job_title": job_row.get("title"),
        "graph_sync_status": candidate.graph_sync_status,
        "available": True,
        "message": None,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "matched_count": len(matched_ids),
        "missing_count": len(missing_ids),
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


def _format_possessed_subtitle(row: dict[str, Any], matched: bool) -> str:
    confidence = row.get("confidence")
    prefix = "matched evidence" if matched else "candidate evidence"
    if confidence is None:
        return prefix
    return f"{prefix} · {round(float(confidence) * 100)}%"


def _format_required_subtitle(row: dict[str, Any]) -> str:
    requirement_type = str(row.get("requirement_type") or "required").replace("_", " ")
    confidence = row.get("confidence")
    if confidence is None:
        return f"{requirement_type} gap"
    return f"{requirement_type} · {round(float(confidence) * 100)}% gap"
