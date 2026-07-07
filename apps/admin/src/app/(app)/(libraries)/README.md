# (libraries)

This route group is intentionally empty in a fresh template checkout.

It is populated by the HedHog CLI when you install a library:

```bash
hedhog dev create-library --name <library>
hedhog dev assets-to-library <library>
```

Each installed library gets its own `<library>/<entity>/page.tsx` routes here, following the canonical CRUD/list layout documented in `apps/admin/AGENTS.md` and `CLAUDE.md`.
