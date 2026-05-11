# Update and Delete API Design

## Goal

Extend the existing PostgreSQL-backed CRUD layer for `jobs` and `candidates` by adding update and delete capabilities.

This phase introduces:

- `PUT /api/jobs/{id}` with partial-update behavior
- `DELETE /api/jobs/{id}` with hard delete behavior
- `PUT /api/candidates/{id}` with partial-update behavior
- `DELETE /api/candidates/{id}` with hard delete behavior

The goal is to complete the basic record lifecycle for the two primary relational entities without expanding into frontend edit flows yet.

## Scope

This design includes:

- partial update schemas for jobs and candidates
- repository functions for get-by-id, update, and delete
- route handlers for `PUT` and `DELETE`
- not-found handling with `404`
- empty update payload handling with `400`
- verification that list endpoints and frontend output reflect changes after update/delete

This design does not include:

- frontend edit forms
- frontend delete buttons
- bulk update or bulk delete
- soft delete
- `PATCH` endpoints
- update/delete support for `match_runs`
- audit logging
- authorization

## API Direction

Although partial update semantics are usually associated with `PATCH`, this phase intentionally keeps the user-facing contract on `PUT` to match the requested interface.

Behavioral rule:

- `PUT` accepts a body where every update field is optional
- only fields present in the payload are applied
- omitted fields remain unchanged

This is effectively patch-like behavior on a `PUT` route and should be treated as an intentional project decision.

## Backend Changes

The existing persistence structure remains intact. This phase adds:

- `JobUpdate` schema
- `CandidateUpdate` schema
- repository functions for read/update/delete by id
- route handlers for update/delete

No schema migration is required because the relational tables already exist and no columns are changing.

## Update Contract

### `PUT /api/jobs/{id}`

Request body fields:

- `title` optional
- `description` optional
- `required_skills_text` optional
- `status` optional

Behavior:

- update only the fields present in the request body
- keep all omitted fields unchanged
- update `updated_at` through ORM/database behavior
- return `404` if the target record does not exist
- return `400` if the payload contains no updatable fields

Response:

- the updated `job` object

### `PUT /api/candidates/{id}`

Request body fields:

- `full_name` optional
- `email` optional
- `resume_text` optional
- `skills_text` optional
- `status` optional

Behavior:

- update only the fields present in the request body
- keep omitted fields unchanged
- update `updated_at`
- return `404` if the record does not exist
- return `400` if no update fields were sent

Response:

- the updated `candidate` object

## Delete Contract

### `DELETE /api/jobs/{id}`

Behavior:

- permanently remove the `job` row from PostgreSQL
- return `404` if the record does not exist

Response:

- `204 No Content`

### `DELETE /api/candidates/{id}`

Behavior:

- permanently remove the `candidate` row from PostgreSQL
- return `404` if the record does not exist

Response:

- `204 No Content`

## Validation Rules

### Jobs

- `status`, if provided, must remain within the existing allowed set
- an empty update payload is invalid

### Candidates

- `status`, if provided, must remain within the existing allowed set
- `email` remains optional and may be nullable
- an empty update payload is invalid

## Repository Design

Each repository should gain three capabilities:

- fetch by id
- update by id
- delete by id

Repository behavior should be explicit:

- fetch the current record first
- return `None` when the record does not exist
- update only submitted fields
- commit the transaction and refresh the updated row
- delete the row and commit on successful hard delete

This keeps the route layer thin and avoids leaking ORM mutation logic across handlers.

## Route Behavior

The route layer should:

- parse the path id
- validate the request body
- reject empty update payloads with `400`
- translate missing records into `404`
- return updated records for `PUT`
- return `204` with no response body for `DELETE`

FastAPI should continue to handle ordinary schema validation errors automatically.

## Frontend Impact

No frontend editing or deletion UI is required in this phase.

The existing dashboard remains read-only, but it must continue to reflect backend state correctly after update/delete operations performed through Swagger or direct API calls.

This means:

- updated records should show new values after refresh
- deleted records should disappear from the list after refresh

## Error Handling

### `404`

Return when:

- updating a missing job
- deleting a missing job
- updating a missing candidate
- deleting a missing candidate

### `400`

Return when:

- the update body contains no updatable fields

### Validation errors

Let FastAPI return standard validation errors for:

- invalid status values
- invalid email format
- invalid request shapes

## Verification Requirements

This milestone is complete only if all of the following are true:

1. `PUT /api/jobs/{id}` updates one or more submitted fields without clearing omitted fields
2. `PUT /api/jobs/{id}` returns `404` for a missing record
3. `DELETE /api/jobs/{id}` returns `204`
4. `GET /api/jobs` no longer returns a deleted record
5. `PUT /api/candidates/{id}` updates one or more submitted fields without clearing omitted fields
6. `PUT /api/candidates/{id}` returns `404` for a missing record
7. `DELETE /api/candidates/{id}` returns `204`
8. `GET /api/candidates` no longer returns a deleted record
9. frontend still renders the current remaining data correctly after refresh

## Design Decisions

### Decision: hard delete

The project uses hard delete here because the requested scope is simple lifecycle completion, not audit preservation. This keeps the data layer and verification path minimal.

### Decision: `PUT` with partial-update behavior

This is intentionally pragmatic rather than semantically pure REST. It preserves the requested endpoint names while avoiding the friction of requiring full object replacement on every update.

### Decision: no migration changes

Because this phase changes only API and repository behavior, not schema shape, no Alembic migration should be created.

## Risks

### Risk: later need for soft delete

If the product later needs historical retention, these delete endpoints may need to be redesigned around status flags instead of physical deletion.

### Risk: `PUT` semantics surprise

Some developers may assume `PUT` means full replacement. The implementation and docs should make the partial-update rule explicit to avoid accidental misuse.
