# Updating the bootstrap from the working project

This repository is the seed `hedhog new` clones. Day-to-day work happens in the
working project (the "hub"); this is the loop that carries a change from there
to here without breaking project creation.

Two tools do the work:

- **`pnpm sync:bootstrap`** — pulls files from the hub, driven by
  [`bootstrap.sync.json`](../bootstrap.sync.json).
- **`pnpm test:bootstrap`** — creates a real project from the local tree and
  runs it through the same sequence as CI. See
  [TESTING.md](../TESTING.md#testing-the-bootstrap-before-pushing).

---

## 1. Publish what the template consumes — in dependency order

Skip this when the change touches no `@hed-hog/*` package.

The template vendors `packages/api*` as workspace members, and `hedhog add core`
rewrites a library's dependencies to `workspace:*`. A library therefore compiles
against **the template's copy**, not against npm. Two consequences:

- Publishing a shared package is not enough; its source must also reach
  `packages/*` here (step 2 does that).
- **Publish shared packages before the libraries that use them.** A library
  published first will reference exports that exist nowhere, and nothing can
  install it until the package it needs is out.

Order: `api`, `api-types`, `api-mail`, `api-locale`, … → then `core` → then the
enterprise libraries.

> Endpoint permissions have their own rule. A route grant must live in the
> library that **depends** on the other one, because the migration guard fails
> both when the role is missing and when the route is missing. Core cannot
> depend on `cms`, so a grant for `admin-cms` belongs in `cms`'s `route.yaml`,
> never in core's. See the "Endpoint Permission Sync" section in
> [CLAUDE.md](../CLAUDE.md).

## 2. Review the sync plan

```powershell
pnpm sync:bootstrap:check
```

Writes nothing. Point it elsewhere with `--source <path>` or `HEDHOG_HUB_PATH`;
it defaults to `../../hcodev/hub`.

**Read the "Adicionar" list every time.** `include` covers `apps/api/**`,
`scripts/**` and `docs/**` wholesale, so anything new in the hub shows up as an
addition — including code that belongs only there. Each entry is one of:

| The file is…                                                                                                 | Do                                                                 |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Baseline every project should get                                                                            | Let it through                                                     |
| Specific to the working project (a product module, a one-off data script, observability wiring)              | Add it to `exclude` in `bootstrap.sync.json`                       |
| Part of a library, but living in a shared path (`packages/api-types`, `apps/admin/src/lib`, `apps/api/test`) | Add it to `exclude` — `libraries/**` does not cover this spillover |

Updates rarely need triage: they are files that already exist here.

## 3. Apply

```powershell
pnpm sync:bootstrap          # asks for confirmation
pnpm sync:bootstrap -- --yes # no prompt
```

Then read `git diff`. Two files are rewritten by sanitizers rather than copied
verbatim, and are worth a look:

- `apps/api/package.json` — library dependencies stripped (`libraryDependencies`)
- `apps/api/src/app.module.ts` — library modules and their `imports:` entries
  stripped (`appModule`)

## 4. Install, commit, then test

```powershell
pnpm install --no-frozen-lockfile   # only if dependencies changed
git add -A && git commit
pnpm test:bootstrap
```

**Commit before testing.** The smoke test clones the committed `HEAD`, so
uncommitted work is not what gets exercised; it refuses to run on a dirty tree
for that reason. If it fails, fix and amend.

Budget ~3 minutes. `-SkipUnitTests` cuts the longest step while you iterate;
run it once without the flag before pushing.

## 5. Push

Only after `pnpm test:bootstrap` is green.

---

## What the smoke test is there to catch

Every defect below survived a green CI and only appeared in a generated
project. This is the class of problem the loop exists for:

- A dependency imported by `apps/api` but never declared. `nest build` passes —
  tsconfig paths resolve it — and the compiled server then dies at startup with
  `MODULE_NOT_FOUND`, because pnpm does not expose undeclared packages.
- `ConfigModule` registered without `forRoot({ isGlobal: true })`. Harmless
  until a library module injects `ConfigService`, which no app in this
  repository does.
- A `packages/*` copy older than what a published library expects.
- A route granted to a role its library does not own, which aborts the
  migration.

CI checks out this repository and never runs `hedhog new`, so none of them are
covered there.

## Keeping the manifest honest

`bootstrap.sync.json` lives here; the CLI carries a copy as a fallback
(`DEFAULT_BOOTSTRAP_SYNC_CONFIG` in `bootstrap-config.ts`). Change both when
you change either.

The one-off scripts are listed individually because `scripts/**` is included
wholesale. If that list grows tiresome, invert it: drop `scripts/**` from
`include` and name the bootstrap's own scripts instead — a smaller and far more
stable set.
