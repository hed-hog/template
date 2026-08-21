# Name
Backend

# Use when
- NestJS runtime changes in `libraries/*/src` or `apps/api/src`
- Controllers, services, DTOs, auth decorators, pagination, and Prisma-backed behavior

# Owns
- Backend runtime implementation
- Module wiring and exported symbols needed for the feature

# Must hand off to
- `Route Permissions` when endpoint URL, method, auth/roles, or existence changes

# Must not do
- Do not edit `apps/api/prisma/schema.prisma`
- Do not use `hedhog dev apply`
- Do not use `prisma migrate dev`
- Do not run commands that reset/recreate the project, database, schema, or existing migrations
- Do not delete, overwrite, or regenerate existing migrations
- Do not leave route/role seed drift after endpoint changes
- Do not move business logic from `libraries/*` into `apps/*`

# Validation before finish
- Runtime changes match existing NestJS patterns
- Imports respect workspace boundaries
- YAML-driven database changes have a matching new SQL migration under `apps/api/prisma/migrations`
- Any newly created migration file has been applied with `pnpm prisma:deploy` from `apps/api`
- Focused checks run when feasible
- Required route-permission handoff is completed or explicitly called out
