# Job Workspace Verification Redesign

## Goal

Redesign the `jobs/[jobId]` workspace so that verification and ranking outcomes are easier to understand in demos and recruiter review. The current UI exposes too much raw text, places verification detail in the wrong section, and makes users read implementation artifacts instead of decision-ready summaries.

This redesign must:

- move verification interpretation to the ranking outcome sections
- reduce text density substantially
- preserve access to evidence without presenting it as raw logs
- keep `Imported Candidates` focused on ingest status only
- make ranking and rejection outcomes visually obvious for demo audiences

## Current Problems

### Imported Candidates is overloaded

The `Imported Candidates` section currently mixes ingestion, screening, verification, and matching details. This blurs the boundary between:

- "Did the file import correctly?"
- "Did the candidate pass screening?"
- "Why was the candidate ranked or rejected?"

For demos and HR workflows, those are separate questions and should not be answered in the same card.

### Verification is shown as raw text instead of decision UI

The current verification presentation is effectively a text dump:

- status phrased as sentences
- repeated URL blocks
- long fetched excerpts
- repeated mismatch notes

This makes the UI read like debugging output rather than recruiter-facing evidence.

### Ranked and rejected views are too verbose

Ranked candidate cards currently show:

- long explanation paragraphs
- long strengths/gaps text
- critic review text
- verification dumps

This weakens the product story in demos because the user must read too much before understanding the result.

## Design Direction

Use a **decision-first dashboard** approach.

The workspace should separate three responsibilities clearly:

1. `Imported Candidates`
   Purpose: confirm ingest and parsing health
2. `Ranked Candidates`
   Purpose: show who passed and why
3. `Rejected By Verification`
   Purpose: show who failed and why

Verification belongs to ranked/rejected outcomes, not to imported candidate ingest rows.

## Information Architecture

### Imported Candidates

This becomes a minimal ingest monitor.

Each row should show only:

- candidate name
- extract source
- parse source
- parse confidence
- graph sync status
- screening state label:
  - `pending screening`
  - `screened`
  - `ranked`
  - `rejected`

This section must not show:

- verification summaries
- verified links
- ranking explanation
- strengths/gaps
- project verification dumps

If the user expands an imported candidate, the detail should remain operational:

- technical skills
- cloud skills
- tooling
- evidence snippet
- delete action

No verification interpretation should appear here.

### Ranked Candidates

This becomes the primary recruiter-facing section.

Collapsed row content:

- rank
- candidate name
- match score
- verification score
- one-line explanation summary

Expanded detail should be reorganized into concise blocks:

1. `Verification Overview`
2. `Decision Summary`
3. `Graph Explanation`
4. `Skill Gap Analysis`
5. `Next-Best Candidates`
6. `Related Jobs`

The `Verification Overview` block is the key redesign target.

### Rejected By Verification

This section should mirror the ranked layout, but be focused on rejection clarity.

Collapsed row content:

- candidate name
- reject badge
- verification score
- short rejection reason

Expanded detail should show:

1. `Verification Overview`
2. `Why Rejected`
3. `Evidence Issues`

This keeps rejection legible and useful without exposing raw logs first.

## Verification Overview

### Presentation model

Use a **hybrid scorecard + mini chart** layout.

#### Scorecard row

Show four compact metrics:

- `Status`
- `Verification Score`
- `Matched Links`
- `Issue Links`

`Issue Links` is the sum of mismatched and unreachable links.

#### Mini chart

Add a small visual summary showing:

- matched links
- mismatched links
- unreachable links

For v1, this should be a lightweight horizontal segmented bar, not a heavy charting dependency.

The purpose is not analytics depth. It is fast visual comprehension.

### Evidence hierarchy

Verification detail should have three levels:

1. decision summary
2. scorecard + mini chart
3. evidence details

Evidence details should no longer default to raw excerpts. They should become short evidence rows.

## Evidence Details

Evidence details should be rewritten from "debug dump" into "review summary".

Each verified/mismatched link row should show:

- project/link title
- status badge:
  - `matched`
  - `mismatch`
  - `unreachable`
- score
- up to 3-5 matched terms
- one short issue note if mismatched

Hidden or removed from default UI:

- long fetched excerpts
- repeated raw URLs on separate lines
- repeated fetched titles as paragraphs
- repeated mismatch explanation paragraphs

If a URL is still needed, it should appear once, compactly.

## Decision Summary

The `Strengths`, `Gaps`, and `Critic review` area should be compressed.

### Ranked candidates

Replace long paragraph-heavy presentation with:

- `Top Strengths` as chips or short bullets
- `Key Gaps` as chips or short bullets
- `Review Note` as a short single paragraph only if useful

The goal is to make the ranking rationale scannable in under 5 seconds.

### Rejected candidates

Replace long verification text with:

- `Rejection Reason`
- `Main Evidence Issue`
- scorecard + chart

The user should understand the reject cause immediately.

## UI Components

### New or revised reusable blocks

The redesign should be built from small UI blocks instead of more inline paragraphs:

- `VerificationScorecard`
- `VerificationMiniChart`
- `EvidenceIssueList`
- `SummaryChipRow`

These can live inside the existing candidate detail component tree and do not require a new page.

### CandidateListItem

`CandidateListItem` should remain the outer expandable shell.

The redesign does not require changing the list/expand interaction model. It only changes:

- what content is shown in each section
- how detail content is grouped
- how dense the content is

## Data Requirements

No backend schema change is required for this redesign.

The frontend should derive verification UI from already available fields:

- `verification_status`
- `verification_score`
- `verification_summary`
- `verified_links_json`
- `screening_reason`
- `final_report_json`

The UI should compute:

- matched link count
- mismatched link count
- unreachable link count

from `verified_links_json`.

## Visual Priorities

The redesign should optimize for:

1. immediate outcome recognition
2. lower reading burden
3. demo legibility
4. evidence still accessible on expand

This is a recruiter-facing compression pass, not a backend feature pass.

## Out of Scope

This redesign does not include:

- changes to screening logic
- changes to graph scoring logic
- changes to AgentScope output generation
- changes to ranking formulas
- new chart libraries
- moving to a table-based or drawer-based layout

## Success Criteria

The redesign is successful if:

- `Imported Candidates` no longer displays verification detail
- ranked and rejected candidate cards expose verification through visual scorecards, not raw text dumps
- evidence details are short and scannable
- the user can identify pass/reject reasons within a few seconds
- the page becomes easier to demo without scrolling through verbose paragraphs

## Implementation Notes

Recommended execution order:

1. strip verification detail out of `Imported Candidates`
2. add verification-derived UI helpers in the job candidate panel
3. create scorecard + mini chart block
4. compress ranked candidate detail
5. compress rejected candidate detail
6. leave raw evidence only as short rows

This keeps the redesign incremental and easy to verify visually.
