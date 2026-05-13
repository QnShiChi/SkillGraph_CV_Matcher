# Job Workspace UX Compression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress the default `jobs/[jobId]` workspace view so HR sees the job summary, ranking outcome, and key candidate status with far less scrolling while preserving access to all current detail.

**Architecture:** Refactor the page into progressive-disclosure UI. `JobStructuredData` becomes a tabbed container with collapsible skill groups, while `JobCandidatePanel` becomes a summary-first panel with expandable rows for ranked, rejected, and imported candidates. Session-scoped UI state is stored in `sessionStorage` and keyed by `jobId`.

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind utility classes, existing `StateCard` and drawer/dialog components, browser `sessionStorage`.

---

## File Map

### Create

- `frontend/components/ui/collapsible-section.tsx`
  Reusable accordion-style section wrapper with controlled open state.
- `frontend/components/jobs/candidate-list-item.tsx`
  Reusable expandable row used by ranked, rejected, and imported candidate collections.
- `frontend/lib/job-workspace-ui-state.ts`
  Session storage helpers for tabs, open sections, and expanded candidate ids.

### Modify

- `frontend/components/jobs/job-structured-data.tsx`
  Replace always-open stacked sections with tabs, compact text blocks, and collapsible skill groups.
- `frontend/components/jobs/job-candidate-panel.tsx`
  Replace large default-open cards with compact summary rows and collapsible collection sections.
- `frontend/components/jobs/job-workspace.tsx`
  Optional minor metadata chip compaction if needed after component changes.
- `docs/superpowers/specs/2026-05-13-job-workspace-ux-design.md`
  Update only if implementation decisions force a small documented deviation.

### Verify

- `docker compose exec frontend npm run build`
- Manual QA in `http://localhost:3000/jobs/21`

---

### Task 1: Add Reusable Collapsible Primitives

**Files:**
- Create: `frontend/components/ui/collapsible-section.tsx`
- Create: `frontend/components/jobs/candidate-list-item.tsx`
- Verify: `docker compose exec frontend npm run build`

- [ ] **Step 1: Create the collapsible section wrapper**

Add a focused wrapper that standardizes headers, counts, and expand/collapse behavior.

```tsx
"use client";

import type { ReactNode } from "react";

type CollapsibleSectionProps = {
  title: string;
  description?: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
  defaultOpenLabel?: string;
};

export function CollapsibleSection({
  title,
  description,
  count,
  open,
  onToggle,
  children,
}: CollapsibleSectionProps) {
  return (
    <section className="rounded-[20px] border border-[var(--color-border)] bg-white/90">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left"
      >
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-[var(--color-text)]">{title}</h2>
            {typeof count === "number" ? (
              <span className="rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-brand-dark)]">
                {count}
              </span>
            ) : null}
          </div>
          {description ? (
            <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{description}</p>
          ) : null}
        </div>
        <span className="text-sm font-medium text-[var(--color-brand-dark)]">
          {open ? "Collapse" : "Expand"}
        </span>
      </button>
      {open ? <div className="border-t border-[var(--color-border)] px-5 py-4">{children}</div> : null}
    </section>
  );
}
```

- [ ] **Step 2: Create the reusable candidate row shell**

Build one expandable row component instead of repeating three article variants in `job-candidate-panel.tsx`.

```tsx
"use client";

import type { ReactNode } from "react";

type CandidateListItemProps = {
  title: string;
  subtitle: string;
  badges?: ReactNode;
  summary?: string;
  open: boolean;
  onToggle: () => void;
  detail: ReactNode;
  tone?: "default" | "success" | "danger";
};

export function CandidateListItem({
  title,
  subtitle,
  badges,
  summary,
  open,
  onToggle,
  detail,
  tone = "default",
}: CandidateListItemProps) {
  const toneClass =
    tone === "danger"
      ? "border-[rgba(183,54,54,0.18)] bg-[rgba(183,54,54,0.05)]"
      : "border-[var(--color-border)] bg-white/90";

  return (
    <article className={`rounded-[18px] border ${toneClass}`}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left"
      >
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-[var(--color-text)]">{title}</h3>
          <p className="mt-1 text-sm text-[var(--color-muted)]">{subtitle}</p>
          {summary ? <p className="mt-2 text-sm leading-6 text-[var(--color-muted)]">{summary}</p> : null}
        </div>
        <div className="flex items-center gap-3">
          {badges}
          <span className="text-sm font-medium text-[var(--color-brand-dark)]">
            {open ? "Hide" : "Show"}
          </span>
        </div>
      </button>
      {open ? <div className="border-t border-[var(--color-border)] px-4 py-4">{detail}</div> : null}
    </article>
  );
}
```

