from __future__ import annotations

from neo4j import Driver


RELATED_JOBS_QUERY = """
MATCH (current:Job {job_id: $job_id})-[r1:REQUIRES]->(shared:Skill)<-[r2:REQUIRES]-(other:Job)
WHERE other.job_id <> $job_id
  AND r1.category IN ['technical_skills', 'platforms_cloud', 'tooling_devops']
  AND r2.category IN ['technical_skills', 'platforms_cloud', 'tooling_devops']
WITH current, other, collect(DISTINCT shared.canonical) AS shared_skills
MATCH (current)-[r_current:REQUIRES]->(current_skill:Skill)
WHERE r_current.category IN ['technical_skills', 'platforms_cloud', 'tooling_devops']
WITH other, shared_skills, collect(DISTINCT current_skill.canonical) AS current_skills
MATCH (other)-[r_other:REQUIRES]->(other_skill:Skill)
WHERE r_other.category IN ['technical_skills', 'platforms_cloud', 'tooling_devops']
WITH other, shared_skills, current_skills, collect(DISTINCT other_skill.canonical) AS other_skills
WITH
  other,
  shared_skills,
  toFloat(size(shared_skills)) / CASE
    WHEN size(current_skills + [skill IN other_skills WHERE NOT skill IN current_skills]) = 0 THEN 1
    ELSE size(current_skills + [skill IN other_skills WHERE NOT skill IN current_skills])
  END AS similarity_score
RETURN
  other.job_id AS job_id,
  other.title AS title,
  shared_skills,
  round(similarity_score, 4) AS similarity_score
ORDER BY similarity_score DESC, title ASC
LIMIT 3
"""


def build_related_jobs(*, driver: Driver, job_id: int) -> list[dict]:
    with driver.session() as session:
        rows = session.run(
            RELATED_JOBS_QUERY,
            job_id=job_id,
        ).data()

    return [
        {
            "job_id": row["job_id"],
            "title": row["title"],
            "shared_skills": row["shared_skills"],
            "similarity_score": float(row["similarity_score"]),
            "reason": "Shares core backend and deployment requirements with the current job.",
        }
        for row in rows
    ]
