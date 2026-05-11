# Initial Scaffold Design

## Goal

Create the first runnable monorepo scaffold for SkillGraph CV Matcher with:

- `frontend` using Next.js and TypeScript
- `backend` using FastAPI and Python
- `postgres` for the primary relational database
- `neo4j` as the graph database placeholder for the future skill graph pipeline
- Docker-based local runtime for all services
- a PostgreSQL setup that can be connected to immediately from DBeaver

This scaffold is intentionally minimal. It should prove that the project boots cleanly, services can talk to each other, and the UI direction follows the visual system described in `DESIGN.md`.

## Scope

This design covers only the initial project setup layer:

- project folder structure
- Docker runtime
- environment configuration
- backend health and connection-check endpoints
- frontend placeholder dashboard/landing page
- shared design tokens derived from `DESIGN.md`
- DBeaver connection instructions for PostgreSQL

This design does not include:

- CV/JD upload flows
- authentication
- ORM models or migrations
- vector search
- Neo4j data modeling
- LLM extraction
- report export
- GNN pipeline

## Architecture

The repository will be organized as a simple monorepo with two application directories and root-level infrastructure files.

- `frontend/` hosts a Next.js App Router app
- `backend/` hosts a FastAPI app
- `docker-compose.yml` orchestrates `frontend`, `backend`, `postgres`, and `neo4j`
- `.env.example` defines the required local environment variables

The frontend will call the backend through a public API base URL exposed through a Next.js environment variable. The backend will use internal Docker network hostnames to reach PostgreSQL and Neo4j.

PostgreSQL will be the only database explicitly prepared for DBeaver use in this phase. Neo4j is included as a live service so later graph work can start without restructuring the compose topology.

## Folder Structure

```text
.
├── DESIGN.md
├── skillgraph_cv_matcher_system.md
├── .env.example
├── docker-compose.yml
├── README.md
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── next.config.ts
│   ├── postcss.config.js
│   ├── tailwind.config.ts
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── hero.tsx
│   │   ├── status-card.tsx
│   │   └── section-shell.tsx
│   └── lib/
│       ├── api.ts
│       └── env.ts
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    └── app/
        ├── main.py
        ├── api/
        │   └── routes.py
        ├── core/
        │   └── config.py
        └── db/
            ├── postgres.py
            └── neo4j.py
```

The file boundaries are intentionally narrow:

- frontend components remain presentation-focused
- backend routes remain thin and delegate connectivity checks to DB modules
- environment parsing stays centralized

## Docker Runtime

`docker-compose.yml` will define four services:

### `frontend`

- based on Node
- runs Next.js dev server on port `3000`
- mounted for local iteration
- depends on `backend`

### `backend`

- based on Python
- runs Uvicorn on port `8000`
- depends on `postgres` and `neo4j`
- exposes Swagger at `/docs`

### `postgres`

- based on official PostgreSQL image
- exposes port `5432` to the host
- initialized entirely by environment variables in compose
- stores data in a named Docker volume

### `neo4j`

- based on official Neo4j image
- exposes Browser on `7474`
- exposes Bolt on `7687`
- uses a named Docker volume

## Environment Configuration

The root `.env.example` should include at minimum:

- PostgreSQL database name
- PostgreSQL user
- PostgreSQL password
- PostgreSQL host and port for backend use
- Neo4j URI
- Neo4j username
- Neo4j password
- frontend public backend URL

The backend reads these settings through a single config module. The frontend reads only the public API base URL.

The compose file will map internal service names like `postgres` and `neo4j` for container-to-container communication, while README examples for DBeaver will use `localhost`.

## Backend Behavior

The backend should provide three initial routes:

- `GET /health`
- `GET /api/health`
- `GET /api/connections`

### `GET /health`

Returns a small liveness payload confirming the API process is running.

### `GET /api/health`

Returns:

- API liveness
- app name or environment metadata

This is a lightweight application health endpoint.

### `GET /api/connections`

Returns the status of:

- PostgreSQL connectivity
- Neo4j connectivity

If one dependency is unavailable, the API should still return structured JSON rather than crash the server. The endpoint should report which dependency failed and include a concise error message that is safe for local development visibility.

## Frontend Behavior

The frontend should not be a template-default screen. It should immediately express the product identity from `DESIGN.md`.

The initial page should include:

- a hero/overview area for the HR-facing product
- visual status cards showing frontend, backend, PostgreSQL, and Neo4j runtime status
- a concise summary of what the system will eventually do
- links or labels for backend docs and local database services

The page may use mock content, but it must look intentional and aligned with the design language rather than generic.

## Design System Rules

The entire scaffold must visually track `DESIGN.md`.

For this first pass:

- use a light theme
- use Kraken-inspired purple as the primary brand accent
- keep rounded controls at the specified moderate radius rather than pill shapes
- centralize color, typography, radius, spacing, and shadow tokens in CSS variables or a similarly shared location
- avoid default Next.js starter styling

Because the design file references proprietary fonts that may not be locally available, the scaffold should use a pragmatic fallback stack that approximates the intended tone while preserving the hierarchy and spacing rules from `DESIGN.md`.

## DBeaver and PostgreSQL

The scaffold must explicitly support DBeaver access to PostgreSQL.

The README should document:

- host: `localhost`
- port: `5432`
- database name from `.env`
- username from `.env`
- password from `.env`

It should also note that DBeaver connects to PostgreSQL, not through the backend container.

## Error Handling

### Backend

- startup should be tolerant of database warm-up time
- health-style routes must return JSON even when a dependency is unavailable
- connection checks should catch and report exceptions cleanly

### Frontend

- when backend status fetch fails, the page should render a readable fallback state
- dependency errors should appear as controlled status text, not an unhandled crash

## Verification Requirements

The scaffold is complete only if all of the following are true:

1. `docker compose up --build` starts all four services
2. `http://localhost:3000` renders the designed placeholder UI
3. `http://localhost:8000/docs` loads FastAPI Swagger
4. the backend connection endpoint reports PostgreSQL and Neo4j status
5. DBeaver can connect to PostgreSQL using the documented local credentials

## Testing Strategy

Formal automated tests are not required in this phase.

Verification is operational:

- build containers successfully
- verify service reachability
- verify API JSON responses
- verify DBeaver connectivity

This keeps the first milestone focused on infrastructure correctness and UI foundation rather than application logic.

## Implementation Notes

- Prefer a minimal dependency set
- Keep file boundaries small and obvious
- Do not introduce ORM or migration tooling in this phase
- Keep Neo4j integration limited to connection verification
- Keep the frontend structured so later dashboard modules can expand without redesigning the app shell

## Risks and Decisions

### Decision: include Neo4j now

Neo4j is included from the beginning even though the first milestone uses it only for connectivity checks. This avoids reworking Docker and configuration later when graph features begin.

### Decision: postpone ORM and migrations

PostgreSQL is being introduced only as a running database and connection target. Data modeling concerns are intentionally deferred to the next implementation cycle.

### Risk: design fidelity versus font availability

The visual system can closely match the color, spacing, and component tone in `DESIGN.md`, but exact typography may differ until project-approved font assets are introduced.

### Risk: Docker startup ordering

Compose dependency ordering alone is not enough to guarantee database readiness. The backend implementation must handle transient connection failures gracefully in runtime checks.
