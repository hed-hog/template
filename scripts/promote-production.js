#!/usr/bin/env node

const { spawnSync } = require('child_process');

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
function extractModelFieldMap(schemaContent) {
  const fieldsByModel = new Map();
  const modelRegex = /^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm;
  let match;

  while ((match = modelRegex.exec(schemaContent)) !== null) {
    const [, modelName, body] = match;
    const fields = new Set();

    for (const line of body.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('@@')) continue;

      const fieldMatch = trimmed.match(/^(\w+)\s/);
      if (fieldMatch) fields.add(fieldMatch[1]);
    }

    fieldsByModel.set(modelName, fields);
  }

  return fieldsByModel;
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

  const productionModels = extractModelNames(productionSchema);
  const masterModelSet = new Set(masterModels);
  const missing = productionModels.filter((name) => !masterModelSet.has(name));

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

    const droppedFields = [...productionFields].filter((name) => !masterFields.has(name));
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
      '     If this drop is intentional, retry with ALLOW_SCHEMA_MODEL_DROP=1.',
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
  brclick: 'brclick',
};

const API_BUILD_HINT =
  'If it failed with EPERM on query_engine-windows.dll.node, the api dev server\n' +
  '     (port 3100) is holding the Prisma engine — stop it and retry.';

function runBuildStep(args, { cwd, hint } = {}) {
  const command = ['pnpm', ...args].join(' ');
  console.log(`     ${paint(c.gray, '$')}  ${paint(c.dim, command)}`);

  // shell: true is required on Windows to resolve pnpm.cmd, and the command goes
  // as a single string to avoid DEP0190 (args are concatenated, not escaped).
  // Every token comes from BUILD_TARGET_BY_APP, never from raw user input.
  const result = spawnSync(command, { cwd, stdio: 'inherit', shell: true });

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
    runBuildStep(['run', 'build:libs'], { cwd, hint: API_BUILD_HINT });
    runBuildStep(['--filter', './apps/api', 'exec', 'nest', 'build'], { cwd, hint: API_BUILD_HINT });
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