- [ ] **Step 3: Run a build to verify the new primitives compile**

Run:

```bash
docker compose exec frontend npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 4: Commit the primitive layer**

```bash
git add frontend/components/ui/collapsible-section.tsx frontend/components/jobs/candidate-list-item.tsx
git commit -m "feat: add job workspace collapsible ui primitives"
```

---

### Task 2: Add Session-Scoped Workspace UI State Helpers

**Files:**
- Create: `frontend/lib/job-workspace-ui-state.ts`
- Modify: `frontend/components/jobs/job-structured-data.tsx`
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`
- Verify: `docker compose exec frontend npm run build`

- [ ] **Step 1: Add small session storage helpers**

Create helpers so both major components use the same storage rules instead of duplicating local `sessionStorage` code.

```ts
export type JobStructuredTab = "jd-view" | "skills" | "metadata";
export type JobTextView = "normalized" | "raw";

function readSessionValue<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") {
    return fallback;
  }

  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeSessionValue<T>(key: string, value: T) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(key, JSON.stringify(value));
}

export function jobWorkspaceKey(jobId: number, suffix: string) {
  return `job-workspace:${jobId}:${suffix}`;
}

export { readSessionValue, writeSessionValue };
```

- [ ] **Step 2: Define the keys used by both page sections**

Extend the helper file with constants/functions for:

```ts
export function structuredTabKey(jobId: number) {
  return jobWorkspaceKey(jobId, "structured-tab");
}

export function jdViewModeKey(jobId: number) {
  return jobWorkspaceKey(jobId, "jd-view-mode");
}

export function openSkillSectionsKey(jobId: number) {
  return jobWorkspaceKey(jobId, "open-skill-sections");
}

export function openCandidateSectionsKey(jobId: number) {
  return jobWorkspaceKey(jobId, "open-candidate-sections");
}

export function expandedCandidateIdsKey(jobId: number, section: string) {
  return jobWorkspaceKey(jobId, `expanded-${section}-candidate-ids`);
}
```

- [ ] **Step 3: Build again before integrating the helpers**

Run:

```bash
docker compose exec frontend npm run build
```

Expected:

```text
Compiled successfully
```

- [ ] **Step 4: Commit the state helper layer**

```bash
git add frontend/lib/job-workspace-ui-state.ts
git commit -m "feat: add job workspace session state helpers"
```

---

### Task 3: Refactor JobStructuredData Into Tabs and Compact Skill Sections

**Files:**
- Modify: `frontend/components/jobs/job-structured-data.tsx`
- Reuse: `frontend/components/ui/collapsible-section.tsx`
- Reuse: `frontend/lib/job-workspace-ui-state.ts`
- Verify: `docker compose exec frontend npm run build`

- [ ] **Step 1: Convert the component to client-side stateful UI**

Replace the current static render with a client component that tracks:

- active top-level tab
- active JD sub-view
- open skill sections
- expanded text blocks

Start the file with:

```tsx
"use client";

import { useEffect, useState } from "react";

import { CollapsibleSection } from "@/components/ui/collapsible-section";
import {
  jdViewModeKey,
  openSkillSectionsKey,
  readSessionValue,
  structuredTabKey,
  writeSessionValue,
  type JobStructuredTab,
  type JobTextView,
} from "@/lib/job-workspace-ui-state";
```

- [ ] **Step 2: Add compact text block helpers for long JD content**

Add a helper that clamps long text by default:

```tsx
function ExpandableTextBlock({
  label,
  text,
  expanded,
  onToggle,
}: {
  label: string;
  text: string;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">
        {label}
      </p>
      <div className={expanded ? "mt-2 text-sm leading-7 text-[var(--color-muted)]" : "mt-2 line-clamp-5 text-sm leading-7 text-[var(--color-muted)]"}>
        {text}
      </div>
      <button type="button" onClick={onToggle} className="mt-2 text-sm font-medium text-[var(--color-brand-dark)]">
        {expanded ? "Show less" : "Show more"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Replace the current layout with tab navigation**

Render a tab strip:

```tsx
const tabs: Array<{ id: JobStructuredTab; label: string }> = [
  { id: "jd-view", label: "JD View" },
  { id: "skills", label: "Skills & Competencies" },
  { id: "metadata", label: "Metadata" },
];
```

And render tab buttons:

```tsx
<div className="flex flex-wrap gap-2">
  {tabs.map((tab) => (
    <button
      key={tab.id}
      type="button"
      onClick={() => setActiveTab(tab.id)}
      className={activeTab === tab.id ? "rounded-full bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white" : "rounded-full border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text)]"}
    >
      {tab.label}
    </button>
  ))}
