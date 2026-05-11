# Initial Scaffold Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a runnable Docker-based monorepo scaffold with Next.js frontend, FastAPI backend, PostgreSQL, Neo4j, DBeaver-ready PostgreSQL access, and a UI foundation aligned to `DESIGN.md`.

**Architecture:** The repository will contain `frontend/` and `backend/` application folders plus root-level infrastructure files. Docker Compose will orchestrate all four services, the backend will expose health and dependency checks, and the frontend will render a branded dashboard placeholder that consumes backend runtime status.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, FastAPI, Python 3.11, Uvicorn, psycopg, neo4j Python driver, PostgreSQL, Neo4j, Docker Compose

---

## File Structure

### Root

- `.env.example`: local environment template for frontend, backend, PostgreSQL, and Neo4j
- `.gitignore`: ignore Node, Python, and env artifacts
- `docker-compose.yml`: define and wire `frontend`, `backend`, `postgres`, and `neo4j`
- `README.md`: setup, run, verify, and DBeaver instructions

### Backend

- `backend/Dockerfile`: Python container image
- `backend/requirements.txt`: backend dependencies
- `backend/app/main.py`: FastAPI app bootstrap
- `backend/app/api/routes.py`: health and connection routes
- `backend/app/core/config.py`: environment parsing
- `backend/app/db/postgres.py`: PostgreSQL connectivity check
- `backend/app/db/neo4j.py`: Neo4j connectivity check

### Frontend

- `frontend/Dockerfile`: Node container image
- `frontend/package.json`: scripts and dependencies
- `frontend/next-env.d.ts`: Next.js TypeScript ambient declarations
- `frontend/tsconfig.json`: TypeScript config
- `frontend/next.config.ts`: Next.js config
- `frontend/postcss.config.js`: PostCSS config
- `frontend/tailwind.config.ts`: Tailwind config
- `frontend/app/layout.tsx`: app shell
- `frontend/app/page.tsx`: dashboard placeholder page
- `frontend/app/globals.css`: design tokens and global styling
- `frontend/components/hero.tsx`: branded top section
- `frontend/components/status-card.tsx`: dependency status card
- `frontend/components/section-shell.tsx`: layout wrapper
- `frontend/lib/api.ts`: backend fetch helper
- `frontend/lib/env.ts`: frontend env parsing

### Task 1: Initialize Repository Metadata and Root Infrastructure

**Files:**
- Create: `.gitignore`
- Create: `.env.example`
- Create: `docker-compose.yml`

- [ ] **Step 1: Write the root ignore rules**

```gitignore
# Node
node_modules/
.next/
out/

# Python
__pycache__/
*.pyc
.pytest_cache/
.venv/
venv/

# Local env
.env

# OS/editor
.DS_Store
.idea/
.vscode/
```

- [ ] **Step 2: Write the environment template**

```env
POSTGRES_DB=skillgraph
POSTGRES_USER=skillgraph_user
POSTGRES_PASSWORD=skillgraph_password
POSTGRES_HOST=postgres
POSTGRES_PORT=5432

NEO4J_URI=bolt://neo4j:7687
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=skillgraph_neo4j_password

NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

- [ ] **Step 3: Write the compose file**

```yaml
services:
  frontend:
    build:
      context: ./frontend
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_BASE_URL: ${NEXT_PUBLIC_API_BASE_URL}
    volumes:
      - ./frontend:/app
      - /app/node_modules
      - /app/.next
    depends_on:
      backend:
        condition: service_started
    command: npm run dev

  backend:
    build:
      context: ./backend
    ports:
      - "8000:8000"
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_HOST: ${POSTGRES_HOST}
      POSTGRES_PORT: ${POSTGRES_PORT}
      NEO4J_URI: ${NEO4J_URI}
      NEO4J_USERNAME: ${NEO4J_USERNAME}
      NEO4J_PASSWORD: ${NEO4J_PASSWORD}
    volumes:
      - ./backend:/app
    depends_on:
      postgres:
        condition: service_healthy
      neo4j:
        condition: service_healthy
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

  postgres:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 10

  neo4j:
    image: neo4j:5-community
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      NEO4J_AUTH: ${NEO4J_USERNAME}/${NEO4J_PASSWORD}
    volumes:
      - neo4j_data:/data
    healthcheck:
      test: ["CMD-SHELL", "cypher-shell -a bolt://localhost:7687 -u ${NEO4J_USERNAME} -p ${NEO4J_PASSWORD} 'RETURN 1;' >/dev/null 2>&1 || exit 1"]
      interval: 15s
      timeout: 10s
      retries: 20

