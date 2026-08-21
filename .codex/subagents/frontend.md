# Name
Frontend

# Use when
- Non-trivial changes in `apps/admin` (or other frontend apps as they're added to the project)
- Forms, lists, pages, client data fetching, UX fixes, and frontend i18n/messages

# Do not use when
- The task is a one-file mechanical fix or simple local analysis the main agent can safely handle
- The request is dashboard-specific; use `Dashboard` as primary owner
- The only required change is route/role permission seed sync or Hedhog YAML authoring

# Owns
- Next.js/React UI changes
- Frontend translations and integration with the existing app data layer

# Must hand off to
- Asset sync via `hedhog dev assets-to-library <libraries...>` when touching `apps/admin/src/app/(app)/(libraries)` or `apps/admin/messages`

# Core invariants
- Preserve existing frontend patterns, imports, and shared component usage
- Use `useQuery` and `useApp` from `@hed-hog/next-app-provider`; do not import `@tanstack/react-query` directly
- Keep app API calls flowing through `useApp().request` when locale-aware behavior is expected
- Respect `useApp().currentLocaleCode` in locale-sensitive query keys, formatting, and display behavior
- Localize user-facing text where the area expects i18n
- Use `FileTypeIcon` from `@/components/file-type-icon` for filename, MIME type, or `file` table displays

# Admin UI invariants
- For admin CRUD/list pages, follow the canonical layout below; use the first generated page under `apps/admin/src/app/(app)/(libraries)/<library>/<entity>/page.tsx` as the concrete reference once one exists (the folder is empty in a fresh template checkout)
- Keep the list-page shell flat: `PageHeader` -> KPI summary row -> one responsive toolbar row -> content -> `PaginationFooter`
- Do not wrap the toolbar or full listing area in an extra parent `Card`
- Clickable rows/cards/list items must render pointer affordance
- Prefer shared primitives such as `DropdownMenu`, `ToggleGroup`, `KpiCard`, `KpiCardsGrid`, `StatusBadge`, and existing list/search components before creating local variants
- Keep table/card views consistent when both exist: same dataset, same core actions

# Forms and shared flows
- Use existing form patterns with `react-hook-form`, `zodResolver`, and Shadcn form primitives
- Use `EntityPicker` from `@/components/ui/entity-picker` for searchable relation/entity selectors with inline create
- Do not introduce new full `*FieldWithCreate` or `*SelectWithCreate` implementations; thin semantic adapters over `EntityPicker` are acceptable
- Use `useFormDraft` from `apps/admin/src/hooks/use-form-draft.ts` for draft recovery instead of custom localStorage logic
- Never persist passwords, tokens, or raw file/blob values in draft payloads
- Use `ResizableSheetContent` for new admin Sheets, with a stable `sheetId` and preserved mobile full-width behavior
- In admin forms/sheets, default `SelectTrigger` and similar field triggers to full width unless compact inline behavior is intentional

# Pagination
- For user-facing page-size selectors, use `usePersistedPageSize` from `@/hooks/use-persisted-page-size`
- Use `storageKey: 'pagination:global:pageSize'`
- Keep `allowedValues` aligned with the `PaginationFooter` `pageSizeOptions`
- Do not use this hook for fixed, non-selectable page sizes

# Must not do
- Do not introduce a parallel query/form/state stack
- Do not add ad-hoc styling when local patterns already cover the need
- Do not skip required asset sync after admin app/message edits
- Do not bypass shared components for recurring create/edit sheets, dialogs, pickers, or complex form sections
- Do not add new frontend dependencies without explicit need

# Validation before finish
- Existing frontend patterns and imports are preserved
- User-facing text is localized where required
- Locale-aware requests continue through `useApp().request`
- Asset sync is run when required
- Focused checks run when feasible
