#!/usr/bin/env node

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Colors & output helpers ──────────────────────────────────────────────────

const TTY = process.stdout.isTTY;
const ETTY = process.stderr.isTTY;

const c = {
  reset:  TTY ? '\x1b[0m'  : '',
  bold:   TTY ? '\x1b[1m'  : '',
  dim:    TTY ? '\x1b[2m'  : '',
  red:    TTY ? '\x1b[31m' : '',
  green:  TTY ? '\x1b[32m' : '',
  yellow: TTY ? '\x1b[33m' : '',
  cyan:   TTY ? '\x1b[36m' : '',
  gray:   TTY ? '\x1b[90m' : '',
};

const ce = {
  reset:  ETTY ? '\x1b[0m'  : '',
  bold:   ETTY ? '\x1b[1m'  : '',
  red:    ETTY ? '\x1b[31m' : '',
  yellow: ETTY ? '\x1b[33m' : '',
  gray:   ETTY ? '\x1b[90m' : '',
};

function paint(color, text) {
  return `${color}${text}${c.reset}`;
}

function paintE(color, text) {
  return `${color}${text}${ce.reset}`;
}

const SEP = paint(c.dim, '─'.repeat(52));
let _stepActive = false;

function printBanner(appsArg, skipBuild) {
  const target = appsArg
    ? paint(c.cyan + c.bold, appsArg)
    : paint(c.cyan + c.bold, 'all apps');
  const build = skipBuild
    ? paint(c.yellow, 'build: skipped')
    : paint(c.cyan, 'build: on');
  console.log('');
  console.log(`  🚀  ${paint(c.bold, 'Promoting')} ${paint(c.cyan, 'master')} → ${paint(c.cyan, 'production')}  ${paint(c.dim, '[target: ')}${target}${paint(c.dim, ']')}  ${paint(c.dim, '[')}${build}${paint(c.dim, ']')}`);
  console.log(`  ${SEP}`);
}

function printStep(message) {
  process.stdout.write(`\n  ${paint(c.cyan, '◆')}  ${paint(c.bold, message)}...`);
  _stepActive = true;
}

// Steps that stream a child process output need the header line closed, or the
// build output starts glued to the trailing "...".
function printStepBlock(message) {
  console.log(`\n  ${paint(c.cyan, '◆')}  ${paint(c.bold, message)}...`);
  _stepActive = false;
}

function printBlockDone(detail) {
  console.log(`  ${paint(c.green, '✓')}  ${paint(c.dim, detail)}`);
}

function printDone(detail) {
  const suffix = detail ? `  ${paint(c.dim, detail)}` : '';
  process.stdout.write(`  ${paint(c.green, '✓')}${suffix}\n`);
  _stepActive = false;
}

function printInfo(message) {
  console.log(`     ${paint(c.gray, '→')}  ${paint(c.dim, message)}`);
}

function printWarning(message) {
  process.stderr.write(`\n  ${paintE(ce.yellow, '⚠')}  ${paintE(ce.yellow, message)}\n`);
}

function closeStepWithError() {
  if (_stepActive) {
    process.stderr.write(`  ${paintE(ce.red, '✗')}\n`);
    _stepActive = false;
  }
}

function printSuccess(appsArg) {
  const trigger = appsArg
    ? `GitHub Actions will deploy: ${paint(c.cyan + c.bold, appsArg)}`
    : 'GitHub Actions will deploy all apps';
  console.log('');
  console.log(`  ${SEP}`);
  console.log(`  ${paint(c.green + c.bold, '✓')}  ${paint(c.green + c.bold, 'Production promotion completed successfully!')}`);
  console.log(`     ${paint(c.gray, '→')}  ${paint(c.dim, 'You are now on branch ')}${paint(c.cyan, 'master')}`);
  console.log(`     ${paint(c.gray, '→')}  ${paint(c.dim, trigger)}`);
  console.log('');
}

// ─── Git helpers ──────────────────────────────────────────────────────────────

function runGit(args, options = {}) {
  const { allowFailure = false } = options;
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    // The default (1 MiB) overflows on `git show` of a large schema.prisma (ENOBUFS).
    maxBuffer: 256 * 1024 * 1024,
  });

  const stdout = (result.stdout || '').trim();
  const stderr = (result.stderr || '').trim();

  if (result.error) {
    throw new Error(`Failed to execute git ${args.join(' ')}: ${result.error.message}`);
  }

  if (result.status !== 0 && !allowFailure) {
    const output = stderr || stdout || `git ${args.join(' ')} failed`;
    throw new Error(output);
  }

  return { ok: result.status === 0, status: result.status, stdout, stderr };
}

function hasLocalBranch(name) {
  return runGit(['show-ref', '--verify', '--quiet', `refs/heads/${name}`], {
    allowFailure: true,
  }).ok;
}

function hasRemoteBranch(name) {
  return runGit(['ls-remote', '--exit-code', '--heads', 'origin', name], {
    allowFailure: true,
  }).ok;
}