volumes:
  postgres_data:
  neo4j_data:
```

- [ ] **Step 4: Verify the root files exist and parse cleanly**

Run: `sed -n '1,220p' .env.example .gitignore docker-compose.yml`
Expected: each file prints with the values and service definitions shown above

- [ ] **Step 5: Commit the root infrastructure**

```bash
git init
git add .gitignore .env.example docker-compose.yml
git commit -m "chore: add root project scaffold"
```

### Task 2: Build the Backend Application Skeleton

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/requirements.txt`
- Create: `backend/app/main.py`
- Create: `backend/app/api/routes.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/db/postgres.py`
- Create: `backend/app/db/neo4j.py`

- [ ] **Step 1: Write backend dependencies**

```text
fastapi==0.116.1
uvicorn[standard]==0.35.0
pydantic-settings==2.10.1
psycopg[binary]==3.2.9
neo4j==5.28.1
```

- [ ] **Step 2: Write the backend Dockerfile**

```dockerfile
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
```

- [ ] **Step 3: Write environment settings**

```python
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "SkillGraph CV Matcher API"
    postgres_db: str
    postgres_user: str
    postgres_password: str
    postgres_host: str
    postgres_port: int
    neo4j_uri: str
    neo4j_username: str
    neo4j_password: str

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    @property
    def postgres_dsn(self) -> str:
        return (
            f"postgresql://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
```

- [ ] **Step 4: Write PostgreSQL connectivity check**

```python
from psycopg import connect

from app.core.config import get_settings


def check_postgres_connection() -> dict:
    settings = get_settings()

    try:
        with connect(settings.postgres_dsn, connect_timeout=3) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1;")
                cursor.fetchone()

        return {"status": "ok", "message": "Connected to PostgreSQL"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
```

- [ ] **Step 5: Write Neo4j connectivity check**

```python
from neo4j import GraphDatabase

from app.core.config import get_settings


def check_neo4j_connection() -> dict:
    settings = get_settings()
    driver = None

    try:
        driver = GraphDatabase.driver(
            settings.neo4j_uri,
            auth=(settings.neo4j_username, settings.neo4j_password),
        )
        driver.verify_connectivity()
        return {"status": "ok", "message": "Connected to Neo4j"}
    except Exception as exc:
        return {"status": "error", "message": str(exc)}
    finally:
        if driver is not None:
            driver.close()
```

- [ ] **Step 6: Write API routes**

```python
from fastapi import APIRouter

from app.core.config import get_settings
from app.db.neo4j import check_neo4j_connection
from app.db.postgres import check_postgres_connection

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok"}


@router.get("/api/health")
def app_health() -> dict:
    settings = get_settings()
    return {"status": "ok", "app_name": settings.app_name}


@router.get("/api/connections")
def connections() -> dict:
    postgres = check_postgres_connection()
    neo4j = check_neo4j_connection()

    return {
        "status": "ok" if postgres["status"] == "ok" and neo4j["status"] == "ok" else "degraded",
        "services": {
            "postgres": postgres,
            "neo4j": neo4j,
        },
    }
```

- [ ] **Step 7: Write the FastAPI entrypoint**

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings

settings = get_settings()

