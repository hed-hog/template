---
description: Create a full admin CRUD page with list, sheet form, and i18n for a library entity
---

Create a complete admin CRUD screen for **$ARGUMENTS** (expected format: `<library> <entity>`,
e.g. `finance expense`). If library or entity name is missing, ask the user before proceeding.

Admin UI standards reference: `apps/admin/AGENTS.md`.
Canonical layout reference: the first generated page under `apps/admin/src/app/(app)/(libraries)/<library>/<entity>/page.tsx`, once one exists.

---

## File 1 — List page

Path: `apps/admin/src/app/(app)/(libraries)/<library>/<entity>/page.tsx`

Follow the canonical layout:

```
PageHeader (title + primary create action in `actions` prop)
  → KPI summary row (KpiCard/KpiCardsGrid from @/components/ui/kpi-card — when useful)
  → Flat toolbar: SearchBar + filters LEFT | Tabela/Cards ToggleGroup RIGHT
  → Content (table or card list)
  → PaginationFooter
```

Rules:
- Do NOT wrap the toolbar or listing area in an extra parent `Card`.
- Do NOT add duplicate titles/descriptions below `PageHeader`.
- Clickable rows and cards must have `cursor-pointer`.
- Per-row actions with multiple options: single `DropdownMenu` trigger — no stacked inline buttons.
- Table: keep primary columns always visible; progressively hide secondary columns at smaller breakpoints.
- When card and table views coexist, expose the same dataset and actions in both.
- When there are no items, render a default empty state: light-gray dashed border, centered icon, title/description, and a primary create button.

Data layer:
- Use `useQuery` and `useApp` from `@hed-hog/next-app-provider` — do NOT import `@tanstack/react-query` directly.
- All API calls must flow through `useApp().request` (injects current locale).
- Use `currentLocaleCode` from `useApp()` in locale-sensitive query keys.

---

## File 2 — Sheet form

Path: `apps/admin/src/app/(app)/(libraries)/<library>/<entity>/<entity>-sheet.tsx`

- Use `react-hook-form` + `zodResolver` + Shadcn form primitives.
- Same component for create and edit — distinguish via an optional `id` prop or similar.
- Sheet footer: `Cancel` + `Save`, action group aligned right on `sm+`.
- `SelectTrigger` must have `className="w-full"` in admin forms.
- Date display: use `formatDate` / `formatDateTime` from `@/lib/format-date` with `getSettingValue` and `currentLocaleCode` from `useApp()`. Never use `date-fns` `format` directly or hardcode format strings.
- Entity relation fields: use `EntityPicker` from `@/components/ui/entity-picker` — do NOT create new `*FieldWithCreate` or `*SelectWithCreate` variants.
- Draft persistence: use `useFormDraft` from `@/hooks/use-form-draft`. Never persist passwords, tokens, or file/blob values in drafts.
- Destructive actions: use `AlertDialog`, not `window.confirm`.

---

## File 3 — i18n messages

Path: `apps/admin/messages/<library>/<entity>.json`

Provide keys for:
- Page title
- Create sheet title / Edit sheet title
- Column headers
- Action labels (create, edit, delete, save, cancel)
- Empty state title and description

---

## File 4 — Asset sync

After creating the files above, run:

```bash
hedhog dev assets-to-library <library>
```

---

## Completion checklist

- [ ] `PageHeader` has the primary create action in the `actions` prop
- [ ] Toolbar is flat (no wrapper `Card`)
- [ ] Clickable rows have `cursor-pointer`
- [ ] Empty state rendered when the list is empty
- [ ] Sheet uses the same component for create and edit
- [ ] All dates use `formatDate` / `formatDateTime`
- [ ] `SelectTrigger` has `className="w-full"` in the form
- [ ] Relation fields use `EntityPicker`
- [ ] i18n keys are present in the messages file
- [ ] Asset sync completed (`hedhog dev assets-to-library <library>`)