function switchBranch(name) {
  runGit(['switch', name]);
}

function ensureCleanWorkingTree() {
  const status = runGit(['status', '--porcelain']);
  if (status.stdout.length > 0) {
    throw new Error(
      'Working tree has uncommitted changes.\n' +
      '     Commit or stash your changes before running this script.',
    );
  }
}

function ensureMasterExists() {
  if (hasLocalBranch('master')) return;

  if (!hasRemoteBranch('master')) {
    throw new Error('Branch "master" was not found locally or on origin.');
  }

  runGit(['branch', 'master', 'origin/master']);
}

function readSchemaAtRef(ref) {
  const result = runGit(['show', `${ref}:apps/api/prisma/schema.prisma`], { allowFailure: true });
  return result.ok ? result.stdout : null;
}

function extractModelNames(schemaContent) {
  const matches = schemaContent.match(/^model\s+(\w+)/gm) || [];
  return matches.map((line) => line.replace(/^model\s+/, ''));
}

// Prisma schema syntax never nests `{}` inside a model body (relation/attribute
// args use `()`, not `{}`), so the first top-level `}` after `model X {` always
// closes that model.
//
// Only columns are collected. Relation fields are named by `prisma db pull` after
// the foreign keys it finds, so a second FK to the same table renames the first
// one — `ceia_policy.user` became `user_ceia_policy_created_byTouser` the day
// `responsible_user_id` arrived, and the back-relation on `user` followed. That
// churn carries no column and is not the data loss this guard is after.
function extractModelFieldMap(schemaContent) {
  const modelNames = new Set(extractModelNames(schemaContent));
  const fieldsByModel = new Map();
  const modelRegex = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let match;

  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const [, modelName, body] = match;
    const fields = new Set();

    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

      // `image_scene_file_id Int?` is a column; `xp_area xp_area[]` is a relation.
      const fieldMatch = trimmed.match(/^(\w+)\s+(\w+)/);
      if (!fieldMatch) continue;

      const [, fieldName, fieldType] = fieldMatch;
      if (modelNames.has(fieldType)) continue;

      fields.add(fieldName);
    }

    fieldsByModel.set(modelName, fields);
  }

  return fieldsByModel;
}

function listMigrationFiles(ref) {
  const result = runGit(
    ['ls-tree', '-r', '--name-only', ref, '--', 'apps/api/prisma/migrations'],
    { allowFailure: true },
  );
  if (!result.ok) return [];

  return result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.endsWith('.sql'));
}

// A column dropped by a migration that master has and production does not is
// *supposed* to be gone from schema.prisma — that is what the migration is for.
// Without this, every intentional `DROP COLUMN` looks exactly like the silent
// rewrite the checks below hunt for (`20261025000000_lms_xp_drop_image_scene`
// is what first tripped it).
function collectIntentionalDrops(productionRef) {
  const productionMigrations = new Set(listMigrationFiles(productionRef));
  const masterOnly = listMigrationFiles('master').filter(
    (file) => !productionMigrations.has(file),
  );
  const columns = new Set();
  const tables = new Set();

  for (const file of masterOnly) {
    const sql = runGit(['show', `master:${file}`], { allowFailure: true });
    if (!sql.ok) continue;

    for (const rawStatement of sql.stdout.split(';')) {
      const statement = rawStatement.replace(/--[^\n]*/g, '');

      const dropTable = statement.match(/\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/i);
      if (dropTable) tables.add(dropTable[1].toLowerCase());

      const alterTable = statement.match(
        /\bALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?(?:ONLY\s+)?"?(\w+)"?/i,
      );
      if (!alterTable) continue;

      const table = alterTable[1].toLowerCase();
      if (/\bRENAME\s+TO\b/i.test(statement)) tables.add(table);

      for (const [, column] of statement.matchAll(
        /\bDROP\s+COLUMN\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/gi,
      )) {
        columns.add(`${table}.${column.toLowerCase()}`);
      }

      for (const [, column] of statement.matchAll(/\bRENAME\s+COLUMN\s+"?(\w+)"?\s+TO\b/gi)) {
        columns.add(`${table}.${column.toLowerCase()}`);
      }
    }
  }

  return { columns, tables };
}