app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
```

- [ ] **Step 8: Verify backend imports and file layout**

Run: `sed -n '1,220p' backend/requirements.txt backend/Dockerfile backend/app/main.py backend/app/api/routes.py backend/app/core/config.py backend/app/db/postgres.py backend/app/db/neo4j.py`
Expected: the backend files print with the exact dependency, config, route, and connection-check code above

- [ ] **Step 9: Commit the backend skeleton**

```bash
git add backend
git commit -m "feat: add FastAPI health and connection scaffold"
```

### Task 3: Build the Frontend Project and Shared Design Tokens

**Files:**
- Create: `frontend/Dockerfile`
- Create: `frontend/package.json`
- Create: `frontend/next-env.d.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/next.config.ts`
- Create: `frontend/postcss.config.js`
- Create: `frontend/tailwind.config.ts`
- Create: `frontend/app/layout.tsx`
- Create: `frontend/app/globals.css`
- Create: `frontend/lib/env.ts`

- [ ] **Step 1: Write the frontend package manifest**

```json
{
  "name": "skillgraph-cv-matcher-frontend",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "15.3.2",
    "react": "19.1.0",
    "react-dom": "19.1.0"
  },
  "devDependencies": {
    "@types/node": "22.15.30",
    "@types/react": "19.1.6",
    "@types/react-dom": "19.1.5",
    "autoprefixer": "10.4.21",
    "postcss": "8.5.4",
    "tailwindcss": "3.4.17",
    "typescript": "5.8.3"
  }
}
```

- [ ] **Step 2: Write the frontend Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

EXPOSE 3000
```

- [ ] **Step 3: Write Next.js type declarations, TypeScript config, and Next.js config**

