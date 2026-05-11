# Frontend CRUD UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a sidebar-based app shell plus frontend create/edit/delete UI for `jobs` and `candidates` using the existing backend CRUD APIs.

**Architecture:** The frontend will move from a single overview page to a small routed workspace. A reusable sidebar shell will host an overview route and two client-driven admin routes. Each admin route will fetch list data, open a right-side drawer for create/edit, confirm deletes, and refresh data after mutations. The visual language must continue to follow `DESIGN.md`.

**Tech Stack:** Next.js 15 App Router, TypeScript, React 19, Tailwind CSS, existing backend fetch APIs

---

## File Structure

### App shell and routing

- Create: `frontend/components/app-shell.tsx`
- Create: `frontend/components/sidebar-nav.tsx`
- Create: `frontend/components/page-header.tsx`
- Create: `frontend/app/(dashboard)/layout.tsx`
- Create: `frontend/app/(dashboard)/page.tsx`
- Create: `frontend/app/(dashboard)/admin/jobs/page.tsx`
- Create: `frontend/app/(dashboard)/admin/candidates/page.tsx`
- Modify: `frontend/app/page.tsx`

### Shared CRUD UI

- Create: `frontend/components/state-card.tsx`
- Create: `frontend/components/confirm-dialog.tsx`
- Create: `frontend/components/drawer-panel.tsx`

### Jobs admin

- Create: `frontend/components/jobs/job-form.tsx`
- Create: `frontend/components/jobs/job-list.tsx`
- Create: `frontend/components/jobs/job-admin-client.tsx`

### Candidates admin

- Create: `frontend/components/candidates/candidate-form.tsx`
- Create: `frontend/components/candidates/candidate-list.tsx`
- Create: `frontend/components/candidates/candidate-admin-client.tsx`

### API helpers and types

- Modify: `frontend/lib/api.ts`

### Task 1: Refactor the App Into a Routed Dashboard Shell

**Files:**
- Create: `frontend/components/app-shell.tsx`
- Create: `frontend/components/sidebar-nav.tsx`
- Create: `frontend/components/page-header.tsx`
- Create: `frontend/app/(dashboard)/layout.tsx`
- Create: `frontend/app/(dashboard)/page.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Create the sidebar navigation component**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Overview" },
  { href: "/admin/jobs", label: "Admin Jobs" },
  { href: "/admin/candidates", label: "Admin Candidates" },
];

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-[var(--color-border)] bg-white/90 px-4 py-4 md:w-72 md:border-b-0 md:border-r md:px-5 md:py-6">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
          SkillGraph
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold tracking-[-0.04em] text-[var(--color-text)]">
          Admin Workspace
        </h2>
      </div>

      <nav className="flex flex-col gap-2">
        {navItems.map((item) => {
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-[16px] px-4 py-3 text-sm font-medium transition ${
                active
                  ? "bg-[var(--color-brand)] text-white shadow-micro"
                  : "bg-[rgba(148,151,169,0.08)] text-[var(--color-text)] hover:bg-[var(--color-brand-subtle)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Create the page header component**

```tsx
import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="rounded-[24px] border border-[var(--color-border)] bg-white/90 p-6 shadow-whisper md:p-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--color-brand-dark)]">
            {eyebrow}
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-[-0.04em] text-[var(--color-text)] md:text-4xl">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-[var(--color-muted)] md:text-base">
            {description}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
```

- [ ] **Step 3: Create the reusable app shell**

```tsx
import type { ReactNode } from "react";

import { SidebarNav } from "@/components/sidebar-nav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen md:flex">
      <SidebarNav />
      <div className="flex-1">
        <main className="mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add the dashboard route group layout**

```tsx
import type { ReactNode } from "react";

import { AppShell } from "@/components/app-shell";

export default function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
```

- [ ] **Step 5: Move the current overview page into the dashboard route group**