function ensurePrismaSchemaIsComplete() {
  const schemaPath = 'apps/api/prisma/schema.prisma';
  const masterSchema = readSchemaAtRef('master');

  if (masterSchema === null) {
    throw new Error(
      `Could not read ${schemaPath} from master.\n` +
      '     Aborting promotion — cannot verify the Prisma schema is intact.',
    );
  }

  const masterModels = extractModelNames(masterSchema);

  if (masterModels.length === 0) {
    throw new Error(
      `${schemaPath} on master has 0 models — it looks like the stub written by\n` +
      '     scripts/reset-prisma-schema.ts before `prisma db pull` (this happened for\n' +
      '     real in commit 8a1a11c39). Run `pnpm prisma:update` in apps/api and commit\n' +
      '     the regenerated schema before promoting.',
    );
  }

  if (process.env.ALLOW_SCHEMA_MODEL_DROP) return;

  const productionRef = hasRemoteBranch('production')
    ? 'origin/production'
    : hasLocalBranch('production')
      ? 'production'
      : null;
  if (!productionRef) return;

  const productionSchema = readSchemaAtRef(productionRef);
  if (productionSchema === null) return;

  const intentionalDrops = collectIntentionalDrops(productionRef);

  const productionModels = extractModelNames(productionSchema);
  const masterModelSet = new Set(masterModels);
  const missing = productionModels.filter(
    (name) => !masterModelSet.has(name) && !intentionalDrops.tables.has(name.toLowerCase()),
  );

  if (missing.length > 0) {
    throw new Error(
      `${schemaPath} on master is missing ${missing.length} model(s) present in production:\n` +
      missing.map((name) => `       - ${name}`).join('\n') + '\n' +
      '     This usually means a bad merge conflict resolution or a stale schema.prisma.\n' +
      '     If this drop is intentional, retry with ALLOW_SCHEMA_MODEL_DROP=1.',
    );
  }

  // A model can survive the check above and still have lost individual fields —
  // that's exactly how `ceia_meeting` lost `meeting_provider`/`auto_record`/etc. in
  // commit 376f7453d: `pnpm db:update` ran against a local database that hadn't
  // applied a recent migration yet, and `prisma db pull` silently rewrote the
  // model without the missing columns.
  const masterFieldMap = extractModelFieldMap(masterSchema);
  const productionFieldMap = extractModelFieldMap(productionSchema);
  const droppedFieldsByModel = [];

  for (const [modelName, productionFields] of productionFieldMap) {
    const masterFields = masterFieldMap.get(modelName);
    if (!masterFields) continue; // already reported above as a fully missing model

    const droppedFields = [...productionFields].filter(
      (name) =>
        !masterFields.has(name) &&
        !intentionalDrops.columns.has(`${modelName.toLowerCase()}.${name.toLowerCase()}`),
    );
    if (droppedFields.length > 0) {
      droppedFieldsByModel.push({ modelName, droppedFields });
    }
  }

  if (droppedFieldsByModel.length > 0) {
    throw new Error(
      `${schemaPath} on master is missing field(s) present in production for existing model(s):\n` +
      droppedFieldsByModel
        .map(({ modelName, droppedFields }) => `       - ${modelName}: ${droppedFields.join(', ')}`)
        .join('\n') + '\n' +
      '     This usually means `pnpm db:update` ran against a local database that had not\n' +
      '     applied a recent migration yet, silently rewriting schema.prisma without the\n' +
      '     missing columns (this happened for real in commit b4f4d9b08). Run\n' +
      '     `pnpm prisma:deploy` in apps/api BEFORE `pnpm db:update`, then recommit.\n' +
      '     Columns a migration that only master has already dropped are allowed, so\n' +
      '     none of the above is explained by a migration waiting to be promoted.\n' +
      '     If this drop is intentional, retry with ALLOW_SCHEMA_MODEL_DROP=1.',
    );
  }
}

function extractEnumNames(schemaContent) {
  const matches = schemaContent.match(/^enum\s+(\w+)/gm) || [];
  return matches.map((line) => line.replace(/^enum\s+/, ''));
}

// Uma migration nova nao pode descobrir o grupo de uma setting lendo OUTRA setting.
//
// Foi assim que 20261214000000_operations_public_task_intake derrubou o deploy: ela
// lia "group_id" de `setting` pelo slug 'operations.comment-edit-window', que existe
// no YAML e no banco local mas nao em producao — YAML semeia instalacao nova, nao
// atualiza base existente. O build local passa, o migrate em producao morre com
// P3018 / P0001, e o deploy inteiro para com os outros jobs em skipped.
//
// A fonte de verdade e o proprio grupo: `SELECT id FROM "setting_group" WHERE slug`.
// Uma setting pode ser apagada pela tela; o grupo do modulo, nao.
//
// So vale para migration NOVA (em master, ausente em origin/production): 25 migrations
// ja aplicadas usam o padrao antigo, e reescrever uma delas mudaria o checksum que o
// Prisma guarda em _prisma_migrations.
// Pura de proposito: e o coracao da regra, e assim da para testar contra as migrations
// reais (a que quebrou deve acusar, as corrigidas devem passar) sem mexer em git.
//
// Procura a coluna "group_id" sendo lida DA TABELA `setting`. Ler `id` ou `value` de uma
// setting e comum e legitimo; ler o grupo dela e que e a armadilha. `[^;]*` prende o
// casamento a um unico comando.
function migrationResolvesGroupFromSibling(sql) {
  if (/^[ \t]*--[ \t]*settings-group-source-ok:/m.test(sql)) return false;

  // Comentario fora antes de casar, pela mesma razao que readAllMigrationSql faz:
  // senao o proprio texto que explica a armadilha casa com ela, e a migration acaba
  // servindo de fiadora de si mesma.
  const code = sql.replace(/--[^\n]*/g, '');
  return /SELECT[^;]*"group_id"[^;]*\bINTO\b[^;]*FROM\s+"setting"\s+WHERE/i.test(code);
}

