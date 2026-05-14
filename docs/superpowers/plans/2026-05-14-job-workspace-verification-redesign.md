# Job Workspace Verification Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the `jobs/[jobId]` candidate workspace so verification is presented in ranked/rejected outcome sections with recruiter-friendly scorecards and compact evidence, while `Imported Candidates` becomes a minimal ingest monitor.

**Architecture:** Keep the existing expandable list workflow, but refactor the detail content in `frontend/components/jobs/job-candidate-panel.tsx` into decision-first verification blocks. Reuse existing payload fields from the API, derive link counts and chart segments in the frontend, and keep the redesign frontend-only.

**Tech Stack:** Next.js 15, React client components, TypeScript, existing local UI primitives, existing candidate ranking API payloads

---

## File Structure

- Modify: `frontend/components/jobs/job-candidate-panel.tsx`
  - Add verification-derived helpers
  - Replace raw evidence text blocks with recruiter-facing visual summaries
  - Strip verification interpretation from imported candidate detail
- Modify: `frontend/components/jobs/candidate-list-item.tsx`
  - Adjust compact row rendering only if needed for new scorecard density
- Verify: `frontend/lib/api.ts`
  - Confirm current types already expose the fields needed for the redesign

No backend files should change in this plan.

### Task 1: Add Verification View Helpers

**Files:**
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`
- Verify: `frontend/lib/api.ts`

- [ ] **Step 1: Confirm the available verified link payload fields**

Inspect the existing types and helper usage:

```bash
rg -n "verified_links_json|claim_match_status|claim_match_score|RelatedCandidatesPayload|GraphScoringSummary|SkillGapAnalysis" frontend/components/jobs/job-candidate-panel.tsx frontend/lib/api.ts
```

Expected: existing fields cover matched/mismatch/unreachable summaries without backend changes.

- [ ] **Step 2: Add compact frontend helpers for verification metrics**

Add helper functions near `readVerifiedLinks(...)` in `frontend/components/jobs/job-candidate-panel.tsx`:

```ts
function buildVerificationMetrics(
  verifiedLinks: ReturnType<typeof readVerifiedLinks>,
) {
  const matched = verifiedLinks.filter((link) => link.claim_match_status === "matched").length;
  const mismatched = verifiedLinks.filter((link) => link.claim_match_status === "mismatch").length;
  const unreachable = verifiedLinks.filter((link) => link.claim_match_status == null).length;

  return {
    matched,
    mismatched,
    unreachable,
    issueCount: mismatched + unreachable,
    total: verifiedLinks.length,
  };
}

function formatVerificationStatus(status?: string | null) {
  if (!status) {
    return "Pending";
  }

  const mapping: Record<string, string> = {
    verified: "Verified",
    weak_evidence: "Weak Evidence",
    invalid_link: "Invalid Link",
    missing_evidence: "Missing Evidence",
  };

  return mapping[status] ?? status.replaceAll("_", " ");
}
```
```

- [ ] **Step 3: Add compact verification chart helpers**

Add a segment width helper and tone mapping in `frontend/components/jobs/job-candidate-panel.tsx`:

```ts
function getVerificationSegments(
  metrics: ReturnType<typeof buildVerificationMetrics>,
) {
  if (metrics.total === 0) {
    return [];
  }

  return [
    {
      key: "matched",
      value: metrics.matched,
      className: "bg-emerald-500",
    },
    {
      key: "mismatched",
      value: metrics.mismatched,
      className: "bg-amber-500",
    },
    {
      key: "unreachable",
      value: metrics.unreachable,
      className: "bg-rose-500",
    },
  ].filter((segment) => segment.value > 0);
}
```
```

- [ ] **Step 4: Run type/build smoke check for helpers**

Run:

```bash
docker compose exec frontend npm run build
```

Expected: PASS. No TypeScript errors from the new helper signatures.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/jobs/job-candidate-panel.tsx
git commit -m "feat: add verification ui helpers"
```

### Task 2: Replace Raw Verification Dumps With Scorecard + Mini Chart

