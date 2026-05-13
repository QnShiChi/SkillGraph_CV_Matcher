# Job Workspace UX Compression Design

## Goal

Reduce default scroll depth on `jobs/[jobId]` by roughly 60-80% while preserving full recruiter and admin access to all job, candidate, verification, and ranking details.

This design targets the two components that currently drive most page height:

- `frontend/components/jobs/job-structured-data.tsx`
- `frontend/components/jobs/job-candidate-panel.tsx`

The page should become summary-first:

- most important information visible immediately
- secondary detail revealed on demand
- no data removed from the workflow
- open/closed UI state preserved during the session

## Current Problems

1. `JobStructuredData` renders the full normalized JD, raw JD text, all skill groups, soft skills, and metadata in one long vertical flow.
2. `JobCandidatePanel` renders imported, ranked, and rejected candidates as fully expanded cards by default.
3. The same candidate details appear in multiple sections, multiplying vertical space usage.
4. HR users must scroll past large amounts of detail before reaching the ranking outcome that matters most.
5. The current layout optimizes for exhaustiveness, not scanning speed.

## UX Principles

1. Default view should answer: what is this job, how many candidates were screened, who passed, who failed, and who ranks highest.
2. Full detail must remain accessible within one click.
3. Sections that primarily support audit/debug workflows should start collapsed.
4. The UI should distinguish primary HR reading flow from secondary admin/debug detail.
5. State should feel stable across refreshes within the same browser session.

## Recommended Approach

Use a hybrid pattern:

- tabs for top-level job data navigation
- accordions for skill and metadata sections
- compact expandable rows for candidate lists

This approach fits the existing codebase best because it preserves current data sources and card styling while substantially reducing default height.

## Information Architecture

### Job Workspace Header

Keep the existing job title and back button.

Compress the workspace status line into compact status chips instead of a long descriptive sentence. The metadata row should surface:

- source type
- extract source
- parse status
- parse engine
- confidence
- graph sync status
- job status

This allows the existing `Workspace Status` card to remain visible with less vertical space.

### Structured Job Data

Replace the current two-column always-open layout with a tabbed container.

Top-level tabs:

1. `JD View`
2. `Skills & Competencies`
3. `Metadata`

#### Tab: JD View

Purpose:
- support recruiter reading of the job content itself

Sub-toggle within the tab:

- `Normalized JD`
- `Raw JD`

`Normalized JD` shows:

- Summary
- Required Skills
- Responsibilities
- Qualifications

Each text block should support a compact mode:

- default clamp to a reasonable preview height
- `Show more` expands the full block
- `Show less` collapses it again

`Raw JD` shows the original extracted text in a scrollable panel. It should not render at the same time as the normalized view.

#### Tab: Skills & Competencies

Purpose:
- preserve graph-oriented skill detail while preventing a long stack of open cards

Each skill group becomes a reusable collapsible section:

- Technical Skills `(N)`
- Cloud & Platforms `(N)`
- Tooling & DevOps `(N)`
- Competencies `(N)`
- Role Descriptors `(N)`
- Soft Skills `(N)`

Default state:

- `Technical Skills` open
- all other groups closed

Within each group:

- if count is small, render all cards
- if count is large, render the first 6 cards and a `Show all N` action

Graph-detail-heavy groups keep canonical, importance, confidence, groups, prerequisites, and related skills.
Non-graph groups keep the existing lighter presentation.

#### Tab: Metadata

Purpose:
- keep operational detail available without consuming default reading space

This tab contains:

- source type
- source file
- extract source
- parse status/source/confidence
- graph sync state and timestamp
- graph sync error if present
- skill groups
- inferred experience years
- optional structured counts such as number of technical skills, responsibilities, and qualifications

## Candidate Area

Reorder the mental flow, not necessarily the DOM order:

1. Candidate Import
2. Verification & Ranking summary
3. Ranked Candidates
4. Rejected By Verification
5. Imported Candidates

The import and ranking summary cards can remain mostly as-is because they are already compact and useful.

The high-impact change is to convert all candidate collections into compact list rows with inline expansion.

### Ranked Candidates

This is the primary HR section and should remain visible by default.

Default section state:

- expanded

Each row should show only:

- rank
- candidate name
- match score
- verification score
- pass badge
- one-line summary or truncated explanation
- expand/collapse control

Expanded detail shows:

- explanation
- strengths
- gaps
- project verification block
- critic review

This preserves current ranking detail but only for candidates the user explicitly opens.

### Rejected By Verification

This is important for auditability but secondary to ranked outcomes.

Default section state:

- collapsed

Section header should show the count:

- `Rejected By Verification (N)`

Each collapsed row should show:

- candidate name
- verification status
- screening reason
- expand control

Expanded detail shows:

