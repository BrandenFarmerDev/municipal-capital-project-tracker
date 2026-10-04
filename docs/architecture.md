# Architecture

Read-only initial module of the Municipal Capital Project Tracker. All data is synthetic.

## Workspaces
- `packages/shared` (`@municipal-tracker/shared`): API contracts, role and project constants, and USD-only integer money helpers.
- `app/backend` (`@municipal-tracker/backend`): Cloudflare Worker with D1 binding `MCT_DB`.
- `app/frontend` (`@municipal-tracker/frontend`): React/Vite app served by Cloudflare Pages.

## API
- `GET /api/health` is public.
- `GET /api/projects` (filters `phase`, `status`, `limit` 1-50, `cursor`) and `GET /api/projects/:id` require a Cloudflare Access JWT for `OWNER_EMAIL`. Other methods return 405.
- Requests with an `Origin` other than `ALLOWED_ORIGIN` get 403. Every response passes through `hardenResponse`.
- Placeholder auth configuration returns 503 `auth_unconfigured`; missing/invalid tokens or a different email return 401.

## Data model
`app_metadata`, `tenants`, `projects`, `project_milestones`, `audit_events` (see `migrations/0001_initial_schema.sql`).
- There is no membership table. One fixed demonstration tenant is seeded; `tenant_id` columns exist for future multi-agency extension and every query filters on the configured tenant.
- Money is stored as integer minor units (`approved_budget_minor`); only USD (exponent 2) is supported. Other currencies are rejected, a deferred limitation.
- Milestones are unique per `(tenant_id, project_id, sequence)`; a composite foreign key keeps milestones in the project's tenant.
- `audit_events` is append-only (triggers block update/delete) and reserved for future mutations.
- **Soft-deleted `project_number` values are permanently reserved**, by design for this scaffold: `UNIQUE(tenant_id, project_number)` includes deleted rows.

## Cursor pagination
Lists order by `created_at, id` and are served by `idx_projects_tenant_list (tenant_id, deleted_at, created_at, id)`. The cursor is an opaque base64url encoding of `created_at|id`; the store fetches `limit + 1` rows to determine `nextCursor`. Malformed cursors return 400.