function ensureNewMigrationsResolveSettingGroup() {
  if (process.env.ALLOW_SETTING_GROUP_FROM_SIBLING) return;

  const repoRoot = runGit(['rev-parse', '--show-toplevel']).stdout;
  const diff = runGit(
    ['diff', '--name-only', '--diff-filter=A', 'origin/production...master', '--',
      'apps/api/prisma/migrations'],
    { allowFailure: true }
  );
  if (!diff.stdout) return;

  const offenders = [];
  for (const rel of diff.stdout.split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (!rel.endsWith('migration.sql')) continue;
    const file = path.join(repoRoot, rel);
    if (!fs.existsSync(file)) continue;

    if (migrationResolvesGroupFromSibling(fs.readFileSync(file, 'utf8'))) {
      offenders.push(rel);
    }
  }

  if (offenders.length > 0) {
    throw new Error(
      `${offenders.length} new migration(s) resolve a settings group by reading another setting:\n` +
      offenders.map((rel) => `       - ${rel}`).join('\n') + '\n' +
      '     That sibling setting may be absent in production, and the migration then dies\n' +
      '     there with P3018 / P0001 while passing locally — that is how the whole deploy\n' +
      '     went down on 2026-09-17. Resolve the group from the source of truth instead:\n' +
      '       SELECT id INTO v_group_id FROM "setting_group" WHERE "slug" = \'<module>\';\n' +
      '     If inheriting from a sibling really is what you want, say so in the migration\n' +
      '     with a line `-- settings-group-source-ok: <reason>`.'
    );
  }
}

// Tabelas em que um lock segurado durante o deploy derruba a API inteira: grandes, ou
// escritas a cada requisicao. Criterio para entrar na lista e esse, nao o tamanho em si.
//
// O Prisma roda cada migration.sql numa transacao so, entao TODO lock tomado nela vale
// ate o fim do arquivo. Em 2026-10-06, 20270402000000_core_service_account fez
// ADD COLUMN (ACCESS EXCLUSIVE) + CREATE INDEX + FOREIGN KEY validada em `access_log`:
// 24s de lock, e como toda requisicao grava em access_log, as 5 conexoes de cada pod
// ficaram presas esperando — pool esgotado em todos os pods no mesmo segundo
// (Sentry 7692792694, que estourou numa rota que nem toca access_log).
const HOT_TABLES = ['access_log'];

// Pura de proposito, como migrationResolvesGroupFromSibling: da para testar contra as
// migrations reais sem git. Devolve os comandos que acusam (vazio = passa).
//
// O que acusa, sempre numa tabela de HOT_TABLES — o que torna a migration LONGA
// segurando o lock:
//   - CREATE INDEX sem CONCURRENTLY (le a tabela inteira);
//   - FOREIGN KEY sem NOT VALID, nela ou apontando para ela (valida linha a linha, e
//     a FK trava as duas pontas);
//   - ALTER COLUMN ... TYPE (reescreve a tabela).
function migrationLocksHotTable(sql) {
  if (/^[ \t]*--[ \t]*hot-table-lock-ok:/m.test(sql)) return [];

  const code = sql.replace(/--[^\n]*/g, '');
  const table = `(?:"?public"?\\.)?"?(${HOT_TABLES.join('|')})"?(?![\\w"])`;
  const alterHot = new RegExp(`\\bALTER\\s+TABLE\\s+(?:IF\\s+EXISTS\\s+)?(?:ONLY\\s+)?${table}`, 'i');
  const indexHot = new RegExp(
    `\\bCREATE\\s+(?:UNIQUE\\s+)?INDEX\\b(?!\\s+CONCURRENTLY)[\\s\\S]*?\\bON\\s+(?:ONLY\\s+)?${table}`,
    'i',
  );
  const referencesHot = new RegExp(`\\bREFERENCES\\s+${table}`, 'i');

  // `;` corta tambem dentro de bloco DO $$ … $$, e e isso que se quer: o ALTER TABLE
  // la dentro vira um fragmento proprio.
  const offenders = [];
  for (const raw of code.split(';')) {
    const stmt = raw.replace(/\s+/g, ' ').trim();
    if (!stmt) continue;

    const alter = stmt.match(alterHot);
    const index = stmt.match(indexHot);
    const isFk = /\bFOREIGN\s+KEY\b/i.test(stmt) && !/\bNOT\s+VALID\b/i.test(stmt);

    let reason = null;
    if (index) reason = `CREATE INDEX without CONCURRENTLY on ${index[1]}`;
    else if (isFk && (alter || referencesHot.test(stmt))) {
      reason = `FOREIGN KEY without NOT VALID touching ${(alter || stmt.match(referencesHot))[1]}`;
    } else if (alter && /\bALTER\s+COLUMN\s+"?\w+"?\s+(?:SET\s+DATA\s+)?TYPE\b/i.test(stmt)) {
      reason = `ALTER COLUMN ... TYPE on ${alter[1]}`;
    }

    if (reason) offenders.push(`${reason}: ${stmt.replace(/^DO \$\$ BEGIN /i, '').slice(0, 140)}`);
  }
  return offenders;
}

