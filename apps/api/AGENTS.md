# API App

These instructions apply to `apps/api`.

## App role
- `apps/api` is a thin backend entrypoint; business logic must live in `libraries/*`.
- Integrate library modules via workspace packages `@hed-hog/*`.

## Prisma
- Never manually edit `prisma/schema.prisma`.
- Never run `hedhog dev apply` in this `hub` repository.
- Never run commands that reset/recreate the project, database, schema, or existing migrations.
- Do not delete, overwrite, or regenerate existing migrations; they must remain intact to update the production database.
- When changing structure or data YAML in `libraries/*/hedhog/table/*.yaml` or `libraries/*/hedhog/data/*.yaml`, create a new SQL migration in `apps/api/prisma/migrations` reflecting the same change.
- After creating a new migration file, apply it by running `pnpm prisma:deploy` in the `apps/api` path.
- To refresh the schema and client, use `pnpm db:update` only when applicable and after the database is in the expected structure.
- Do not introduce a `prisma migrate dev`-based workflow in this project, unless an explicit future policy states otherwise.

## Backend integration
- When adding or wiring up a new module, keep `app.module.ts` and the imports consistent with the existing pattern.
- Do not duplicate business rules in the entrypoint that should live in library services.