```tsx
import { Hero } from "@/components/hero";
import { PageHeader } from "@/components/page-header";
import { SectionShell } from "@/components/section-shell";
import { StatusCard } from "@/components/status-card";
import { getCandidates, getConnections, getJobs } from "@/lib/api";

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

export default async function OverviewPage() {
  const [connections, jobs, candidates] = await Promise.all([
    getConnections(),
    getJobs(),
    getCandidates(),
  ]);

  const services = connections?.services ?? fallbackServices;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Workspace"
        title="Overview"
        description="Track runtime health and inspect the current state of persisted jobs and candidates."
      />

      <Hero
        eyebrow="Explainable Matching"
        title="SkillGraph CV Matcher for transparent HR screening"
        description="A Docker-first scaffold for CV analysis, graph-aware skill matching, and explainable ranking. This milestone adds PostgreSQL-backed persistence and live dashboard data."
      />

      <SectionShell title="Runtime Status">
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <StatusCard label="Frontend" status="ok" message="Next.js dashboard is rendering." />
          <StatusCard label="Backend" status={connections ? "ok" : "unknown"} message={connections ? "FastAPI connection endpoint responded." : "Waiting for backend connection response."} />
          <StatusCard label="PostgreSQL" status={services.postgres.status} message={services.postgres.message} />
          <StatusCard label="Neo4j" status={services.neo4j.status} message={services.neo4j.message} />
        </div>
      </SectionShell>

      <SectionShell title="Current Totals">
        <div className="grid gap-5 md:grid-cols-2">
          <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
            <h3 className="text-lg font-semibold">Jobs</h3>
            <p className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--color-text)]">
              {jobs.length}
            </p>
          </article>
          <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
            <h3 className="text-lg font-semibold">Candidates</h3>
            <p className="mt-3 text-4xl font-bold tracking-[-0.04em] text-[var(--color-text)]">
              {candidates.length}
            </p>
          </article>
        </div>
      </SectionShell>
    </div>
  );
}
```

- [ ] **Step 6: Redirect the root page to the dashboard route group page**

```tsx
export { default } from "./(dashboard)/page";
```

- [ ] **Step 7: Verify the app shell files**

Run: `sed -n '1,320p' frontend/components/sidebar-nav.tsx frontend/components/page-header.tsx frontend/components/app-shell.tsx frontend/app/(dashboard)/layout.tsx frontend/app/(dashboard)/page.tsx frontend/app/page.tsx`
Expected: the dashboard route group provides a sidebar shell and the overview remains accessible as the root screen

- [ ] **Step 8: Commit the app shell refactor**

```bash
git add frontend/components/sidebar-nav.tsx frontend/components/page-header.tsx frontend/components/app-shell.tsx frontend/app/(dashboard)/layout.tsx frontend/app/(dashboard)/page.tsx frontend/app/page.tsx
git commit -m "feat: add dashboard shell and routed overview"
```

### Task 2: Add Shared CRUD UI Building Blocks

**Files:**
- Create: `frontend/components/state-card.tsx`
- Create: `frontend/components/confirm-dialog.tsx`
- Create: `frontend/components/drawer-panel.tsx`

- [ ] **Step 1: Create a reusable state card**

```tsx
import type { ReactNode } from "react";

export function StateCard({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <article className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro">
      <h3 className="text-lg font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </article>
  );
}
```

- [ ] **Step 2: Create the right-side drawer panel**

```tsx
"use client";

import type { ReactNode } from "react";

export function DrawerPanel({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-[rgba(16,17,20,0.18)]">
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-[var(--color-border)] bg-white p-6 shadow-whisper md:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[12px] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)]"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create a simple confirmation dialog**

```tsx
"use client";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(16,17,20,0.22)] px-4">
      <div className="w-full max-w-md rounded-[24px] border border-[var(--color-border)] bg-white p-6 shadow-whisper">
        <h3 className="font-display text-2xl font-bold tracking-[-0.03em] text-[var(--color-text)]">
          {title}
        </h3>
        <p className="mt-4 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-[12px] border border-[var(--color-border)] px-4 py-3 text-sm font-medium text-[var(--color-text)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-[12px] bg-[var(--color-brand)] px-4 py-3 text-sm font-semibold text-white"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify the shared UI building blocks**

