# scripts/

Development and operations utilities for the monorepo. Most run via `pnpm exec ts-node` (`.ts`) or `node` directly (`.js`/`.mjs`).

## Referenced in `package.json` (root)

| Script                           | npm script                                                                                  | What it does                                                                                                                                       |
| -------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `init-env.ts`                    | `postinstall` / `init:env`                                                                  | Copies `.env.example` → `.env` in each app that doesn't have a `.env` yet                                                                          |
| `encrypt-integration-secrets.ts` | `encrypt:integration-secrets`                                                               | Idempotent backfill: encrypts legacy plain-text secrets in Integration Profiles. Requires `DATABASE_URL`/`ENCRYPTION_SECRET`; supports `--dry-run` |
| `patch.ts`                       | `patch`                                                                                     | Bumps the patch version (x.y.**z**) in the `package.json` files of `packages/*`                                                                    |
| `clean.js`                       | `clean`                                                                                     | Full reset: removes `node_modules`, lockfiles, `dist`, `.turbo` from apps/packages                                                                 |
| `clean-next-cache.js`            | used by `start:admin`, `start:api`                                                          | Cleans only `.next`/`.turbo` for a specific app (does not touch `node_modules`/lockfiles — see `clean.js` for a full reset)                        |
| `start-admin-with-worker.mjs`    | `start:admin:worker`                                                                        | Starts `admin` + `api` + worker in parallel via `pnpm`                                                                                             |
| `create-types.ts`                | `create:types`                                                                              | Generates the shared types package                                                                                                                 |
| `promote-production.js`          | `promote:production`, `production`, `production:core`, `production:api`, `production:admin` | Deploy/promotion script for production (accepts a list of apps as an argument, e.g. `api,admin`)                                                   |
| `sync-changed-files.ts`          | `sync:changed-files`                                                                        | Syncs changed files between libraries                                                                                                              |

## Not referenced in `package.json` (manual use)

| Script                           | What it does                                                                                      | How to run                                                            |
| -------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `db-backup-restore.js`           | Backup/restore the database via `docker-compose` (dump to `backups/hedhog-backup.dump`)           | `node ./scripts/db-backup-restore.js <backup\|restore\|print-config>` |
| `create-migrate.ts`              | Interactive prompt to create a new Prisma migration                                               | `pnpm exec ts-node ./scripts/create-migrate.ts [name]`                |
| `prisma-update.ts`               | Detects the provider (postgres/mysql) from `apps/api/.env` and runs the Prisma schema update      | `pnpm exec ts-node ./scripts/prisma-update.ts`                        |
| `reset-prisma-schema.ts`         | Resets the Prisma schema                                                                          | `pnpm exec ts-node ./scripts/reset-prisma-schema.ts`                  |
| `fix-library-language-texts.mjs` | Fixes library i18n texts using an LLM (`DOCS_LLM_API_URL`/`DOCS_LLM_MODEL`/`DOCS_LLM_API_KEY`)    | `node ./scripts/fix-library-language-texts.mjs --<options>`           |
| `generate-library-readme.mjs`    | Generates a library's README using an LLM (same envs as above)                                    | `node ./scripts/generate-library-readme.mjs --<options>`              |
| `stop-stale-api-dev.js`          | Windows only: kills orphaned `node.exe` processes from `api` in dev mode (via WMI/PowerShell)     | `node ./scripts/stop-stale-api-dev.js`                                |
| `build-dependencies.ts`          | Builds packages/libraries whose source code changed, using a content hash cached in `hedhog.json` | `pnpm exec ts-node ./scripts/build-dependencies.ts`                   |

## Internal helper

- `esm-helper.ts` — `__dirname`/`__filename` helper for TS scripts run as ESM. Not executed directly; it is imported by other scripts.

## Extension convention

There isn't a single convention today: scripts that use "pure" Node APIs tend to use `.mjs`, scripts with more complex/typed logic use `.ts` (via `ts-node`), and simple/older scripts use `.js`. When creating a new script, prefer `.ts` if it has non-trivial types, or `.mjs` for simple I/O utilities.
