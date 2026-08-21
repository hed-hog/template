# HedHog Lab v2

Full-stack enterprise monorepo: NestJS backend + Next.js admin dashboard.
Package manager: **pnpm**. Build tool: **Turborepo**. Database: **PostgreSQL via Prisma** with a migration-first workflow.

## Core Rules

- Respect monorepo boundaries: business logic belongs in `libraries/*`, app entrypoints in `apps/*`, and shared utilities in `packages/*`.
- Use workspace imports (`@hed-hog/*`) and avoid deep relative imports across workspaces.
- Keep edits minimal and consistent with nearby code and existing module/app style.
- Read only the files needed for the current task; do not scan the whole repo without a concrete reason.
- For large, risky, or multi-domain changes, state the intended approach before editing.
- Run focused lint/test/build checks in touched apps/packages when feasible.

## Critical Workflows

### Database and Prisma

- Never manually edit `apps/api/prisma/schema.prisma`.
- Never run `hedhog dev apply` in this `hub` repository.
- Never run commands that reset/recreate the project, database, schema, or existing migrations.
- Do not delete, overwrite, or regenerate existing migrations; they must remain intact for production database updates.
- For changes in `libraries/*/hedhog/table/*.yaml` or `libraries/*/hedhog/data/*.yaml`, create a new SQL migration under `apps/api/prisma/migrations` that mirrors the YAML change.
- After creating a new migration file, apply it by running `pnpm prisma:deploy` from `apps/api`.
- Run `pnpm db:update` only when applicable after the database has the expected structure.
- Do not use `prisma migrate dev` as the repository workflow unless a future explicit project policy replaces this one.
- When adding database triggers, functions, or other objects not generated from YAML, keep both the new migration and `libraries/<lib>/hedhog/query/triggers.sql` synchronized and idempotent.

### New Library Bootstrap

```bash
hedhog dev create-library --name <library>
pnpm install
```

Run `pnpm install` at the repository root after creating a new library.

### Admin Asset Sync

After touching `apps/admin/src/app/(app)/(libraries)` or `apps/admin/messages`, run:

```bash
hedhog dev assets-to-library <library...>
```

Infer affected libraries from:
- `apps/admin/src/app/(app)/(libraries)/<library>/...`
- `apps/admin/messages/<library>/...`

### Endpoint Permission Sync

When backend endpoints change (URL, method, auth/roles, or removal), keep these files synchronized:
- `libraries/*/hedhog/data/route.yaml`
- `libraries/*/hedhog/data/role.yaml`

Always include `admin` and the library-specific admin role, for example `admin-finance`.

### Hub Task Tracking

Code changes made through Claude Code are registered as tasks in Operations on the production Hub.
The `hub-task` skill (`.claude/skills/hub-task/`) opens the task before the work starts and closes it
after the commit; a `Stop` hook keeps the session from ending with an open task.

One-time setup per developer (the token is personal and never committed):

1. Create an **MCP** token at `https://hub.hcode.com.br/core/account/tokens`.
2. Put it in `.claude/settings.local.json` (git-ignored):

   ```json
   {
     "env": { "HUB_MCP_TOKEN": "hedhog_mcp_..." },
     "enabledMcpjsonServers": ["hub"]
   }
   ```

3. Restart Claude Code — MCP servers, skills, and hooks are all read at session start, so already
   running sessions only pick this up after a restart (`claude --continue` resumes the same
   conversation, `claude --resume` picks an older one).

Check it with `claude mcp list` (`hub: ... ✔ Connected`). The API host is `hub-api.hcode.com.br`;
`hub.hcode.com.br` serves the admin UI only. Without `HUB_MCP_TOKEN` the server just fails to connect
and everything else keeps working — the skill reports it once and does not block the requested change.

## Admin Frontend Standards

- For admin CRUD/list pages, use `apps/admin/src/app/(app)/(libraries)/contact/accounts/page.tsx` as the canonical layout reference.
- Standard list shell: `PageHeader` -> KPI row -> flat `SearchBar`/filters + `Tabela`/`Cards` toolbar -> content -> `PaginationFooter`.
- Do not wrap the toolbar or listing area in extra parent cards, and avoid duplicate headings below `PageHeader` unless product context requires it.
- Clickable rows/cards/list items must expose clear affordance with `cursor-pointer` or equivalent.
- Reuse shared components first, especially `EntityPicker`, `useFormDraft`, `ResizableSheetContent`, KPI components, and existing list/search primitives.
- Whenever a filename, MIME type, or `file` table record is displayed, use `FileTypeIcon` from `@/components/file-type-icon`; do not use raw Lucide icons as file type indicators.

## Subagent Policy

`AGENTS.md` is the primary Codex orchestration layer. For Claude, use this section as the compact equivalent.

Use a subagent only when the task is non-trivial and clearly owned by one domain, or when a mandatory handoff is needed.

Do not use subagents for:
- one-file fixes;
- simple mechanical edits;
- read-only audits;
- local analysis already covered by these rules and nearby code patterns.

Use one subagent for medium tasks with a clear owner:
- `Backend`: NestJS runtime in `libraries/*/src` or `apps/api/src`.
- `Dashboard`: dashboard-specific work in dashboard paths or dashboard backend/widget flows.
- `Frontend`: admin/web UI, forms, lists, data fetching, and i18n.
- `Hedhog YAML`: edits to `hedhog/table/*.yaml` or non-permission `hedhog/data/*.yaml`.
- `Route Permissions`: edits to `route.yaml` or `role.yaml`.
- `Hedhog Library`: new library design/bootstrap and cross-library reuse.
- `Library Documentation`: `libraries/*/README.md`.

Prefer `.codex/subagents/*.md` for role-specific details. Load `.github/agents/*.agent.md` only as compatibility/fallback context or when explicitly requested.

For multi-domain work, choose the primary owner first and hand off only when the change actually crosses ownership boundaries.
