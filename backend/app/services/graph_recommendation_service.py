from __future__ import annotations

from neo4j import Driver

from app.services.graph_match_service import build_graph_skill_breakdown


SIMILAR_CANDIDATES_QUERY = """
MATCH (self:Candidate {candidate_id: $candidate_id})-[:HAS_SKILL]->(shared:Skill)<-[:HAS_SKILL]-(other:Candidate)
MATCH (j:Job {job_id: $job_id})-[:HAS_CANDIDATE]->(other)
WHERE other.candidate_id <> $candidate_id
WITH other, collect(DISTINCT shared.canonical) AS shared_skills
MATCH (self_all:Candidate {candidate_id: $candidate_id})-[:HAS_SKILL]->(self_skill:Skill)
WITH other, shared_skills, collect(DISTINCT self_skill.canonical) AS self_skills
MATCH (other)-[:HAS_SKILL]->(other_skill:Skill)
WITH other, shared_skills, self_skills, collect(DISTINCT other_skill.canonical) AS other_skills
WITH
  other,
  shared_skills,
  toFloat(size(shared_skills)) / CASE
    WHEN size(self_skills + [skill IN other_skills WHERE NOT skill IN self_skills]) = 0 THEN 1
    ELSE size(self_skills + [skill IN other_skills WHERE NOT skill IN self_skills])
  END AS similarity_score
RETURN
  other.candidate_id AS candidate_id,
  other.full_name AS full_name,
  shared_skills,
  round(similarity_score, 4) AS similarity_score
ORDER BY similarity_score DESC, full_name ASC
LIMIT 3
"""


NEXT_BEST_CANDIDATE_IDS_QUERY = """
MATCH (j:Job {job_id: $job_id})-[:HAS_CANDIDATE]->(other:Candidate)
WHERE other.candidate_id <> $candidate_id
RETURN
  other.candidate_id AS candidate_id,
  other.full_name AS full_name
ORDER BY full_name ASC
"""


def build_similar_candidates(*, driver: Driver, job_id: int, candidate_id: int) -> list[dict]:
    with driver.session() as session:
        rows = session.run(
            SIMILAR_CANDIDATES_QUERY,
            job_id=job_id,
            candidate_id=candidate_id,
        ).data()

    return [
        {
            "candidate_id": row["candidate_id"],
            "full_name": row["full_name"],
            "shared_skills": row["shared_skills"],
            "similarity_score": float(row["similarity_score"]),
            "reason": "Shares backend and deployment strengths.",
        }
        for row in rows
    ]


def build_next_best_candidates(*, driver: Driver, job_id: int, candidate_id: int) -> list[dict]:
    with driver.session() as session:
        candidate_rows = session.run(
            NEXT_BEST_CANDIDATE_IDS_QUERY,
            job_id=job_id,
            candidate_id=candidate_id,
        ).data()

    recommendations: list[dict] = []
    for row in candidate_rows:
        breakdown = build_graph_skill_breakdown(
            driver=driver,
            job_id=job_id,
            candidate_id=row["candidate_id"],
        )
        shared_skills = sorted(
            [
                *breakdown.get("exact_matches", []),
                *[
                    item["required_skill"]
                    for item in breakdown.get("prerequisite_matches", [])
                    if isinstance(item, dict) and item.get("required_skill")
                ],
            ]
        )
        recommendations.append(
            {
                "candidate_id": row["candidate_id"],
                "full_name": row["full_name"],
                "shared_skills": shared_skills,
                "proximity_score": float(breakdown.get("overlap_score", 0.0)),
                "reason": "Also aligns with the backend requirements for this job.",
            }
        )

    recommendations.sort(
        key=lambda item: (
            -item["proximity_score"],
            item["full_name"].lower(),
        )
    )
    return recommendations[:3]
