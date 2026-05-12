# JD Parse Quality Improvement Design

## Goal

Improve the quality of future JD imports so the resulting structured data is better aligned with the long-term system objective:
- cleaner graph-ready technical skill extraction
- less mixing between technical skills and generic competencies
- more reliable prerequisite attachment through taxonomy
- better UI readability through grouped skill presentation

This phase applies only to future JD imports. Existing imported jobs will not be re-parsed.

## Problem Statement

The current hybrid LLM parser is able to:
- detect JD sections well
- summarize job context well
- extract a broad set of relevant signals

But it still mixes multiple concept classes into a single skill surface, such as:
- true technical skills
- cloud/platform choices
- tooling/devops items
- general competencies
- role descriptors

This makes the parsed output less suitable for:
- Neo4j graph construction
- GAT feature engineering
- explainable matching

## Scope

### In scope
- tighten the structured JD schema for future imports
- expand taxonomy coverage
- classify parsed items into explicit groups
- rebuild `required_skills_text` from grouped outputs
- improve prerequisite handling rules
- update UI workspace to present grouped skill blocks

### Out of scope
- re-processing existing jobs
- CV parsing
- graph writes to Neo4j
- ranking or scoring

## New Structured JD Shape

Replace the current flat emphasis on `required_skills` with grouped collections.

### Top-level fields
- `title`
- `summary`
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`
- `role_descriptors`
- `soft_skills`
- `responsibilities`
- `qualifications`
- `language_requirements`
- `experience_years`
- `skill_groups`

### Group semantics

#### `technical_skills`
Contains core technical nodes appropriate for graph modeling.
Examples:
- `Python`
- `Node.js`
- `FastAPI`
- `PostgreSQL`

#### `platforms_cloud`
Contains cloud/platform/runtime choices.
Examples:
- `AWS`
- `GCP`
- `Azure`

#### `tooling_devops`
Contains engineering tools, delivery pipelines, version control, containerization, and related tooling.
Examples:
- `Docker`
- `CI/CD`
- `Git`
- `Version control systems`

#### `competencies`
Contains professional capabilities that matter for matching but should not be treated as core technical skill nodes.
Examples:
- `Software development`
- `Full-stack development`
- `Back-end development`
- `Scalable software systems`

#### `role_descriptors`
Contains role-shaping descriptors and contextual job characteristics.
Examples:
- `Distributed collaboration`
- `Cross-functional teamwork`
- `Remote work`

#### `soft_skills`
Contains communication, leadership, initiative, and similar non-technical traits.
Examples:
- `Problem-solving`
- `Written communication`
- `Ownership`

## `required_skills_text` Strategy

`required_skills_text` should be rebuilt from grouped outputs, not copied from a single flat list.

It should include items from:
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`
- `role_descriptors`

It should exclude:
- `soft_skills`

Ordering priority:
1. `technical_skills`
2. `platforms_cloud`
3. `tooling_devops`
4. `competencies`
5. `role_descriptors`

## Prerequisite Handling

### Core rule
Prerequisites must not be invented freely by the LLM.

The LLM may identify candidate skills and classify them, but prerequisite attachment must be controlled by backend taxonomy.

### Allowed prerequisite attachment
Prerequisite enrichment is allowed for:
- `technical_skills`
- selected `tooling_devops`
- selected `platforms_cloud` only if taxonomy coverage is explicit

### Disallowed prerequisite attachment
Do not attach graph prerequisites to:
- `competencies`
- `role_descriptors`
- `soft_skills`

### Why
This prevents graph pollution and keeps `PREREQUISITE_OF` edges meaningful for later Neo4j and GAT use.

## Taxonomy Expansion

The local taxonomy should be expanded for missing but common imported skills.

### Priority additions
- `rust`
- `java`
- `node_js`
- `aws`
- `gcp`
- `azure`
- `android`
- `ios`
- `ci_cd`
- `version_control`
- `containerization`
- `golang`

Each should include where applicable:
- aliases
- skill groups
- prerequisites
- related skills
- specializations
- classification target group

## Parser Pipeline Changes

### LLM output expectations
The LLM should return grouped candidate lists instead of one overloaded `required_skills` array.

Recommended grouped output:
- `technical_skills`
- `platforms_cloud`
- `tooling_devops`
- `competencies`
- `role_descriptors`
- `soft_skills`

Each item can still carry:
- `name`
- `importance`
- `requirement_type`
- `section_origin`
- `confidence`
- optional aliases

### Backend post-processing
After LLM output:
1. canonicalize each item
2. validate its target group
3. enrich with taxonomy metadata
4. attach prerequisites only if allowed by group
5. deduplicate across groups with clear precedence rules

### Group precedence
If an item appears in multiple groups, prefer:
1. `technical_skills`
2. `platforms_cloud`
3. `tooling_devops`
4. `competencies`
5. `role_descriptors`
6. `soft_skills`

## UI Changes

### Job Workspace
Replace the single overloaded skill presentation with grouped sections:
- `Technical Skills`
- `Cloud & Platforms`
- `Tooling & DevOps`
- `Competencies`
- `Role Descriptors`
- `Soft Skills`

### Display rules
- technical/core graph-oriented groups should remain prominent
- competencies and soft skills should appear secondary
- prerequisite and related skill display should only appear for groups that support graph enrichment

## Expected Improvement Outcome

For future imports of a JD like `Software Developer`, the parser should no longer flatten everything into one `required_skills` collection.

Instead, the output should look conceptually like:
- `technical_skills`: `Python`, `Node.js`, `Java`, `PostgreSQL`
- `platforms_cloud`: `AWS`, `GCP`, `Azure`
- `tooling_devops`: `Docker`, `CI/CD`, `Version control`
- `competencies`: `Software development`, `Full-stack development`, `Scalable software systems`
- `role_descriptors`: `Remote collaboration`, `Cross-functional work`
- `soft_skills`: `Problem-solving`, `Communication`, `Ownership`

This is significantly more useful for:
- graph sync design
- later GAT features
- recruiter inspection of parser quality

## Verification Targets

A successful implementation should show that a future imported job:
1. uses grouped skill output instead of one overloaded skill list
2. keeps `technical_skills` cleaner and more specific
3. attaches prerequisites only to approved groups
4. displays grouped sections cleanly in `/jobs/[jobId]`
5. builds a more readable `required_skills_text`

## Alignment with System Direction

This phase keeps the project aligned with `skillgraph_cv_matcher_system.md` by making the parser better at:
- understanding skill structure
- separating prerequisite-capable technical knowledge from generic capability signals
- preparing cleaner graph-ready data for Neo4j and GAT