```ts
/// <reference types="next" />
/// <reference types="next/image-types/global" />

// This file is automatically managed by Next.js.
```

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": {
      "@/*": ["./*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 4: Write PostCSS, Tailwind, and frontend env helper**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

```ts
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "var(--color-brand)",
          dark: "var(--color-brand-dark)",
          deep: "var(--color-brand-deep)",
          subtle: "var(--color-brand-subtle)",
        },
      },
      boxShadow: {
        whisper: "var(--shadow-whisper)",
        micro: "var(--shadow-micro)",
      },
      borderRadius: {
        brand: "var(--radius-brand)",
      },
      fontFamily: {
        display: ["IBM Plex Sans", "Helvetica", "Arial", "sans-serif"],
        body: ["Helvetica Neue", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
```

```ts
export const publicEnv = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000",
};
```

- [ ] **Step 5: Write app shell and design tokens**

```tsx
import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "SkillGraph CV Matcher",
  description: "Explainable CV matching with skill graph intelligence.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-brand: #7132f5;
  --color-brand-dark: #5741d8;
  --color-brand-deep: #5b1ecf;
  --color-brand-subtle: rgba(133, 91, 251, 0.16);
  --color-text: #101114;
  --color-muted: #9497a9;
  --color-border: #dedee5;
  --color-surface: #ffffff;
  --color-success: #149e61;
  --color-success-text: #026b3f;
  --radius-brand: 12px;
  --shadow-whisper: rgba(0, 0, 0, 0.03) 0px 4px 24px;
  --shadow-micro: rgba(16, 24, 40, 0.04) 0px 1px 4px;
}

* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
}

body {
  margin: 0;
  min-height: 100vh;
  color: var(--color-text);
  background:
    radial-gradient(circle at top right, rgba(113, 50, 245, 0.12), transparent 28%),
    linear-gradient(180deg, #ffffff 0%, #faf9ff 100%);
  font-family: "Helvetica Neue", Helvetica, Arial, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}
```

- [ ] **Step 6: Verify the frontend foundation files**

Run: `sed -n '1,240p' frontend/package.json frontend/Dockerfile frontend/tsconfig.json frontend/next.config.ts frontend/postcss.config.js frontend/tailwind.config.ts frontend/app/layout.tsx frontend/app/globals.css frontend/lib/env.ts`
Expected: all frontend foundation files print with the scripts, config, tokens, and layout shown above

Run: `sed -n '1,80p' frontend/next-env.d.ts`
Expected: the Next.js type declaration file prints with the standard reference directives shown above

- [ ] **Step 7: Commit the frontend foundation**

```bash
git add frontend
git commit -m "feat: add Next.js foundation and design tokens"
```

### Task 4: Build the Frontend Dashboard Placeholder and Backend Status Integration

**Files:**
- Create: `frontend/lib/api.ts`
- Create: `frontend/components/hero.tsx`
- Create: `frontend/components/status-card.tsx`
- Create: `frontend/components/section-shell.tsx`
- Create: `frontend/app/page.tsx`

- [ ] **Step 1: Write the backend fetch helper**

```ts
import { publicEnv } from "@/lib/env";

type ConnectionResponse = {
  status: string;
  services: {
    postgres: { status: string; message: string };
    neo4j: { status: string; message: string };
  };
};

export async function getConnections(): Promise<ConnectionResponse | null> {
  try {
    const response = await fetch(`${publicEnv.apiBaseUrl}/api/connections`, {
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as ConnectionResponse;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Write reusable UI components**

```tsx
type HeroProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function Hero({ eyebrow, title, description }: HeroProps) {
  return (
    <section className="rounded-[28px] border border-[var(--color-border)] bg-white/90 p-8 shadow-whisper md:p-12">
      <p className="mb-4 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
        {eyebrow}
      </p>
      <h1 className="max-w-3xl font-display text-4xl font-bold tracking-[-0.04em] text-[var(--color-text)] md:text-6xl">
        {title}
      </h1>
      <p className="mt-6 max-w-2xl text-base leading-7 text-[var(--color-muted)] md:text-lg">
        {description}
      </p>
    </section>
  );
}
```

```tsx
type StatusCardProps = {
  label: string;
  status: string;
  message: string;
};

export function StatusCard({ label, status, message }: StatusCardProps) {
  const ok = status === "ok";

  return (
    <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-[var(--color-text)]">{label}</h3>
        <span
          className={`rounded-md px-3 py-1 text-xs font-semibold ${
            ok
              ? "bg-[rgba(20,158,97,0.16)] text-[var(--color-success-text)]"
              : "bg-[rgba(113,50,245,0.12)] text-[var(--color-brand-dark)]"
          }`}
        >
          {status}
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">{message}</p>
    </article>
  );
}
```

```tsx
export function SectionShell({
  title,
  children,
}: Readonly<{
  title: string;
  children: React.ReactNode;
}>) {
  return (
    <section className="mt-10">
      <h2 className="mb-5 font-display text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
        {title}
      </h2>
      {children}
    </section>
  );
}
```

- [ ] **Step 3: Write the dashboard page**

```tsx
import { Hero } from "@/components/hero";
import { SectionShell } from "@/components/section-shell";
import { StatusCard } from "@/components/status-card";
import { getConnections } from "@/lib/api";

const fallbackServices = {
  postgres: {
    status: "unknown",
    message: "Backend status not available yet.",
  },
  neo4j: {
    status: "unknown",
    message: "Backend status not available yet.",
  },
};

export default async function Home() {
  const connections = await getConnections();
  const services = connections?.services ?? fallbackServices;

  return (
    <main className="mx-auto max-w-7xl px-6 py-8 md:px-10 md:py-10">
      <Hero
        eyebrow="Explainable Matching"
        title="SkillGraph CV Matcher for transparent HR screening"
        description="A Docker-first scaffold for CV analysis, graph-aware skill matching, and explainable ranking. This first milestone proves the platform shell, service health, and database connectivity."
      />

      <SectionShell title="Runtime Status">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard label="Frontend" status="ok" message="Next.js dashboard is rendering." />
          <StatusCard label="Backend" status={connections ? "ok" : "unknown"} message={connections ? "FastAPI connection endpoint responded." : "Waiting for backend connection response."} />
          <StatusCard label="PostgreSQL" status={services.postgres.status} message={services.postgres.message} />
          <StatusCard label="Neo4j" status={services.neo4j.status} message={services.neo4j.message} />
        </div>
      </SectionShell>

      <SectionShell title="Platform Scope">
        <div className="grid gap-5 md:grid-cols-3">
          <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
            <h3 className="text-lg font-semibold">Input Layer</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              CV and job description ingestion will enter through this shell in later milestones.
            </p>
          </article>
          <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
            <h3 className="text-lg font-semibold">Skill Intelligence</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              PostgreSQL stores core application data while Neo4j prepares the graph runtime for skill relationships.
            </p>
          </article>
          <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
            <h3 className="text-lg font-semibold">HR Output</h3>
            <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
              The long-term destination is explainable ranking, candidate fit rationale, and downloadable reports.
            </p>
          </article>
        </div>
      </SectionShell>
    </main>
  );
}
```

- [ ] **Step 4: Verify the page and integration files**

Run: `sed -n '1,260p' frontend/lib/api.ts frontend/components/hero.tsx frontend/components/status-card.tsx frontend/components/section-shell.tsx frontend/app/page.tsx`
Expected: the frontend page and support files print with the status-fetching logic and branded placeholder content above

- [ ] **Step 5: Commit the frontend experience**

```bash
git add frontend
git commit -m "feat: add branded dashboard placeholder"
```

### Task 5: Document Local Development and DBeaver Usage

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write the project README**

````md
# SkillGraph CV Matcher

Initial scaffold for a Docker-based CV matching platform with:

- Next.js frontend
- FastAPI backend
- PostgreSQL
- Neo4j

## Prerequisites

- Docker
- Docker Compose
- DBeaver (optional, for PostgreSQL inspection)

## Setup

1. Copy the environment file:

```bash
cp .env.example .env
```

2. Start the stack:

```bash
docker compose up --build
```

## Local URLs

- Frontend: `http://localhost:3000`
- Backend Swagger: `http://localhost:8000/docs`
- Backend health: `http://localhost:8000/health`
- Backend connections: `http://localhost:8000/api/connections`
- Neo4j Browser: `http://localhost:7474`

## DBeaver PostgreSQL Connection

Use these values:

- Host: `localhost`
- Port: `5432`
- Database: value of `POSTGRES_DB` in `.env`
- Username: value of `POSTGRES_USER` in `.env`
- Password: value of `POSTGRES_PASSWORD` in `.env`

DBeaver connects directly to the PostgreSQL container through the mapped host port.

## Verification Checklist

- Frontend loads at `http://localhost:3000`
- Swagger loads at `http://localhost:8000/docs`
- `GET /api/connections` shows PostgreSQL and Neo4j status
- DBeaver connects to PostgreSQL successfully
````

- [ ] **Step 2: Verify README content**

Run: `sed -n '1,220p' README.md`
Expected: the README prints the setup steps, local URLs, and DBeaver configuration shown above

- [ ] **Step 3: Commit the developer documentation**

```bash
git add README.md
git commit -m "docs: add local setup and DBeaver guide"
```

### Task 6: Run End-to-End Verification

**Files:**
- Verify: `.env`
- Verify: running Docker services

- [ ] **Step 1: Create the local env file**

```bash
cp .env.example .env
```

- [ ] **Step 2: Build and start the stack**

Run: `docker compose up --build`
Expected: Compose builds `frontend` and `backend`, starts `postgres` and `neo4j`, then serves the app stack without immediate crash loops

- [ ] **Step 3: Verify backend health**

Run: `curl -s http://localhost:8000/health`
Expected:

```json
{"status":"ok"}
```

- [ ] **Step 4: Verify backend dependency status**

Run: `curl -s http://localhost:8000/api/connections`
Expected:

```json
{
  "status": "ok",
  "services": {
    "postgres": {
      "status": "ok",
      "message": "Connected to PostgreSQL"
    },
    "neo4j": {
      "status": "ok",
      "message": "Connected to Neo4j"
    }
  }
}
```

- [ ] **Step 5: Verify frontend reachability**

Run: `curl -I http://localhost:3000`
Expected: an HTTP `200` or `307`/`308` response that confirms the Next.js app is serving

- [ ] **Step 6: Verify PostgreSQL from DBeaver**

Use the connection values from `README.md`.
Expected: DBeaver opens a live PostgreSQL connection and can browse the database named in `.env`

- [ ] **Step 7: Commit final scaffold adjustments**

```bash
git add .
git commit -m "chore: verify initial scaffold"
```