function ensureNewMigrationsAvoidHotTableLocks() {
  if (process.env.ALLOW_HOT_TABLE_LOCK) return;

  const repoRoot = runGit(['rev-parse', '--show-toplevel']).stdout;
  const diff = runGit(
    ['diff', '--name-only', '--diff-filter=A', 'origin/production...master', '--',
      'apps/api/prisma/migrations'],
    { allowFailure: true }
  );
  if (!diff.stdout) return;

  const offenders = [];
  for (const rel of diff.stdout.split('\n').map((l) => l.trim()).filter(Boolean)) {
    if (!rel.endsWith('migration.sql')) continue;
    const file = path.join(repoRoot, rel);
    if (!fs.existsSync(file)) continue;

    const found = migrationLocksHotTable(fs.readFileSync(file, 'utf8'));
    if (found.length > 0) offenders.push({ rel, found });
  }

  if (offenders.length > 0) {
    throw new Error(
      `${offenders.length} new migration(s) hold a long lock on a hot table (${HOT_TABLES.join(', ')}):\n` +
      offenders
        .map(({ rel, found }) => `       - ${rel}\n` + found.map((f) => `           ${f}`).join('\n'))
        .join('\n') + '\n' +
      '     Prisma runs the whole file in one transaction, so the lock lasts until the end of\n' +
      '     the migration and every request writing that table waits holding a pool\n' +
      '     connection — on 2026-10-06 that was 24s of pool exhaustion on every API pod.\n' +
      '     Instead:\n' +
      '       - index: run `CREATE INDEX CONCURRENTLY IF NOT EXISTS ...` by hand in production\n' +
      '         before the deploy; the migration keeps `CREATE INDEX IF NOT EXISTS` and it\n' +
      '         becomes a no-op;\n' +
      '       - FK: add it `NOT VALID` here and `VALIDATE CONSTRAINT` in a migration of its\n' +
      '         own (SHARE UPDATE EXCLUSIVE, does not block writes);\n' +
      '       - keep the hot-table DDL in a short migration, apart from slow statements.\n' +
      '     If the index already exists in production, say so with a line\n' +
      '     `-- hot-table-lock-ok: <reason>`, or retry with ALLOW_HOT_TABLE_LOCK=1.'
    );
  }
}

