# widgets/

This folder holds no real widgets in a fresh template checkout — only the inert
`_placeholder.tsx` sentinel. Do not delete it: the dashboard widget loader does a
dynamic `import()` over the `@/components/widgets/` path, so Turbopack builds a
context module over this folder and fails the build if it is empty. The sentinel
keeps the folder tracked by git (empty dirs are not versioned) and non-empty. Its
`_` prefix never matches a widget slug, so the loader never imports it.

Dashboard widgets are added per installed library, following the `<library>.<widget-name>.tsx` naming convention (e.g. `core.profile-card.tsx`). They are generated/copied here by:

```bash
hedhog dev create-library --name <library>
hedhog dev assets-to-library <library>
```

See `apps/admin/AGENTS.md` and the `Dashboard` subagent (`.codex/subagents/dashboard.md`) for the widget lifecycle and catalog conventions.