Run: `sed -n '1,260p' frontend/components/state-card.tsx frontend/components/drawer-panel.tsx frontend/components/confirm-dialog.tsx`
Expected: the shared components provide empty/error/loading cards, a drawer, and a confirmation dialog aligned to the design system

- [ ] **Step 5: Commit the shared UI building blocks**

```bash
git add frontend/components/state-card.tsx frontend/components/drawer-panel.tsx frontend/components/confirm-dialog.tsx
git commit -m "feat: add shared frontend CRUD UI components"
```

### Task 3: Extend the Frontend API Client for Create, Update, and Delete

**Files:**
- Modify: `frontend/lib/api.ts`

- [ ] **Step 1: Add create/update payload types**

```ts
export type JobInput = {
  title: string;
  description: string | null;
  required_skills_text: string | null;
  status: string;
};

export type JobUpdateInput = Partial<JobInput>;

export type CandidateInput = {
  full_name: string;
  email: string | null;
  resume_text: string | null;
  skills_text: string | null;
  status: string;
};

export type CandidateUpdateInput = Partial<CandidateInput>;
```

- [ ] **Step 2: Add job mutation helpers**

```ts
export async function createJob(payload: JobInput): Promise<Job> {
  const response = await fetch(`${serverEnv.apiBaseUrl}/api/jobs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create job.");
  }

  return (await response.json()) as Job;
}