</div>
```

- [ ] **Step 4: Move skill groups into collapsible summary sections**

Replace the always-open `SkillSection` stack with:

```tsx
<CollapsibleSection
  title="Technical Skills"
  description="Core graph-oriented technical skills."
  count={technicalSkills.length}
  open={openSkillSections.includes("technical")}
  onToggle={() => toggleSkillSection("technical")}
>
  <div className="space-y-4">
    {visibleTechnicalSkills.map((skill) => renderSkillCard(skill, true))}
    {technicalSkills.length > visibleTechnicalSkills.length ? (
      <button type="button" onClick={() => setShowAllTechnical(true)} className="text-sm font-medium text-[var(--color-brand-dark)]">
        Show all {technicalSkills.length}
      </button>
    ) : null}
  </div>
</CollapsibleSection>
```

Apply the same pattern to:

- cloud/platforms
- tooling/devops
- competencies
- role descriptors
- soft skills

Default open state:

- `technical`

- [ ] **Step 5: Keep Metadata as a dedicated tab rather than a long card at page bottom**

Move the current metadata lines into the `metadata` tab body:

```tsx
<div className="grid gap-3 md:grid-cols-2">
  <p>Source type: {job.source_type}</p>
  <p>Source file: {job.source_file_name ?? "Manual entry"}</p>
  <p>Extract source: {job.extract_source ?? "Manual entry"}</p>
  <p>Parse source: {job.parse_source}</p>
  <p>Parse confidence: {formatConfidence(job.parse_confidence)}</p>
  <p>Graph sync status: {job.graph_sync_status}</p>
</div>
```

- [ ] **Step 6: Build and manually verify the JD area**

Run:

```bash
docker compose exec frontend npm run build
```

Manual check in browser:

1. Open `http://localhost:3000/jobs/21`
2. Confirm the page now shows tabs
3. Confirm `JD View` is default
4. Confirm only the technical skill section is open inside `Skills & Competencies`
5. Confirm `Raw JD` is not rendered until selected

- [ ] **Step 7: Commit the structured data refactor**

```bash
git add frontend/components/jobs/job-structured-data.tsx frontend/components/ui/collapsible-section.tsx frontend/lib/job-workspace-ui-state.ts
git commit -m "feat: compress structured job data with tabs and accordions"
```

---

### Task 4: Refactor Candidate Collections Into Expandable Summary Rows

**Files:**
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`
- Reuse: `frontend/components/jobs/candidate-list-item.tsx`
- Reuse: `frontend/components/ui/collapsible-section.tsx`
- Reuse: `frontend/lib/job-workspace-ui-state.ts`
- Verify: `docker compose exec frontend npm run build`

- [ ] **Step 1: Add section-level open state for ranked, rejected, and imported candidate groups**

Introduce a section state model:

```tsx
type CandidateSectionKey = "ranked" | "rejected" | "imported";

const [openSections, setOpenSections] = useState<CandidateSectionKey[]>(["ranked"]);

