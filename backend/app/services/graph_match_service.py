from __future__ import annotations

from neo4j import Driver


GRAPH_MATCH_QUERY = """
MATCH (j:Job {job_id: $job_id})-[r:REQUIRES]->(req:Skill)
WHERE r.category IN ['technical_skills', 'platforms_cloud', 'tooling_devops']
OPTIONAL MATCH (c:Candidate {candidate_id: $candidate_id})-[:HAS_SKILL]->(req)
OPTIONAL MATCH (c2:Candidate {candidate_id: $candidate_id})-[:HAS_SKILL]->(support:Skill)-[:PREREQUISITE_OF]->(req)
WITH req,
     CASE WHEN c IS NOT NULL THEN true ELSE false END AS has_exact,
     collect(DISTINCT support.canonical) AS prerequisite_support
RETURN
  req.canonical AS required_skill,
  CASE
    WHEN has_exact THEN 'exact'
    WHEN size(prerequisite_support) > 0 THEN 'prerequisite'
    ELSE 'missing'
  END AS match_type,
  CASE
    WHEN has_exact OR size(prerequisite_support) = 0 THEN NULL
    ELSE prerequisite_support[0]
  END AS support_skill,
  CASE
    WHEN has_exact THEN 1.0
    WHEN size(prerequisite_support) > 0 THEN 0.5
    ELSE 0.0
  END AS credit
ORDER BY required_skill
"""


def build_graph_skill_breakdown(*, driver: Driver, job_id: int, candidate_id: int) -> dict:
    with driver.session() as session:
        rows = session.run(
            GRAPH_MATCH_QUERY,
            job_id=job_id,
            candidate_id=candidate_id,
        ).data()

    exact_matches: list[str] = []
    prerequisite_matches: list[dict] = []
    missing_skills: list[str] = []

    for row in rows:
        match_type = row["match_type"]
        if match_type == "exact":
            exact_matches.append(row["required_skill"])
        elif match_type == "prerequisite":
            prerequisite_matches.append(
                {
                    "required_skill": row["required_skill"],
                    "support_skill": row["support_skill"],
                    "credit": float(row["credit"]),
                }
            )
        else:
            missing_skills.append(row["required_skill"])

    credited_score = round(sum(float(row["credit"]) for row in rows), 4)
    required_skill_count = len(rows)
    overlap_score = round(credited_score / required_skill_count, 4) if required_skill_count else 0.0

    return {
        "graph_available": True,
        "required_skill_count": required_skill_count,
        "credited_score": credited_score,
        "overlap_score": overlap_score,
        "exact_matches": sorted(exact_matches),
        "prerequisite_matches": prerequisite_matches,
        "missing_skills": sorted(missing_skills),
    }
