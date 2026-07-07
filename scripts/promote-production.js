#!/usr/bin/env node

const { spawnSync } = require('child_process');

// ─── Colors & output helpers ──────────────────────────────────────────────────

const TTY = process.stdout.isTTY;
const ETTY = process.stderr.isTTY;

const c = {
  reset: TTY ? '\x1b[0m' : '',
  bold: TTY ? '\x1b[1m' : '',
  dim: TTY ? '\x1b[2m' : '',
  red: TTY ? '\x1b[31m' : '',
  green: TTY ? '\x1b[32m' : '',
  yellow: TTY ? '\x1b[33m' : '',
  cyan: TTY ? '\x1b[36m' : '',
  gray: TTY ? '\x1b[90m' : '',
};

const ce = {
  reset: ETTY ? '\x1b[0m' : '',
  bold: ETTY ? '\x1b[1m' : '',
  red: ETTY ? '\x1b[31m' : '',
  yellow: ETTY ? '\x1b[33m' : '',
  gray: ETTY ? '\x1b[90m' : '',
};

function paint(color, text) {
  return `${color}${text}${c.reset}`;
}

function paintE(color, text) {
  return `${color}${text}${ce.reset}`;
}

const SEP = paint(c.dim, '─'.repeat(52));
let _stepActive = false;

function printBanner(appsArg) {
  const target = appsArg
    ? paint(c.cyan + c.bold, appsArg)
    : paint(c.cyan + c.bold, 'all apps');
  console.log('');
  console.log(
    `  🚀  ${paint(c.bold, 'Promoting')} ${paint(c.cyan, 'master')} → ${paint(c.cyan, 'production')}  ${paint(c.dim, '[target: ')}${target}${paint(c.dim, ']')}`
  );
  console.log(`  ${SEP}`);
}

function printStep(message) {
  process.stdout.write(
    `\n  ${paint(c.cyan, '◆')}  ${paint(c.bold, message)}...`
  );
  _stepActive = true;
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
  process.stderr.write(
    `\n  ${paintE(ce.yellow, '⚠')}  ${paintE(ce.yellow, message)}\n`
  );
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
  console.log(
    `  ${paint(c.green + c.bold, '✓')}  ${paint(c.green + c.bold, 'Production promotion completed successfully!')}`
  );
  console.log(
    `     ${paint(c.gray, '→')}  ${paint(c.dim, 'You are now on branch ')}${paint(c.cyan, 'master')}`
  );
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
    throw new Error(
      `Failed to execute git ${args.join(' ')}: ${result.error.message}`
    );
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
        '     Commit or stash your changes before running this script.'
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

function ensureOriginRemote() {
  const hasOrigin = runGit(['remote', 'get-url', 'origin'], {
    allowFailure: true,
  }).ok;
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
    throw new Error(
      'Detached HEAD state is not supported. Checkout a branch first.'
    );
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
    printWarning(
      `Could not switch back to master automatically: ${err.message}`
    );
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function promote() {
  let productionCreatedNow = false;

  // Adicione novos apps aqui conforme forem criados no projeto.
  const VALID_APPS = ['api', 'admin'];
  const appsArg = process.argv[2] || null;

  if (appsArg) {
    const requested = appsArg.split(',').map((a) => a.trim());
    const invalid = requested.filter((a) => !VALID_APPS.includes(a));
    if (invalid.length > 0) {
      throw new Error(
        `Unknown app(s): ${invalid.join(', ')}.\n` +
          `     Valid options: ${VALID_APPS.join(', ')}`
      );
    }
  }

  printBanner(appsArg);

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

  printStep('Merging master → production');
  const headBefore = runGit(['rev-parse', 'HEAD']).stdout;
  const mergeArgs = appsArg
    ? [
        'merge',
        '--no-ff',
        '-m',
        `chore: deploy to production [deploy:${appsArg}]`,
        'master',
      ]
    : ['merge', '--no-ff', '--no-edit', 'master'];
  const mergeResult = runGit(mergeArgs, { allowFailure: true });

  if (!mergeResult.ok) {
    runGit(['merge', '--abort'], { allowFailure: true });
    throw new Error(
      'Merge conflict detected while merging master into production.\n' +
        '     Resolve conflicts manually and retry.'
    );
  }

  const headAfter = runGit(['rev-parse', 'HEAD']).stdout;
  const alreadyUpToDate = headBefore === headAfter;

  if (alreadyUpToDate) {
    printDone('already up to date');
    printInfo(
      'No new commits from master — creating redeploy commit to trigger CI'
    );
    const redeployMsg = appsArg
      ? `chore: redeploy [deploy:${appsArg}]`
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
    `\n  ${paintE(ce.red, '✗')}  ${paintE(ce.red + ce.bold, 'Error:')}  ${paintE(ce.red, error.message)}\n\n`
  );
  tryReturnToMaster();
  process.exitCode = 1;
}