function toggleSection(section: CandidateSectionKey) {
  setOpenSections((current) =>
    current.includes(section)
      ? current.filter((item) => item !== section)
      : [...current, section],
  );
}
```

Default:

- ranked open
- rejected closed
- imported closed

- [ ] **Step 2: Add row-level expanded id state per collection**

Track expanded candidate ids separately:

```tsx
const [expandedRankedIds, setExpandedRankedIds] = useState<number[]>([]);
const [expandedRejectedIds, setExpandedRejectedIds] = useState<number[]>([]);
const [expandedImportedIds, setExpandedImportedIds] = useState<number[]>([]);
```

And togglers:

```tsx
function toggleExpandedId(id: number, setter: React.Dispatch<React.SetStateAction<number[]>>) {
  setter((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));
}
```

- [ ] **Step 3: Replace fully expanded ranked cards with compact candidate rows**

Each ranked row should render:

```tsx
<CandidateListItem
  title={`#${candidate.match_rank} · ${candidate.full_name}`}
  subtitle={`match ${candidate.match_score?.toFixed(2) ?? "N/A"} · verify ${candidate.verification_score?.toFixed(0) ?? "N/A"}`}
  summary={report?.explanation ?? candidate.match_summary ?? undefined}
  open={expandedRankedIds.includes(candidate.id)}
  onToggle={() => toggleExpandedId(candidate.id, setExpandedRankedIds)}
  badges={<span className="rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">pass</span>}
  detail={
    <div className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
      <p>Strengths: {report?.strengths?.join(", ") || "None"}</p>
      <p>Gaps: {report?.gaps?.join(", ") || "None"}</p>
      <p>Critic review: {typeof report?.critic_review === "string" ? report.critic_review : "No review summary."}</p>
      {renderVerifiedLinks(verifiedLinks, "Project Verification")}
    </div>
  }
/>
```

- [ ] **Step 4: Replace rejected and imported candidates with the same row model**

Rejected rows:

```tsx
<CandidateListItem
  tone="danger"
  title={candidate.full_name}
  subtitle={`${candidate.verification_status ?? "unverified"} · ${candidate.screening_reason ?? "Rejected by screening policy."}`}
  summary={candidate.verification_summary ?? undefined}
  open={expandedRejectedIds.includes(candidate.id)}
  onToggle={() => toggleExpandedId(candidate.id, setExpandedRejectedIds)}
  badges={<span className="rounded-full bg-[rgba(183,54,54,0.14)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[#8d2020]">reject</span>}
  detail={<div className="space-y-3">{renderVerifiedLinks(verifiedLinks, "Verification Details")}</div>}
/>
```

Imported rows:

```tsx
<CandidateListItem
  title={candidate.full_name}
  subtitle={`${candidate.extract_source ?? "manual"} · ${candidate.parse_source} · confidence ${formatConfidence(candidate.parse_confidence)}`}
  summary={candidate.match_summary ?? candidate.verification_summary ?? undefined}
  open={expandedImportedIds.includes(candidate.id)}
  onToggle={() => toggleExpandedId(candidate.id, setExpandedImportedIds)}
  badges={<span className="rounded-full bg-[var(--color-brand-subtle)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--color-brand-dark)]">{candidate.status}</span>}
  detail={
    <div className="space-y-3 text-sm leading-6 text-[var(--color-muted)]">
      <p>Technical: {technicalSkills.map((skill) => skill.name).join(", ") || "None"}</p>
      <p>Cloud: {cloudSkills.map((skill) => skill.name).join(", ") || "None"}</p>
      <p>Tooling: {toolingSkills.map((skill) => skill.name).join(", ") || "None"}</p>
      {renderVerifiedLinks(verifiedLinks, "Verified Links")}
      {topEvidence ? <p>Evidence: {topEvidence.text}</p> : null}
      <div className="flex justify-end">
        <button type="button" onClick={() => setDeleteTarget(candidate)} className="rounded-[12px] bg-[#101114] px-4 py-2 text-sm font-medium text-white">
          Delete Candidate
        </button>
      </div>
    </div>
  }
/>
```

- [ ] **Step 5: Wrap each collection in `CollapsibleSection`**

Use:

```tsx
<CollapsibleSection
  title="Ranked Candidates"
  description="Only candidates with verified project evidence appear here."
  count={rankingResult?.ranked_candidates.length ?? 0}
  open={openSections.includes("ranked")}
  onToggle={() => toggleSection("ranked")}
>
  <div className="space-y-3">{/* candidate rows */}</div>
</CollapsibleSection>
```

Repeat for:

- `Rejected By Verification`
- `Imported Candidates`

- [ ] **Step 6: Build and run manual UX QA on candidate flows**

Run:

```bash
docker compose exec frontend npm run build
```

Manual QA:

1. Open `http://localhost:3000/jobs/21`
2. Confirm `Ranked Candidates` is open and `Rejected` / `Imported` are collapsed
3. Expand one row in each section
4. Confirm all prior fields are still accessible
5. Confirm delete button remains available inside imported candidate detail

- [ ] **Step 7: Commit the candidate panel refactor**

