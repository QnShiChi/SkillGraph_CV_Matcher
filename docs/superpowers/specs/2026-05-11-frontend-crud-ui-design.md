# Frontend CRUD UI Design

## Goal

Add a navigable frontend administration UI for creating, editing, and deleting `jobs` and `candidates` through the existing backend API.

This phase introduces:

- a reusable dashboard app shell with sidebar or navigation-based routing
- a dedicated overview route
- a dedicated admin route for jobs
- a dedicated admin route for candidates
- UI flows for create, edit, and delete

The goal is to make CRUD usable directly from the frontend rather than only through Swagger or `curl`.

## Scope

This design includes:

- frontend app shell with route navigation
- new routes for overview, jobs admin, and candidates admin
- CRUD UI for `jobs`
- CRUD UI for `candidates`
- shared form UX for create and edit
- delete confirmation UX
- loading, empty, and error states

This design does not include:

- authentication
- access control
- file upload
- pagination
- search/filter
- bulk actions
- `match_runs` UI
- Neo4j admin UI
- global state libraries

## Information Architecture

The frontend should move from a single-page dashboard feel to a small routed admin workspace.

Recommended route structure:

- `/` or `/overview`: overview dashboard
- `/admin/jobs`: jobs management
- `/admin/candidates`: candidates management

The overview route remains the product summary screen. CRUD lives on the dedicated admin routes.

## Navigation Pattern

Use a sidebar-based app shell as the primary navigation structure.

Reasoning:

- fits an admin/dashboard product better than top navigation
- leaves room for more modules later
- makes route switching predictable and visually stable
- aligns well with card-based panels and data management screens

### Sidebar contents

Initial navigation items:

- `Overview`
- `Admin Jobs`
- `Admin Candidates`

The sidebar should be persistent on desktop and adapt cleanly on smaller screens.

## Visual Direction

The UI must continue to follow `DESIGN.md`.

This means:

- light theme
- strong purple brand accent
- moderate rounded corners rather than pill-heavy controls
- clean, confident spacing
- card-based panels
- non-generic dashboard composition

The CRUD pages should feel like part of the same product as the overview route, not like scaffolded admin templates.

## App Shell

The app shell should contain:

- left sidebar navigation
- top content header area for page title and short description
- main content region for route-specific screens

The app shell should be reusable across:

- overview
- jobs admin
- candidates admin

## Jobs Admin Screen

Route: `/admin/jobs`

### Layout sections

- page header
  - title
  - short description
  - `Create Job` action

- list area
  - cards or a structured list of jobs

- right-side drawer or inline side panel
  - used for both create and edit

### Form fields

- `title`
- `description`
- `required_skills_text`
- `status`

### Actions per job item

- `Edit`
- `Delete`

### Behavior

- clicking `Create Job` opens an empty form drawer
- clicking `Edit` opens the same drawer prefilled with the job data
- submitting create calls `POST /api/jobs`
- submitting edit calls `PUT /api/jobs/{id}` with partial-update behavior
- deleting calls `DELETE /api/jobs/{id}` after confirmation
- after create/update/delete, the list refreshes

## Candidates Admin Screen

Route: `/admin/candidates`

### Layout sections

- page header
  - title
  - short description
  - `Create Candidate` action

- list area
  - cards or structured list of candidates

- right-side drawer or inline side panel
  - shared for create and edit

### Form fields

- `full_name`
- `email`
- `resume_text`
- `skills_text`
- `status`

### Actions per candidate item

- `Edit`
- `Delete`

### Behavior

- create opens empty form
- edit preloads existing data
- submit create uses `POST /api/candidates`
- submit edit uses `PUT /api/candidates/{id}`
- delete uses `DELETE /api/candidates/{id}` after confirmation
- list refreshes after successful actions

## Form UX

The create and edit form should be implemented once per entity type and reused by mode.

Recommended pattern:

- right drawer or side panel instead of centered modal

Reasoning:

- preserves context of the list while editing
- feels more natural in dashboard software
- scales better for longer forms

Form state per page:

- `mode`: `create` or `edit`
- `selected record`
- `isDrawerOpen`
- `isSubmitting`
- `error message`

## Data Fetching Strategy

Use a lightweight client-side approach for admin pages.

### Overview route

- may stay server-rendered

### Admin routes

- should use client components
- fetch list data on page load
- refresh data after create/update/delete

No dedicated state library is required for this phase. Local state plus shared fetch helpers is sufficient.

## Delete UX

Delete should not happen instantly on first click.

Recommended flow:

1. user clicks `Delete`
2. simple confirmation dialog appears
3. user confirms
4. app calls delete endpoint
5. list refreshes or item disappears

If delete fails, show a clear inline error or page-level alert.

## Loading, Empty, and Error States

### Loading

- show concise loading placeholders or skeleton-like cards

### Empty state

- render a visible empty-state card
- explain that no records exist yet
- point the user toward the create action

### Fetch error

- show an error card in the content area
- avoid blank or broken pages

### Submit error

- show the message near the form or in the drawer body

### Delete error

- show a visible failure message rather than silently failing

## Backend Contract Assumptions

This UI depends on the existing backend contracts:

- `GET /api/jobs`
- `POST /api/jobs`
- `PUT /api/jobs/{id}`
- `DELETE /api/jobs/{id}`
- `GET /api/candidates`
- `POST /api/candidates`
- `PUT /api/candidates/{id}`
- `DELETE /api/candidates/{id}`

The frontend should respect:

- `400` on empty update body
- `404` on missing record
- `204` on delete success

## Component Direction

The frontend will likely benefit from shared UI pieces such as:

- app shell
- sidebar nav
- page header
- list card
- drawer form container
- confirmation dialog
- empty-state card
- error-state card

These should be introduced only as needed and kept small and purpose-specific.

## Verification Requirements

This milestone is complete only if all of the following are true:

1. the app shell supports route switching between overview, jobs admin, and candidates admin
2. `/admin/jobs` can create a job from the frontend UI
3. `/admin/jobs` can edit a job from the frontend UI
4. `/admin/jobs` can delete a job from the frontend UI
5. `/admin/candidates` can create a candidate from the frontend UI
6. `/admin/candidates` can edit a candidate from the frontend UI
7. `/admin/candidates` can delete a candidate from the frontend UI
8. loading, empty, and error states render without breaking layout
9. the UI remains aligned with `DESIGN.md`

## Design Decisions

### Decision: dedicated admin routes

CRUD is isolated from the overview route so the information architecture can scale cleanly as more product modules are added.

### Decision: sidebar shell

Sidebar navigation is chosen over top navigation because the product is evolving into a dashboard workspace rather than a landing page with a few tabs.

### Decision: client-side CRUD pages

Admin pages use client-side state because repeated create/edit/delete interactions are more ergonomic this way than forcing pure server-render behavior.

### Decision: right-side form drawer

A side drawer keeps context visible and feels more native to a management console than a centered modal.

## Risks

### Risk: route and layout complexity growth

Moving from a single route to a small app shell increases component structure. The implementation should keep the shell simple and avoid over-engineering.

### Risk: duplicated CRUD patterns

Jobs and candidates screens are structurally similar. The implementation should share patterns where useful but avoid forcing premature abstraction.

### Risk: client-state edge cases

Refresh-after-mutation is simpler than optimistic updates, but the implementation still needs clear loading and error paths so the UI never feels stale or ambiguous.