export async function updateJob(jobId: number, payload: JobUpdateInput): Promise<Job> {
  const response = await fetch(`${serverEnv.apiBaseUrl}/api/jobs/${jobId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to update job.");
  }

  return (await response.json()) as Job;
}

export async function deleteJob(jobId: number): Promise<void> {
  const response = await fetch(`${serverEnv.apiBaseUrl}/api/jobs/${jobId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete job.");
  }
}
```

- [ ] **Step 3: Add candidate mutation helpers**

```ts
export async function createCandidate(payload: CandidateInput): Promise<Candidate> {
  const response = await fetch(`${serverEnv.apiBaseUrl}/api/candidates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to create candidate.");
  }

  return (await response.json()) as Candidate;
}

export async function updateCandidate(
  candidateId: number,
  payload: CandidateUpdateInput,
): Promise<Candidate> {
  const response = await fetch(`${serverEnv.apiBaseUrl}/api/candidates/${candidateId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Failed to update candidate.");
  }

  return (await response.json()) as Candidate;
}

export async function deleteCandidate(candidateId: number): Promise<void> {
  const response = await fetch(`${serverEnv.apiBaseUrl}/api/candidates/${candidateId}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    throw new Error("Failed to delete candidate.");
  }
}
```

- [ ] **Step 4: Verify the API helper module**

Run: `sed -n '1,360p' frontend/lib/api.ts`
Expected: the module supports list/create/update/delete for jobs and candidates with shared types

- [ ] **Step 5: Commit the API client expansion**

```bash
git add frontend/lib/api.ts
git commit -m "feat: add frontend CRUD api helpers"
```

### Task 4: Build the Jobs Admin Screen and CRUD Flow

**Files:**
- Create: `frontend/components/jobs/job-form.tsx`
- Create: `frontend/components/jobs/job-list.tsx`
- Create: `frontend/components/jobs/job-admin-client.tsx`
- Create: `frontend/app/(dashboard)/admin/jobs/page.tsx`

- [ ] **Step 1: Create the job form component**

```tsx
"use client";

import { useEffect, useState } from "react";

import type { Job, JobInput } from "@/lib/api";

const defaultValues: JobInput = {
  title: "",
  description: "",
  required_skills_text: "",
  status: "draft",
};

export function JobForm({
  mode,
  initialValue,
  isSubmitting,
  error,
  onSubmit,
}: {
  mode: "create" | "edit";
  initialValue: Job | null;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (payload: JobInput) => Promise<void>;
}) {
  const [values, setValues] = useState<JobInput>(defaultValues);

  useEffect(() => {
    if (mode === "edit" && initialValue) {
      setValues({
        title: initialValue.title,
        description: initialValue.description,
        required_skills_text: initialValue.required_skills_text,
        status: initialValue.status,
      });
      return;
    }

    setValues(defaultValues);
  }, [initialValue, mode]);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(values);
      }}
    >
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">Title</label>
        <input
          value={values.title}
          onChange={(event) => setValues((current) => ({ ...current, title: event.target.value }))}
          className="w-full rounded-[12px] border border-[var(--color-border)] px-4 py-3 text-sm"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">Description</label>
        <textarea
          value={values.description ?? ""}
          onChange={(event) =>
            setValues((current) => ({ ...current, description: event.target.value }))
          }
          className="min-h-[120px] w-full rounded-[12px] border border-[var(--color-border)] px-4 py-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">Required Skills</label>
        <textarea
          value={values.required_skills_text ?? ""}
          onChange={(event) =>
            setValues((current) => ({
              ...current,
              required_skills_text: event.target.value,
            }))
          }
          className="min-h-[120px] w-full rounded-[12px] border border-[var(--color-border)] px-4 py-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">Status</label>
        <select
          value={values.status}
          onChange={(event) => setValues((current) => ({ ...current, status: event.target.value }))}
          className="w-full rounded-[12px] border border-[var(--color-border)] px-4 py-3 text-sm"
        >
          <option value="draft">draft</option>
          <option value="analyzed">analyzed</option>
          <option value="archived">archived</option>
        </select>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-[12px] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isSubmitting ? "Saving..." : mode === "create" ? "Create Job" : "Update Job"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create the job list component**

```tsx
"use client";

import type { Job } from "@/lib/api";

export function JobList({
  jobs,
  onEdit,
  onDelete,
}: {
  jobs: Job[];
  onEdit: (job: Job) => void;
  onDelete: (job: Job) => void;
}) {
  return (
    <div className="grid gap-5">
      {jobs.map((job) => (
        <article
          key={job.id}
          className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                {job.status}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--color-text)]">{job.title}</h3>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                {job.description ?? "No description provided."}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onEdit(job)}
                className="rounded-[12px] border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(job)}
                className="rounded-[12px] bg-[rgba(113,50,245,0.12)] px-4 py-2 text-sm font-medium text-[var(--color-brand-dark)]"
              >
                Delete
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the jobs admin client container**

```tsx
"use client";

import { useEffect, useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DrawerPanel } from "@/components/drawer-panel";
import { PageHeader } from "@/components/page-header";
import { StateCard } from "@/components/state-card";
import {
  createJob,
  deleteJob,
  getJobs,
  type Job,
  type JobInput,
  updateJob,
} from "@/lib/api";

import { JobForm } from "./job-form";
import { JobList } from "./job-list";

export function JobAdminClient() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Job | null>(null);

  async function loadJobs() {
    setLoading(true);
    setError(null);
    try {
      const data = await getJobs();
      setJobs(data);
    } catch {
      setError("Failed to load jobs.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadJobs();
  }, []);

  async function handleSubmit(payload: JobInput) {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (mode === "create") {
        await createJob(payload);
      } else if (selectedJob) {
        await updateJob(selectedJob.id, payload);
      }

      setDrawerOpen(false);
      setSelectedJob(null);
      await loadJobs();
    } catch {
      setSubmitError("Failed to save job.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteJob(deleteTarget.id);
      setDeleteTarget(null);
      await loadJobs();
    } catch {
      setError("Failed to delete job.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Manage Jobs"
        description="Create, edit, and remove job records from the PostgreSQL-backed workspace."
        action={
          <button
            type="button"
            onClick={() => {
              setMode("create");
              setSelectedJob(null);
              setSubmitError(null);
              setDrawerOpen(true);
            }}
            className="rounded-[12px] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white"
          >
            Create Job
          </button>
        }
      />

      {loading ? (
        <StateCard title="Loading jobs" description="Fetching the latest persisted job records." />
      ) : error ? (
        <StateCard title="Unable to load jobs" description={error} />
      ) : jobs.length === 0 ? (
        <StateCard
          title="No jobs yet"
          description="Start by creating the first job record for this workspace."
        />
      ) : (
        <JobList
          jobs={jobs}
          onEdit={(job) => {
            setMode("edit");
            setSelectedJob(job);
            setSubmitError(null);
            setDrawerOpen(true);
          }}
          onDelete={(job) => setDeleteTarget(job)}
        />
      )}

      <DrawerPanel
        open={drawerOpen}
        title={mode === "create" ? "Create Job" : "Edit Job"}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedJob(null);
        }}
      >
        <JobForm
          mode={mode}
          initialValue={selectedJob}
          isSubmitting={isSubmitting}
          error={submitError}
          onSubmit={handleSubmit}
        />
      </DrawerPanel>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete job?"
        description="This action will permanently remove the selected job record."
        confirmLabel="Delete Job"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create the jobs admin route**

```tsx
import { JobAdminClient } from "@/components/jobs/job-admin-client";

export default function AdminJobsPage() {
  return <JobAdminClient />;
}
```

- [ ] **Step 5: Verify the jobs admin files**

Run: `sed -n '1,360p' frontend/components/jobs/job-form.tsx frontend/components/jobs/job-list.tsx frontend/components/jobs/job-admin-client.tsx frontend/app/(dashboard)/admin/jobs/page.tsx`
Expected: jobs admin supports create/edit/delete with drawer, confirm dialog, and list refresh behavior

- [ ] **Step 6: Commit the jobs admin UI**

```bash
git add frontend/components/jobs frontend/app/(dashboard)/admin/jobs/page.tsx
git commit -m "feat: add jobs admin frontend ui"
```

### Task 5: Build the Candidates Admin Screen and CRUD Flow

**Files:**
- Create: `frontend/components/candidates/candidate-form.tsx`
- Create: `frontend/components/candidates/candidate-list.tsx`
- Create: `frontend/components/candidates/candidate-admin-client.tsx`
- Create: `frontend/app/(dashboard)/admin/candidates/page.tsx`

- [ ] **Step 1: Create the candidate form component**

```tsx
"use client";

import { useEffect, useState } from "react";

import type { Candidate, CandidateInput } from "@/lib/api";

const defaultValues: CandidateInput = {
  full_name: "",
  email: "",
  resume_text: "",
  skills_text: "",
  status: "new",
};

export function CandidateForm({
  mode,
  initialValue,
  isSubmitting,
  error,
  onSubmit,
}: {
  mode: "create" | "edit";
  initialValue: Candidate | null;
  isSubmitting: boolean;
  error: string | null;
  onSubmit: (payload: CandidateInput) => Promise<void>;
}) {
  const [values, setValues] = useState<CandidateInput>(defaultValues);

  useEffect(() => {
    if (mode === "edit" && initialValue) {
      setValues({
        full_name: initialValue.full_name,
        email: initialValue.email,
        resume_text: initialValue.resume_text,
        skills_text: initialValue.skills_text,
        status: initialValue.status,
      });
      return;
    }

    setValues(defaultValues);
  }, [initialValue, mode]);

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(values);
      }}
    >
      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">Full Name</label>
        <input
          value={values.full_name}
          onChange={(event) =>
            setValues((current) => ({ ...current, full_name: event.target.value }))
          }
          className="w-full rounded-[12px] border border-[var(--color-border)] px-4 py-3 text-sm"
          required
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">Email</label>
        <input
          value={values.email ?? ""}
          onChange={(event) => setValues((current) => ({ ...current, email: event.target.value }))}
          className="w-full rounded-[12px] border border-[var(--color-border)] px-4 py-3 text-sm"
          type="email"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">Resume Text</label>
        <textarea
          value={values.resume_text ?? ""}
          onChange={(event) =>
            setValues((current) => ({ ...current, resume_text: event.target.value }))
          }
          className="min-h-[120px] w-full rounded-[12px] border border-[var(--color-border)] px-4 py-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">Skills Text</label>
        <textarea
          value={values.skills_text ?? ""}
          onChange={(event) =>
            setValues((current) => ({ ...current, skills_text: event.target.value }))
          }
          className="min-h-[120px] w-full rounded-[12px] border border-[var(--color-border)] px-4 py-3 text-sm"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-[var(--color-text)]">Status</label>
        <select
          value={values.status}
          onChange={(event) => setValues((current) => ({ ...current, status: event.target.value }))}
          className="w-full rounded-[12px] border border-[var(--color-border)] px-4 py-3 text-sm"
        >
          <option value="new">new</option>
          <option value="reviewed">reviewed</option>
          <option value="matched">matched</option>
        </select>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-[12px] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {isSubmitting
          ? "Saving..."
          : mode === "create"
            ? "Create Candidate"
            : "Update Candidate"}
      </button>
    </form>
  );
}
```

- [ ] **Step 2: Create the candidate list component**

```tsx
"use client";

import type { Candidate } from "@/lib/api";

export function CandidateList({
  candidates,
  onEdit,
  onDelete,
}: {
  candidates: Candidate[];
  onEdit: (candidate: Candidate) => void;
  onDelete: (candidate: Candidate) => void;
}) {
  return (
    <div className="grid gap-5">
      {candidates.map((candidate) => (
        <article
          key={candidate.id}
          className="rounded-[20px] border border-[var(--color-border)] bg-white p-6 shadow-micro"
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
                {candidate.status}
              </p>
              <h3 className="mt-3 text-xl font-semibold text-[var(--color-text)]">
                {candidate.full_name}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[var(--color-muted)]">
                {candidate.email ?? "Email not provided"}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onEdit(candidate)}
                className="rounded-[12px] border border-[var(--color-border)] px-4 py-2 text-sm font-medium"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => onDelete(candidate)}
                className="rounded-[12px] bg-[rgba(113,50,245,0.12)] px-4 py-2 text-sm font-medium text-[var(--color-brand-dark)]"
              >
                Delete
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create the candidates admin client container**

```tsx
"use client";

import { useEffect, useState } from "react";

import { CandidateForm } from "@/components/candidates/candidate-form";
import { CandidateList } from "@/components/candidates/candidate-list";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DrawerPanel } from "@/components/drawer-panel";
import { PageHeader } from "@/components/page-header";
import { StateCard } from "@/components/state-card";
import {
  createCandidate,
  deleteCandidate,
  getCandidates,
  type Candidate,
  type CandidateInput,
  updateCandidate,
} from "@/lib/api";

export function CandidateAdminClient() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selectedCandidate, setSelectedCandidate] = useState<Candidate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);

  async function loadCandidates() {
    setLoading(true);
    setError(null);
    try {
      const data = await getCandidates();
      setCandidates(data);
    } catch {
      setError("Failed to load candidates.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCandidates();
  }, []);

  async function handleSubmit(payload: CandidateInput) {
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      if (mode === "create") {
        await createCandidate(payload);
      } else if (selectedCandidate) {
        await updateCandidate(selectedCandidate.id, payload);
      }

      setDrawerOpen(false);
      setSelectedCandidate(null);
      await loadCandidates();
    } catch {
      setSubmitError("Failed to save candidate.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) {
      return;
    }

    try {
      await deleteCandidate(deleteTarget.id);
      setDeleteTarget(null);
      await loadCandidates();
    } catch {
      setError("Failed to delete candidate.");
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Administration"
        title="Manage Candidates"
        description="Create, edit, and remove candidate records from the PostgreSQL-backed workspace."
        action={
          <button
            type="button"
            onClick={() => {
              setMode("create");
              setSelectedCandidate(null);
              setSubmitError(null);
              setDrawerOpen(true);
            }}
            className="rounded-[12px] bg-[var(--color-brand)] px-5 py-3 text-sm font-semibold text-white"
          >
            Create Candidate
          </button>
        }
      />

      {loading ? (
        <StateCard
          title="Loading candidates"
          description="Fetching the latest persisted candidate records."
        />
      ) : error ? (
        <StateCard title="Unable to load candidates" description={error} />
      ) : candidates.length === 0 ? (
        <StateCard
          title="No candidates yet"
          description="Start by creating the first candidate record for this workspace."
        />
      ) : (
        <CandidateList
          candidates={candidates}
          onEdit={(candidate) => {
            setMode("edit");
            setSelectedCandidate(candidate);
            setSubmitError(null);
            setDrawerOpen(true);
          }}
          onDelete={(candidate) => setDeleteTarget(candidate)}
        />
      )}

      <DrawerPanel
        open={drawerOpen}
        title={mode === "create" ? "Create Candidate" : "Edit Candidate"}
        onClose={() => {
          setDrawerOpen(false);
          setSelectedCandidate(null);
        }}
      >
        <CandidateForm
          mode={mode}
          initialValue={selectedCandidate}
          isSubmitting={isSubmitting}
          error={submitError}
          onSubmit={handleSubmit}
        />
      </DrawerPanel>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete candidate?"
        description="This action will permanently remove the selected candidate record."
        confirmLabel="Delete Candidate"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          void handleDelete();
        }}
      />
    </div>
  );
}
```

- [ ] **Step 4: Create the candidates admin route**

```tsx
import { CandidateAdminClient } from "@/components/candidates/candidate-admin-client";

export default function AdminCandidatesPage() {
  return <CandidateAdminClient />;
}
```

- [ ] **Step 5: Verify the candidates admin files**

Run: `sed -n '1,360p' frontend/components/candidates/candidate-form.tsx frontend/components/candidates/candidate-list.tsx frontend/components/candidates/candidate-admin-client.tsx frontend/app/(dashboard)/admin/candidates/page.tsx`
Expected: candidates admin supports create/edit/delete with drawer, confirm dialog, and list refresh behavior

- [ ] **Step 6: Commit the candidates admin UI**

```bash
git add frontend/components/candidates frontend/app/(dashboard)/admin/candidates/page.tsx
git commit -m "feat: add candidates admin frontend ui"
```

### Task 6: Run End-to-End Frontend CRUD Verification

**Files:**
- Verify: running Docker services
- Verify: frontend routes and backend mutation flow

- [ ] **Step 1: Rebuild and start the stack**

Run: `make up`
Expected: frontend, backend, PostgreSQL, and Neo4j are running without crash loops

- [ ] **Step 2: Ensure migrations are applied**

Run: `make migrate`
Expected: database stays at Alembic head so admin pages can operate on ready tables

- [ ] **Step 3: Verify route navigation**

Run: `curl -I http://localhost:3000`
Expected: overview route returns HTTP `200`

Run: `curl -I http://localhost:3000/admin/jobs`
Expected: jobs admin route returns HTTP `200`

Run: `curl -I http://localhost:3000/admin/candidates`
Expected: candidates admin route returns HTTP `200`

- [ ] **Step 4: Verify overview shell content**

Run: `curl -s http://localhost:3000 | rg 'Overview|Admin Jobs|Admin Candidates'`
Expected: the HTML includes sidebar navigation labels

- [ ] **Step 5: Verify jobs UI after creating a record through the frontend form flow**

Use the browser manually or equivalent HTTP interactions to create a job from `/admin/jobs`.
Expected: the created job appears in the list without leaving the route

- [ ] **Step 6: Verify jobs edit flow**

Edit the created job from `/admin/jobs`.
Expected: the updated values appear in the list after save

- [ ] **Step 7: Verify jobs delete flow**

Delete the created job from `/admin/jobs`.
Expected: the confirmation dialog appears and the item disappears after confirmation

- [ ] **Step 8: Verify candidates create/edit/delete flow**

Repeat the same browser flow on `/admin/candidates`.
Expected: candidate create, edit, and delete all succeed and the list refreshes correctly

- [ ] **Step 9: Verify empty, loading, and error states do not break layout**

Run: `curl -s http://localhost:3000/admin/jobs`
Expected: HTML renders structured empty or populated content without server crashes

Run: `curl -s http://localhost:3000/admin/candidates`
Expected: HTML renders structured empty or populated content without server crashes

- [ ] **Step 10: Commit final frontend CRUD UI adjustments**

```bash
git add .
git commit -m "feat: add frontend CRUD admin workspace"
```