```bash
git add frontend/components/jobs/job-candidate-panel.tsx frontend/components/jobs/candidate-list-item.tsx frontend/components/ui/collapsible-section.tsx frontend/lib/job-workspace-ui-state.ts
git commit -m "feat: compress candidate workspace lists with expandable rows"
```

---

### Task 5: Persist Workspace Interaction State and Polish the Default View

**Files:**
- Modify: `frontend/components/jobs/job-structured-data.tsx`
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`
- Modify: `frontend/components/jobs/job-workspace.tsx`
- Verify: `docker compose exec frontend npm run build`

- [ ] **Step 1: Persist job data tab and accordion state**

In `job-structured-data.tsx`, add effects:

```tsx
useEffect(() => {
  setActiveTab(readSessionValue(structuredTabKey(job.id), "jd-view"));
  setJdViewMode(readSessionValue(jdViewModeKey(job.id), "normalized"));
  setOpenSkillSections(readSessionValue(openSkillSectionsKey(job.id), ["technical"]));
}, [job.id]);

useEffect(() => {
  writeSessionValue(structuredTabKey(job.id), activeTab);
}, [job.id, activeTab]);
```

Apply the same pattern for:

- JD sub-view
- open skill sections

- [ ] **Step 2: Persist candidate section and expanded row state**

In `job-candidate-panel.tsx`, read/write:

```tsx
useEffect(() => {
  setOpenSections(readSessionValue(openCandidateSectionsKey(jobId), ["ranked"]));
  setExpandedRankedIds(readSessionValue(expandedCandidateIdsKey(jobId, "ranked"), []));
  setExpandedRejectedIds(readSessionValue(expandedCandidateIdsKey(jobId, "rejected"), []));
  setExpandedImportedIds(readSessionValue(expandedCandidateIdsKey(jobId, "imported"), []));
}, [jobId]);
```

And persist on change:

```tsx
useEffect(() => {
  writeSessionValue(openCandidateSectionsKey(jobId), openSections);
}, [jobId, openSections]);
```

Repeat for each expanded id list.

- [ ] **Step 3: Compact the workspace status presentation if the page still feels tall**

If the default viewport still wastes vertical space, adjust `job-workspace.tsx` to render status chips in a wrap row instead of the current long prose line.

Suggested chip markup:

```tsx
<div className="flex flex-wrap gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-muted)]">
  <span className="rounded-full bg-[rgba(148,151,169,0.08)] px-3 py-2">source: {job.source_type}</span>
  <span className="rounded-full bg-[rgba(148,151,169,0.08)] px-3 py-2">extract: {job.extract_source ?? "manual"}</span>
  <span className="rounded-full bg-[rgba(148,151,169,0.08)] px-3 py-2">parse: {job.parse_status}</span>
  <span className="rounded-full bg-[rgba(148,151,169,0.08)] px-3 py-2">engine: {job.parse_source}</span>
</div>
```

- [ ] **Step 4: Run the final build and full manual QA**

Run:

```bash
docker compose exec frontend npm run build
```

Manual QA:

1. Open `http://localhost:3000/jobs/21`
2. Reload the page after changing tabs and expanding candidate rows
3. Confirm state is restored in-session
4. Confirm the default load shows JD summary + ranking without needing to scroll through every candidate card
5. Confirm all detailed verification and ranking content remains reachable

- [ ] **Step 5: Commit the persistence and polish pass**

```bash
git add frontend/components/jobs/job-structured-data.tsx frontend/components/jobs/job-candidate-panel.tsx frontend/components/jobs/job-workspace.tsx frontend/lib/job-workspace-ui-state.ts
git commit -m "feat: persist compressed job workspace ui state"
```

---

## Spec Coverage Check

- `JobStructuredData` tabbed/collapsible: covered by Task 3
- skill section compaction: covered by Task 3
- candidate list compaction: covered by Task 4
- session persistence: covered by Task 5
- preserving all information: covered by Task 3 and Task 4 detail views
- scroll-depth reduction by default: achieved through Task 3 + Task 4 + optional Task 5 header compaction

No spec gaps remain for the first implementation pass.

## Verification Strategy

Because the repository currently has no frontend test runner configured, this plan uses:

- compile-time verification via `docker compose exec frontend npm run build`
- manual QA on the real route `http://localhost:3000/jobs/21`

If a later iteration introduces frontend tests, the extracted helper components and state utilities created here provide the cleanest test surface.