- verification summary
- verified/fetched link information
- fetched title
- excerpt
- matched terms
- mismatch notes

### Imported Candidates

This is useful for admin review and deletion, but it duplicates much of the information surfaced elsewhere.

Default section state:

- collapsed

Section header should show the count:

- `Imported Candidates (N)`

Each row should show:

- initials/avatar placeholder
- candidate name
- parse source
- confidence
- graph sync status
- screening decision or pending status
- rank or rejected state
- expand control

Expanded detail shows:

- technical skills
- cloud skills
- tooling skills
- verification summary
- match summary
- top evidence
- verified link details
- delete action

## Reusable Components

### `CollapsibleSection.tsx`

Reusable accordion-style wrapper for:

- skill groups in `JobStructuredData`
- candidate collections in `JobCandidatePanel`

Responsibilities:

- render title, optional count badge, optional description
- manage open/closed state via controlled props
- support compact transitions

### `CandidateListItem.tsx`

Reusable expandable row for:

- imported candidates
- ranked candidates
- rejected candidates

Responsibilities:

- render compact summary row
- render detail body when expanded
- support variant styling for `ranked`, `rejected`, and `imported`

This avoids repeating card markup across three candidate sections.

## State Persistence

Persist UI state in `sessionStorage` keyed by `jobId`.

State to persist:

- active top-level tab in `JobStructuredData`
- active sub-view for `JD View` (`Normalized JD` or `Raw JD`)
- open/closed state of skill sections
- open/closed state of candidate collections
- expanded candidate row ids for each section

Suggested keys:

- `job-workspace:{jobId}:structured-tab`
- `job-workspace:{jobId}:jd-view-mode`
- `job-workspace:{jobId}:open-skill-sections`
- `job-workspace:{jobId}:open-candidate-sections`
- `job-workspace:{jobId}:expanded-ranked-candidates`
- `job-workspace:{jobId}:expanded-rejected-candidates`
- `job-workspace:{jobId}:expanded-imported-candidates`

If any stored state is invalid, fall back to the default view model rather than failing open.

## Interaction Defaults

These defaults optimize for minimal scroll while keeping HR-focused information visible:

- `JD View` tab active on first load
- `Normalized JD` active inside `JD View`
- `Technical Skills` open
- all other skill groups closed
- `Ranked Candidates` section open
- `Rejected By Verification` section closed
- `Imported Candidates` section closed
- all candidate rows collapsed initially

## Responsive Behavior

Desktop:

- keep the current wide workspace feel
- tabs and compact rows reduce vertical space

Mobile/tablet:

- tabs remain stacked horizontally with scroll if needed
- candidate rows remain one-column summaries
- expanded detail appears inline below the selected row

The design should avoid introducing side-by-side master-detail behavior because it would complicate mobile behavior more than needed for this iteration.

## Accessibility and Usability

1. Every expandable item must have a visible button target, not only clickable text.
2. Expanded/collapsed state should be conveyed via `aria-expanded`.
3. Keyboard users must be able to operate tabs and accordions.
4. Truncated text must always have a discoverable expansion control.
5. Counts in section headers should help users scan without opening each block.

## Error Handling

1. If `rankingResult` is null, render section shells with appropriate empty states instead of hiding the structure entirely.
2. If a structured data group is empty, keep the section but show a compact empty-state line.
3. If persisted UI state references missing candidates after a refresh, drop those ids silently.

## Testing Scope

### Component Behavior

- tabs switch correctly
- section collapse/expand works
- candidate row detail toggles correctly
- session state restores correctly on reload

### Content Preservation

- all previously visible fields remain accessible after interaction
- no ranking/verifier detail is lost
- delete action remains available from imported candidates

### Layout Validation

- default page height is materially lower than before
- ranked candidates are visible without needing to scroll through imported and rejected full cards
- long job descriptions remain readable after expansion

## Implementation Boundaries

This design intentionally does not include:

- virtualization libraries
- route-level redesign
- modal detail views
- server-side persistence of UI state
- database or API schema changes

Those are unnecessary for the first UX compression pass.

## Recommended Implementation Order

1. Add reusable collapsible primitives
2. Refactor `JobStructuredData` into tabs + collapsible skill sections
3. Refactor ranked/rejected/imported candidates into expandable rows
4. Add session persistence
5. Add transition polish and spacing cleanup

## Expected Outcome

After implementation, the default view of `jobs/[jobId]` should:

- surface the JD summary and primary technical skills quickly
- show ranking results without forcing the user through large candidate cards
- keep rejected and imported audit detail available but out of the way
- preserve all existing information through progressive disclosure

This should reduce effective default scroll depth from the current multi-screen vertical stack to a compact summary view while keeping the page suitable for both HR reading and admin verification.