**Files:**
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`

- [ ] **Step 1: Write the visual block renderer for verification overview**

Add a reusable renderer in `frontend/components/jobs/job-candidate-panel.tsx`:

```tsx
function renderVerificationOverview({
  status,
  score,
  verifiedLinks,
}: {
  status?: string | null;
  score?: number | null;
  verifiedLinks: ReturnType<typeof readVerifiedLinks>;
}) {
  const metrics = buildVerificationMetrics(verifiedLinks);
  const segments = getVerificationSegments(metrics);

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200/70 bg-white/80 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
        Verification Overview
      </p>

      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{formatVerificationStatus(status)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Score</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{score ?? "N/A"}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Matched Links</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{metrics.matched}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 px-3 py-2">
          <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Issue Links</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{metrics.issueCount}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-slate-200">
          <div className="flex h-full w-full">
            {segments.map((segment) => (
              <div
                key={segment.key}
                className={segment.className}
                style={{ width: `${(segment.value / metrics.total) * 100}%` }}
              />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
          <span>Matched {metrics.matched}</span>
          <span>Mismatch {metrics.mismatched}</span>
          <span>Unreachable {metrics.unreachable}</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `renderVerifiedLinks(...)` with compact evidence rows**

Refactor `renderVerifiedLinks(...)` to remove long excerpts and repeated text. Replace the body with a compact row list:

```tsx
return (
  <div className="rounded-[14px] border border-[var(--color-border)] bg-[rgba(148,151,169,0.05)] px-4 py-3">
    <p className="font-medium text-[var(--color-text)]">{title}</p>
    <div className="mt-2 space-y-2">
      {verifiedLinks.map((link, index) => (
        <div
          key={`${link.final_url ?? link.url ?? title}-${index}`}
          className="rounded-2xl border border-slate-200 bg-white px-3 py-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {link.claim_title ?? link.fetched_title ?? "Project link"}
              </p>
              <p className="text-xs text-slate-500">
                {link.final_url ?? link.url ?? "No URL available"}
              </p>
            </div>
            <span className="rounded-full bg-slate-200/90 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
              {link.claim_match_status ?? "unchecked"} · {link.claim_match_score ?? "N/A"}
            </span>
          </div>
          {Array.isArray(link.matched_terms) && link.matched_terms.length > 0 ? (
            <div className="mt-2">
              {renderSkillChips(link.matched_terms.slice(0, 5), "bg-slate-200/80 text-slate-700")}
            </div>
          ) : null}
          {link.mismatch_notes ? (
            <p className="mt-2 text-xs leading-5 text-rose-700">{link.mismatch_notes}</p>
          ) : null}
        </div>
      ))}
    </div>
  </div>
);
```

- [ ] **Step 3: Insert `Verification Overview` into ranked candidate detail**

Inside the ranked candidate `detail` block in `frontend/components/jobs/job-candidate-panel.tsx`, add:

```tsx
{renderVerificationOverview({
  status: candidate.verification_status,
  score: candidate.verification_score,
  verifiedLinks,
})}
```

Place it before `Graph Explanation`.

- [ ] **Step 4: Insert `Verification Overview` into rejected candidate detail**

Inside the rejected candidate `detail` block in `frontend/components/jobs/job-candidate-panel.tsx`, add the same `renderVerificationOverview(...)` call before evidence details.

- [ ] **Step 5: Run build verification**

Run:

```bash
docker compose exec frontend npm run build
```

Expected: PASS. Ranked/rejected detail still compile cleanly.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/jobs/job-candidate-panel.tsx
git commit -m "feat: add verification scorecards and compact evidence rows"
```

### Task 3: Compress Ranked And Rejected Decision Detail

**Files:**
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`

- [ ] **Step 1: Replace long strengths/gaps paragraphs with compact blocks**

In the ranked candidate detail block, replace:

```tsx
<p>Strengths: {report?.strengths?.join(", ") || "None"}</p>
<p>Gaps: {report?.gaps?.join(", ") || "None"}</p>
```

with:

```tsx
<div className="space-y-2 rounded-2xl border border-slate-200/70 bg-white/80 p-3">
  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
    Decision Summary
  </p>
  <div className="space-y-1.5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
      Top Strengths
    </p>
    {renderSkillChips(report?.strengths ?? [], "bg-emerald-100 text-emerald-700", "No strengths captured.")}
  </div>
  <div className="space-y-1.5">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
      Key Gaps
    </p>
    {renderSkillChips(report?.gaps ?? [], "bg-amber-100 text-amber-700", "No gaps captured.")}
  </div>
  {typeof report?.critic_review === "string" ? (
    <p className="text-xs leading-5 text-slate-600">{report.critic_review}</p>
  ) : null}
</div>
```

- [ ] **Step 2: Add a rejection-focused summary block**

Inside the rejected candidate detail, insert:

```tsx
<div className="space-y-2 rounded-2xl border border-slate-200/70 bg-white/80 p-3">
  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
    Why Rejected
  </p>
  <p className="text-xs leading-5 text-slate-700">
    {candidate.screening_reason ?? candidate.verification_summary ?? "Rejected by verification policy."}
  </p>
</div>
```

- [ ] **Step 3: Keep graph-specific blocks only in ranked candidates**

Verify the rejected section does not render:

- `Graph Explanation`
- `Skill Gap Analysis`
- `Next-Best Candidates`
- `Related Jobs`

Expected: rejection detail stays focused on verification outcome.

- [ ] **Step 4: Run route build check**

Run:

```bash
docker compose exec frontend npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/jobs/job-candidate-panel.tsx
git commit -m "feat: compress ranked and rejected decision detail"
```

### Task 4: Reduce Imported Candidates To Minimal Ingest View

**Files:**
- Modify: `frontend/components/jobs/job-candidate-panel.tsx`

- [ ] **Step 1: Remove verification and match interpretation from imported candidate summary**

In the imported candidate row, replace:

```tsx
summary={candidate.match_summary ?? candidate.verification_summary ?? statusSummary}
```

with:

```tsx
summary={statusSummary}
```

- [ ] **Step 2: Remove verification and verified links from imported candidate detail**

Delete these blocks from the imported candidate detail:

```tsx
{candidate.verification_summary ? (
  <p>Verification: {candidate.verification_summary}</p>
) : null}
{candidate.match_summary ? (
  <p>Match: {candidate.match_summary}</p>
) : null}
{renderVerifiedLinks(verifiedLinks, "Verified Links")}
```

Also remove the now-unused `verifiedLinks` local in this imported section if no longer needed.

- [ ] **Step 3: Tighten the operational detail copy**

Keep only:

- status summary
- technical skills
- cloud skills
- tooling
- evidence snippet
- delete action

No recruiter-facing decision language should remain here.

- [ ] **Step 4: Run build verification**

Run:

```bash
docker compose exec frontend npm run build
```

Expected: PASS. Imported candidates still render and compile.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/jobs/job-candidate-panel.tsx
git commit -m "feat: simplify imported candidates to ingest-only view"
```

### Task 5: Final Visual Verification And Demo Smoke Check

**Files:**
- Verify: `frontend/components/jobs/job-candidate-panel.tsx`
- Verify: `frontend/components/jobs/candidate-list-item.tsx`

- [ ] **Step 1: Run frontend production build**

Run:

```bash
docker compose exec frontend npm run build
```

Expected: PASS. `/jobs/[jobId]` bundle compiles.

- [ ] **Step 2: Check the job route returns successfully**

Run:

```bash
curl -I http://localhost:3000/jobs/21
```

Expected: `HTTP/1.1 200 OK`

- [ ] **Step 3: Manually verify the intended UX on job 21**

Open `http://localhost:3000/jobs/21` and confirm:

- `Imported Candidates` shows only ingest/operational information
- ranked candidate detail shows:
  - `Verification Overview`
  - compact evidence rows
  - compressed `Decision Summary`
  - `Graph Explanation`
  - `Skill Gap Analysis`
  - `Next-Best Candidates`
  - `Related Jobs`
- rejected candidate detail shows:
  - `Verification Overview`
  - `Why Rejected`
  - compact `Evidence Issues`
- no raw excerpt dump dominates the screen

- [ ] **Step 4: Commit final UI polish if any micro-adjustments were needed**

```bash
git add frontend/components/jobs/job-candidate-panel.tsx frontend/components/jobs/candidate-list-item.tsx
git commit -m "feat: finalize recruiter-facing verification redesign"
```

## Spec Coverage Check

- `Imported Candidates` minimal ingest monitor: covered by Task 4
- verification moved to ranked/rejected outcome sections: covered by Task 2 and Task 3
- scorecard + mini chart: covered by Task 2
- compact evidence rows instead of raw dumps: covered by Task 2
- compressed ranked/rejected wording: covered by Task 3
- frontend-only scope: all tasks touch frontend files only

## Placeholder Scan

No TODO/TBD placeholders remain. Every task includes exact files, commands, and concrete code snippets.

## Type Consistency Check

- `verified_links_json` is read through existing `readVerifiedLinks(...)`
- verification UI helpers consume the same shape already used by the component
- no new API fields are introduced

