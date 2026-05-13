# Neo4j Query Guide

Use this guide to inspect the graph created from imported job descriptions.

## Access

- Neo4j Browser: `http://localhost:7474`
- Username: `neo4j`
- Password: `skillgraph_neo4j_password`

If the stack is not running:

```bash
make up
make migrate
```

## 1. Graph Summary

Count nodes by label:

```cypher
MATCH (n)
RETURN labels(n) AS labels, count(*) AS total
ORDER BY total DESC;
```

Count relationships by type:

```cypher
MATCH ()-[r]->()
RETURN type(r) AS relation, count(*) AS total
ORDER BY total DESC;
```

## 2. Full Graph Overview

Show connected nodes and edges:

```cypher
MATCH (a)-[r]->(b)
RETURN a, r, b
LIMIT 200;
```

Use this to confirm the graph is populated with:

- `Job`
- `Skill`
- `REQUIRES`
- `PREREQUISITE_OF`

## 3. List Imported Jobs

```cypher
MATCH (j:Job)
RETURN j.job_id, j.title, j.parse_source, j.parse_confidence
ORDER BY j.job_id DESC;
```

Use this to identify the `job_id` you want to inspect.

## 4. Inspect One Job and Its Skills

Replace `16` with the job you want to inspect:

```cypher
MATCH (j:Job {job_id: 16})-[r:REQUIRES]->(s:Skill)
RETURN s.canonical, s.display_name, s.category, r.requirement_type, r.importance, r.confidence
ORDER BY s.canonical;
```

This helps verify:

- only graph-safe skills are present
- categories look correct
- importance and requirement type are reasonable

## 5. Visualize One Job Subgraph

```cypher
MATCH (j:Job {job_id: 16})-[r:REQUIRES]->(s:Skill)
OPTIONAL MATCH (p:Skill)-[:PREREQUISITE_OF]->(s)
RETURN j, r, s, p;
```

Use this when you want a visual graph in Neo4j Browser for one imported JD.

## 6. Inspect Skill Prerequisite Topology

```cypher
MATCH (s1:Skill)-[r:PREREQUISITE_OF]->(s2:Skill)
RETURN s1, r, s2
LIMIT 200;
```

This shows the ontology-style prerequisite network.

## 7. Inspect AI/ML Prerequisites

Useful for AI-focused JDs:

```cypher
MATCH (s1:Skill)-[:PREREQUISITE_OF]->(s2:Skill)
WHERE s2.canonical IN [
  'machine_learning',
  'deep_learning',
  'transformer',
  'bert',
  'optical_character_recognition',
  'mlops',
  'mlflow'
]
RETURN s1.canonical, s2.canonical
ORDER BY s2.canonical, s1.canonical;
```

Expected examples:

- `python -> machine_learning`
- `machine_learning -> deep_learning`
- `deep_learning -> transformer`
- `transformer -> bert`
- `computer_vision -> optical_character_recognition`
- `machine_learning -> mlops`
- `mlops -> mlflow`

## 8. Verify a Specific AI Job

Replace `16` with your AI job ID:

```cypher
MATCH (j:Job {job_id: 16})-[r:REQUIRES]->(s:Skill)
OPTIONAL MATCH (p:Skill)-[:PREREQUISITE_OF]->(s)
RETURN j, r, s, p;
```

Use this to confirm:

- AI skills are present as `Skill` nodes
- prerequisite edges were projected correctly
- noisy role/context items are not polluting the core graph

## 9. Quick Terminal Checks

List jobs:

```bash
docker compose exec -T neo4j cypher-shell -u neo4j -p skillgraph_neo4j_password \
"MATCH (j:Job) RETURN j.job_id, j.title ORDER BY j.job_id DESC;"
```

Inspect one job:

```bash
docker compose exec -T neo4j cypher-shell -u neo4j -p skillgraph_neo4j_password \
"MATCH (j:Job {job_id: 16})-[r:REQUIRES]->(s:Skill) RETURN s.canonical, s.category, r.requirement_type ORDER BY s.canonical;"
```

Inspect prerequisites:

```bash
docker compose exec -T neo4j cypher-shell -u neo4j -p skillgraph_neo4j_password \
"MATCH (s1:Skill)-[:PREREQUISITE_OF]->(s2:Skill) RETURN s1.canonical, s2.canonical ORDER BY s1.canonical, s2.canonical;"
```

## 10. Practical Review Checklist

For each imported JD, check:

1. The `Job` node exists.
2. The expected `Skill` nodes exist.
3. `REQUIRES` only includes graph-safe categories.
4. `PREREQUISITE_OF` edges make technical sense.
5. No obvious context noise appears as core skills.
6. AI/ML jobs show non-empty prerequisite structure where the taxonomy covers them.