// Read from disk rather than from a git ref: ensureCleanWorkingTree has already run
// and the promotion is of master, so the working tree *is* the ref being checked —
// and this is one pass instead of a `git show` per migration, of which there are ~400.
function readAllMigrationSql() {
  const repoRoot = runGit(['rev-parse', '--show-toplevel']).stdout;
  const migrationsDir = path.join(repoRoot, 'apps', 'api', 'prisma', 'migrations');
  if (!fs.existsSync(migrationsDir)) return null;

  const parts = [];
  for (const entry of fs.readdirSync(migrationsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(migrationsDir, entry.name, 'migration.sql');
    if (!fs.existsSync(file)) continue;
    parts.push(fs.readFileSync(file, 'utf8'));
  }

  // Line comments have to go before anything is matched: `7f3a9c1e5b` — the very
  // name this guard exists to catch — is quoted inside the comment header of
  // 20261025000000_ceia_policy_status, and would otherwise vouch for itself.
  // Same treatment collectIntentionalDrops already gives statements above.
  return parts.join('\n').replace(/--[^\n]*/g, '');
}

// Every enum in schema.prisma names a Postgres type that Prisma sends verbatim in
// the INSERT cast — the schema has no `@@map` anywhere — so an enum no migration
// creates is a 42704 waiting for the first write to that table.
//
// The names carry a hash from the hedhog YAML generator that is per generation
// *round*, not per content (`enterprise_activity_model` and
// `course_class_assignment_task_status` share `d4f6a8c0e2` with different tables and
// different values). Meanwhile `predev`/`prebuild` in apps/api run
// `reset-prisma-schema.ts && prisma db pull`, so the committed schema.prisma mirrors
// whichever local database ran `dev`/`build` last — a machine whose type came from a
// generator round instead of from the migration commits a name no migrated database
// has. That is how `enterprise_activity_model_7f3a9c1e5b_enum` shipped in 158e1589d
// and broke `POST /lms/enterprise` in production (Sentry API-1M) while reads kept
// working: the model and the field both survived, so every check above waved it through.
function ensurePrismaEnumTypesExist(ref = 'master') {
  if (process.env.ALLOW_SCHEMA_ENUM_DRIFT) return;

  const schema = readSchemaAtRef(ref);
  if (schema === null) return; // ensurePrismaSchemaIsComplete already threw

  const enumNames = extractEnumNames(schema);
  if (enumNames.length === 0) return;

  const sql = readAllMigrationSql();
  if (sql === null) return;

  const declared = new Set(sql.match(/[A-Za-z_][A-Za-z0-9_]*/g) || []);
  const missing = enumNames.filter((name) => {
    if (declared.has(name)) return false;
    // Postgres truncates identifiers at 63 bytes, so a `CREATE TYPE` emitting
    // `course_class_assignment_task_attachment_author_role_9c2e5a71b4_enum` (67) is
    // read back by `db pull` as its 63-char prefix. The substring fallback also
    // covers names a migration only ever builds through `format('ALTER TYPE %I …')`.
    return !sql.includes(name);
  });

  if (missing.length > 0) {
    const scope = ref === 'master' ? 'on master' : `at ${ref}`;
    throw new Error(
      `apps/api/prisma/schema.prisma ${scope} declares ${missing.length} enum(s) that no migration creates:\n` +
      missing.map((name) => `       - ${name}`).join('\n') + '\n' +
      '     Prisma casts every enum parameter to this exact type name, so the first INSERT\n' +
      '     touching the column fails with Postgres 42704 while reads keep working — that is\n' +
      '     how enterprise_activity_model_7f3a9c1e5b_enum broke POST /lms/enterprise in\n' +
      '     production (Sentry API-1M).\n' +
      '     The hash in the name is per generation round of the hedhog YAML generator, and\n' +
      '     `predev`/`prebuild` in apps/api rewrite schema.prisma from the local database via\n' +
      '     `prisma db pull`. Run `pnpm prisma:deploy` in apps/api so the local database has\n' +
      '     the type the migration actually creates, then regenerate and recommit the schema.\n' +
      '     If this drift is intentional, retry with ALLOW_SCHEMA_ENUM_DRIFT=1.',
    );
  }
}

function ensureOriginRemote() {
  const hasOrigin = runGit(['remote', 'get-url', 'origin'], { allowFailure: true }).ok;
  if (!hasOrigin) {
    throw new Error('Remote "origin" is not configured for this repository.');
  }
}

function ensureInsideGitRepo() {
  const inside = runGit(['rev-parse', '--is-inside-work-tree']);
  if (inside.stdout !== 'true') {
    throw new Error('Current directory is not inside a git repository.');
  }
}

function getCurrentBranch() {
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']).stdout;
  if (branch === 'HEAD') {
    throw new Error('Detached HEAD state is not supported. Checkout a branch first.');
  }
  return branch;
}

function tryReturnToMaster() {
  try {
    const current = getCurrentBranch();
    if (current !== 'master') {
      printStep('Returning to master');
      switchBranch('master');
      printDone();
    }
  } catch (err) {
    printWarning(`Could not switch back to master automatically: ${err.message}`);
  }
}

// ─── Pre-deploy build ─────────────────────────────────────────────────────────

// queue-workers has no app folder: it redeploys the hub-api image.
const BUILD_TARGET_BY_APP = {
  api: 'api',
  'queue-workers': 'api',
  admin: 'admin',
  class: 'class',
  partners: 'partners',
  training: 'training',
  hedhog: 'hedhog',
  'hcode-site': 'hcode-site',
  'hcode-store': 'hcode-store',
  brclick: 'brclick',
};

const API_BUILD_HINT =
  'If it failed with EPERM on query_engine-windows.dll.node, the api dev server\n' +
  '     (port 3100) is holding the Prisma engine — stop it and retry.';

// `nest build` type-checks the whole monorepo (every library + package) in one
// non-incremental tsc pass — deleteOutDir wipes the previous tsbuildinfo on every
// run, so it never gets to reuse incremental state. That pass alone can exceed
// V8's default old-space ceiling (~4GB) even when the machine has memory to spare.
const API_BUILD_NODE_OPTIONS = '--max-old-space-size=8192';

function runBuildStep(args, { cwd, hint, extraNodeOptions } = {}) {
  const command = ['pnpm', ...args].join(' ');
  console.log(`     ${paint(c.gray, '$')}  ${paint(c.dim, command)}`);

  const env = extraNodeOptions
    ? {
        ...process.env,
        NODE_OPTIONS: [process.env.NODE_OPTIONS, extraNodeOptions].filter(Boolean).join(' '),
      }
    : process.env;

  // shell: true is required on Windows to resolve pnpm.cmd, and the command goes
  // as a single string to avoid DEP0190 (args are concatenated, not escaped).
  // Every token comes from BUILD_TARGET_BY_APP, never from raw user input.
  const result = spawnSync(command, { cwd, env, stdio: 'inherit', shell: true });

  if (result.error) {
    throw new Error(`Failed to execute ${command}: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(
      `Build failed: ${command} (exit code ${result.status}).\n` +
      '     Nothing was pushed — production is untouched.\n' +
      (hint ? `     ${hint}\n` : '') +
      '     Fix the build, or retry with --skip-build if it was already validated.',
    );
  }
}

function runPreDeployBuild(requestedApps) {
  const apps = requestedApps.length > 0 ? requestedApps : Object.keys(BUILD_TARGET_BY_APP);
  const targets = [...new Set(apps.map((app) => BUILD_TARGET_BY_APP[app]))];
  const cwd = runGit(['rev-parse', '--show-toplevel']).stdout;
  const nextApps = targets.filter((target) => target !== 'api');

  if (nextApps.length > 0) {
    printStepBlock(`Building ${nextApps.join(', ')}`);
    runBuildStep(
      ['exec', 'turbo', 'run', 'build', ...nextApps.map((app) => `--filter=./apps/${app}`)],
      { cwd },
    );
    printBlockDone(`${nextApps.length} app(s) built`);
  }

  if (targets.includes('api')) {
    printStepBlock('Building api');
    // Mirrors apps/api/Dockerfile, which runs `build:docker` instead of `build`:
    // the api's own `build` triggers a `prebuild` with `prisma db pull`, which
    // rewrites schema.prisma from the local database. `exec` skips that hook.
    runBuildStep(['run', 'build:libs'], { cwd, hint: API_BUILD_HINT, extraNodeOptions: API_BUILD_NODE_OPTIONS });
    runBuildStep(['--filter', './apps/api', 'exec', 'nest', 'build'], {
      cwd,
      hint: API_BUILD_HINT,
      extraNodeOptions: API_BUILD_NODE_OPTIONS,
    });
    runBuildStep(['--filter', './apps/api', 'run', 'copy:core-assets'], { cwd, hint: API_BUILD_HINT });
    printBlockDone('api built');
  }
}

// `next build` rewrites next-env.d.ts — it flips the routes.d.ts import between
// the `.next/dev` and `.next` paths — and the file is versioned in some apps, so
// it flip-flops forever between dev and build. The tree was verified clean before
// the build, so anything dirty now came from the build itself: restore the
// generated file instead of leaving it to fail the next promotion.
function restoreGeneratedNextEnvFiles() {
  const status = runGit(['status', '--porcelain']);
  // runGit trims stdout, so the porcelain status prefix is not a fixed width —
  // take the last field instead of slicing a fixed offset.
  const files = status.stdout
    .split('\n')
    .map((line) => line.trim().split(/\s+/).pop())
    .filter((file) => file && file.endsWith('next-env.d.ts'));

  if (files.length === 0) return;

  runGit(['restore', '--', ...files]);
  printInfo(`Restored generated file(s): ${files.join(', ')}`);
}

function ensureBuildDidNotDirtyTree() {
  const status = runGit(['status', '--porcelain']);
  if (status.stdout.length === 0) return;

  throw new Error(
    'The build changed files in the working tree:\n' +
    status.stdout.split('\n').map((line) => `       ${line.trim()}`).join('\n') + '\n' +
    '     Generated-but-versioned files (like apps/hedhog/content/docs/registry.ts)\n' +
    '     must be committed on master before promoting — a dirty tree here would\n' +
    '     leave them out of the merge into production.',
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function promote() {
  let productionCreatedNow = false;

  const VALID_APPS = [
    'api',
    'admin',
    'class',
    'partners',
    'training',
    'hedhog',
    'hcode-site',
    'hcode-store',
    'brclick',
    'queue-workers',
  ];
  const SKIP_BUILD_FLAGS = ['--skip-build', '--no-build'];

  const rawArgs = process.argv.slice(2);
  const flagArgs = rawArgs.filter((arg) => arg.startsWith('-'));
  const unknownFlags = flagArgs.filter((flag) => !SKIP_BUILD_FLAGS.includes(flag));

  if (unknownFlags.length > 0) {
    throw new Error(
      `Unknown flag(s): ${unknownFlags.join(', ')}.\n` +
      `     Valid flags: ${SKIP_BUILD_FLAGS.join(', ')}`,
    );
  }

  const skipBuild =
    flagArgs.some((flag) => SKIP_BUILD_FLAGS.includes(flag)) || Boolean(process.env.SKIP_BUILD);

  // An unquoted `api,admin` reaches this script either as separate argv entries
  // or as a single space-joined one, depending on the shell — accept both.
  const requested = rawArgs
    .filter((arg) => !arg.startsWith('-'))
    .flatMap((arg) => arg.split(/[\s,]+/))
    .map((app) => app.trim())
    .filter(Boolean);

  const invalid = requested.filter((a) => !VALID_APPS.includes(a));
  if (invalid.length > 0) {
    throw new Error(
      `Unknown app(s): ${invalid.join(', ')}.\n` +
      `     Valid options: ${VALID_APPS.join(', ')}`,
    );
  }

  const appsArg = requested.length > 0 ? requested.join(',') : null;
  // Um marcador por app, nao um marcador com virgulas dentro. Os gates do
  // deploy.yml casam o app inteiro entre colchetes — `contains(msg,
  // '[deploy:api]')` — entao `[deploy:api,admin]` nao casa com gate nenhum e
  // pula todos os jobs de deploy, deixando o merge em production sem build.
  const deployMarkers = requested.length > 0
    ? requested.map((app) => `[deploy:${app}]`).join(' ')
    : null;

  printBanner(appsArg, skipBuild);

  printStep('Validating git environment');
  runGit(['--version']);
  ensureInsideGitRepo();
  ensureOriginRemote();
  printDone();

  const startBranch = getCurrentBranch();
  printInfo(`Current branch: ${paint(c.cyan, startBranch)}`);

  printStep('Checking for uncommitted changes');
  ensureCleanWorkingTree();
  printDone('working tree clean');

  printStep('Fetching latest refs from origin');
  runGit(['fetch', 'origin', '--prune']);
  printDone();

  printStep('Ensuring master branch exists');
  ensureMasterExists();
  printDone();

  printStep('Checking Prisma schema on master');
  ensurePrismaSchemaIsComplete();
  ensurePrismaEnumTypesExist();
  ensureNewMigrationsResolveSettingGroup();
  ensureNewMigrationsAvoidHotTableLocks();
  printDone();

  if (skipBuild) {
    printWarning('Local build skipped — the apps were not compiled before the push.');
  } else {
    // What gets deployed is the local `master`, not the branch you happen to be
    // on, so build from master. The working tree was verified clean above.
    if (getCurrentBranch() !== 'master') {
      printStep('Switching to master before building');
      switchBranch('master');
      printDone();
    }

    runPreDeployBuild(requested);

    restoreGeneratedNextEnvFiles();

    printStep('Checking the build left the working tree clean');
    ensureBuildDidNotDirtyTree();
    printDone('working tree clean');
  }

  const productionLocalExists = hasLocalBranch('production');
  const productionRemoteExists = hasRemoteBranch('production');

  printStep('Switching to production branch');
  if (productionLocalExists) {
    switchBranch('production');
    printDone('existing local branch');
  } else if (productionRemoteExists) {
    runGit(['switch', '--track', '-c', 'production', 'origin/production']);
    printDone('tracking origin/production');
  } else {
    switchBranch('master');
    runGit(['switch', '-c', 'production']);
    productionCreatedNow = true;
    printDone('new branch created');
  }

  if (productionRemoteExists && !productionCreatedNow) {
    printStep('Syncing production with origin');
    runGit(['reset', '--hard', 'origin/production']);
    printDone('reset to origin/production');
  }

  printStep('Merging master → production');
  const headBefore = runGit(['rev-parse', 'HEAD']).stdout;
  const mergeArgs = deployMarkers
    ? ['merge', '--no-ff', '-m', `chore: deploy to production ${deployMarkers}`, 'master']
    : ['merge', '--no-ff', '--no-edit', 'master'];
  const mergeResult = runGit(mergeArgs, { allowFailure: true });

  if (!mergeResult.ok) {
    runGit(['merge', '--abort'], { allowFailure: true });
    throw new Error(
      'Merge conflict detected while merging master into production.\n' +
      '     Resolve conflicts manually and retry.',
    );
  }

  const headAfter = runGit(['rev-parse', 'HEAD']).stdout;
  const alreadyUpToDate = headBefore === headAfter;

  if (alreadyUpToDate) {
    printDone('already up to date');
    printInfo('No new commits from master — creating redeploy commit to trigger CI');
    const redeployMsg = deployMarkers
      ? `chore: redeploy ${deployMarkers}`
      : 'chore: redeploy all apps';
    runGit(['commit', '--allow-empty', '-m', redeployMsg]);
  } else {
    printDone();
  }

  printStep('Pushing production to origin');
  if (productionCreatedNow || !productionRemoteExists) {
    runGit(['push', '-u', 'origin', 'production']);
  } else {
    runGit(['push', 'origin', 'production']);
  }
  printDone();

  switchBranch('master');
  printSuccess(appsArg);
}

// Guarded so that requiring this file does not promote anything — the schema checks
// are worth exercising on their own, and `node -e "require(...)"` used to start a real
// promotion.
if (require.main === module) {
  try {
    promote();
  } catch (error) {
    closeStepWithError();
    process.stderr.write(
      `\n  ${paintE(ce.red, '✗')}  ${paintE(ce.red + ce.bold, 'Error:')}  ${paintE(ce.red, error.message)}\n\n`,
    );
    tryReturnToMaster();
    process.exitCode = 1;
  }
}

module.exports = {
  ensurePrismaSchemaIsComplete,
  ensurePrismaEnumTypesExist,
  migrationResolvesGroupFromSibling,
  migrationLocksHotTable,
};
