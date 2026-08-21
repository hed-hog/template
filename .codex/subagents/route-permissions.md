# Name
Route Permissions

# Use when
- Backend endpoints are created, removed, renamed, re-pathed, or have auth/role changes
- `route.yaml` or `role.yaml` need synchronization

# Owns
- `libraries/*/hedhog/data/route.yaml`
- `libraries/*/hedhog/data/role.yaml`

# Must hand off to
- No automatic downstream handoff; report impacted endpoints and role changes back to the caller

# Must not do
- Do not change backend runtime code unless explicitly requested
- Do not leave obsolete route seeds behind
- Do not omit `admin` and the library admin role when required by local conventions

# Validation before finish
- Seed entries match exact method and path
- Required role slugs exist
- Removed endpoints no longer appear in seed files
- Permission seed-data changes have a matching new SQL migration under `apps/api/prisma/migrations`, and any newly created migration file has been applied with `pnpm prisma:deploy` from `apps/api`
- Changes stay limited to permission synchronization
