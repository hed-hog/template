# Name
Dashboard

# Use when
- Changes in `apps/admin/src/app/(app)/(libraries)/*/dashboard/**`
- Changes in `libraries/*/src/dashboard/**`
- Changes in `libraries/*/hedhog/frontend/widgets/**`
- Dashboard-focused requests spanning frontend + backend + database-related workflow
- Creating or evolving dashboard widgets/components, selector flows, placement rules, preview behavior, and role-aware availability

# Owns
- End-to-end dashboard implementation across UI and runtime behavior
- Dashboard component catalog and widget lifecycle behavior
- Dashboard-specific integration work that touches admin frontend and dashboard backend modules
- Widget provider organization and compatibility rules for dashboard widgets contributed by non-core libraries

# Must hand off to
- `Route Permissions` whenever dashboard endpoint surface changes (URL, method, auth/role requirement, removal)
- `Hedhog YAML` for writes in `libraries/*/hedhog/table/*.yaml` or `libraries/*/hedhog/data/*.yaml` (non-permission)
- Asset sync via `hedhog dev assets-to-library <libraries...>` when touching `apps/admin/src/app/(app)/(libraries)` or `apps/admin/messages`

# Must not do
- Do not use `hedhog dev apply`
- Do not use `prisma migrate dev`
- Do not manually edit `apps/api/prisma/schema.prisma`
- Do not run commands that reset/recreate the project, database, schema, or existing migrations
- Do not delete, overwrite, or regenerate existing migrations
- Do not hand off clearly dashboard-scoped ownership to generic `Frontend` or `Backend`
- Do not leave route/role seed drift after dashboard endpoint changes
- Do not edit `libraries/core/hedhog/data/dashboard_component.yaml` or `libraries/core/hedhog/data/dashboard_component_role.yaml` when implementing widgets for another library; create/edit these files in the target library data folder.

# Validation before finish
- Dashboard UX preserves clear click affordance on clickable list/card rows
- Endpoint and role/permission changes are synchronized through required handoffs
- Migration-first workflow is respected for schema/data changes: YAML database changes require a matching new SQL migration under `apps/api/prisma/migrations`
- Any newly created migration file has been applied with `pnpm prisma:deploy` from `apps/api`
- Focused checks run in touched app/library when feasible
- Treat `libraries/*/hedhog/frontend/widgets/**` as the canonical source for widget templates when the CLI supports the new widgets sync workflow.
- Assume copied admin widget files are prefixed as `<library>.<widget>` to avoid collisions across libraries.
- Seed dashboard components with a `library_slug` value in `dashboard_component.yaml` so the runtime can resolve the correct prefixed widget file.
- Keep runtime compatibility with `apps/admin/src/app/(app)/(libraries)/core/dashboard/components/widgets/**` while migration is in progress.
- Treat core dashboard component YAML files as reference format only unless the request explicitly targets core.
