---
description: Synchronize route.yaml and role.yaml with the current endpoint surface for a library
---

Synchronize permission seeds for the library **$ARGUMENTS** after endpoint changes.
If no library name was provided, ask the user which library to audit.

Seed ownership reference: `.codex/subagents/route-permissions.md`.
Keep this command limited to `route.yaml` and `role.yaml`; do not modify backend runtime code here.

## Step 1 — Audit changed endpoints

Read the controller file(s) under `libraries/$ARGUMENTS/src` and identify:

- New endpoints (HTTP method + exact path including path params like `:id`)
- Removed endpoints
- Renamed or re-pathed endpoints
- Changed `@Role()` requirements

## Step 2 — Update `libraries/$ARGUMENTS/hedhog/data/route.yaml`

For each new or changed endpoint, add or update an entry:

```yaml
- method: GET
  path: /library/entity
  slug: library-entity-list
```

Remove entries for deleted or renamed endpoints immediately — do not leave stale seeds.

## Step 3 — Update `libraries/$ARGUMENTS/hedhog/data/role.yaml`

Assign permission slugs to roles:

```yaml
- slug: library-entity-list
  roles:
    - admin
    - library-admin
```

Always include `admin` and the library-specific admin role (e.g., `admin-finance` for the `finance` library) for every new permission. Ensure required role slugs exist; create role entries when missing.

## Validation checklist

- [ ] Every new/changed endpoint has a route seed entry with exact method and path
- [ ] All required role slugs exist (at minimum: `admin` + library admin role)
- [ ] Removed endpoints no longer appear in seed files
- [ ] No backend runtime code was modified in this step
- [ ] Changes are limited to `route.yaml` and `role.yaml` only
