# widgets/

This folder is intentionally empty in a fresh template checkout.

Dashboard widgets are added per installed library, following the `<library>.<widget-name>.tsx` naming convention (e.g. `core.profile-card.tsx`). They are generated/copied here by:

```bash
hedhog dev create-library --name <library>
hedhog dev assets-to-library <library>
```

See `apps/admin/AGENTS.md` and the `Dashboard` subagent (`.codex/subagents/dashboard.md`) for the widget lifecycle and catalog conventions.
