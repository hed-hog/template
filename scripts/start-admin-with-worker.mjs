#!/usr/bin/env node

import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const cmdExecutable = process.env.ComSpec || 'cmd.exe';
const pnpmCmd = isWindows ? cmdExecutable : 'pnpm';
const children = [];
let isShuttingDown = false;

function startProcess(name, args, envOverrides = {}) {
  const commandArgs = isWindows ? ['/d', '/s', '/c', 'pnpm', ...args] : args;

  const child = spawn(pnpmCmd, commandArgs, {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...envOverrides,
    },
    stdio: 'inherit',
  });

  child.on('exit', (code, signal) => {
    if (isShuttingDown) return;

    const exitCode = code ?? (signal ? 1 : 0);
    console.error(`\n[${name}] exited (code=${code ?? 'null'}, signal=${signal ?? 'null'})`);

    if (exitCode !== 0) {
      shutdown(exitCode);
    }
  });

  child.on('error', (error) => {
    if (isShuttingDown) return;
    console.error(`\n[${name}] failed to start: ${error.message}`);
    shutdown(1);
  });

  children.push({ name, child });
  console.log(`[orchestrator] started ${name}`);
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('\n[orchestrator] stopping child processes...');

  for (const { name, child } of children) {
    if (!child.killed) {
      try {
        child.kill('SIGTERM');
      } catch {
        console.warn(`[orchestrator] could not SIGTERM ${name}`);
      }
    }
  }

  setTimeout(() => {
    for (const { name, child } of children) {
      if (!child.killed) {
        try {
          child.kill('SIGKILL');
        } catch {
          console.warn(`[orchestrator] could not SIGKILL ${name}`);
        }
      }
    }
    process.exit(exitCode);
  }, 4000);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startProcess('api-http', ['--filter', 'api', 'start:dev'], {
  PORT: process.env.API_HTTP_PORT || '3100',
  QUEUE_WORKER_ENABLED: 'false',
  QUEUE_DATABASE_ENABLED: 'true',
});

startProcess('api-worker-1', ['--filter', 'api', 'start:dev'], {
  PORT: process.env.API_WORKER_PORT || '3110',
  QUEUE_WORKER_ENABLED: 'true',
  QUEUE_DATABASE_ENABLED: 'true',
  QUEUE_WORKER_NAMES: process.env.QUEUE_WORKER_NAMES ?? '',
  QUEUE_WORKER_ID: process.env.QUEUE_WORKER_ID || '',
  QUEUE_WORKER_CONCURRENCY: process.env.QUEUE_WORKER_CONCURRENCY || '1',
  QUEUE_WORKER_HEARTBEAT_INTERVAL: process.env.QUEUE_WORKER_HEARTBEAT_INTERVAL || '10',
  QUEUE_WORKER_LOCK_TIMEOUT: process.env.QUEUE_WORKER_LOCK_TIMEOUT || '7200',
  QUEUE_WORKER_TOKEN_EXPECTED:
    process.env.QUEUE_WORKER_TOKEN_EXPECTED || process.env.QUEUE_WORKER_TOKEN || 'local-worker-token',
  QUEUE_WORKER_TOKEN: process.env.QUEUE_WORKER_TOKEN || 'local-worker-token',
  LMS_VIDEO_FFMPEG_TIMEOUT_MS: process.env.LMS_VIDEO_FFMPEG_TIMEOUT_MS || '3600000',
});

startProcess('api-worker-2', ['--filter', 'api', 'start:dev'], {
  PORT: process.env.API_WORKER_EMAIL_PORT || '3111',
  QUEUE_WORKER_ENABLED: 'true',
  QUEUE_DATABASE_ENABLED: 'true',
  QUEUE_WORKER_NAMES: process.env.QUEUE_WORKER_EMAIL_NAMES ?? '',
  QUEUE_WORKER_ID: process.env.QUEUE_WORKER_EMAIL_ID || '',
  QUEUE_WORKER_CONCURRENCY: process.env.QUEUE_WORKER_EMAIL_CONCURRENCY || '1',
  QUEUE_WORKER_HEARTBEAT_INTERVAL: process.env.QUEUE_WORKER_HEARTBEAT_INTERVAL || '10',
  QUEUE_WORKER_TOKEN_EXPECTED:
    process.env.QUEUE_WORKER_TOKEN_EXPECTED || process.env.QUEUE_WORKER_TOKEN || 'local-worker-token',
  QUEUE_WORKER_TOKEN: process.env.QUEUE_WORKER_TOKEN || 'local-worker-token',
});

startProcess('admin-frontend', ['--filter', 'admin', 'dev']);
