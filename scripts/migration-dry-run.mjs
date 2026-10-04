#!/usr/bin/env node
//
// Roda cada migration nova contra o banco LOCAL dentro de BEGIN … ROLLBACK, duas
// vezes, e devolve o banco como estava.
//
// Por que existe: `prisma migrate deploy` e a unica forma de aplicar aqui, e um erro
// de sintaxe ou de tipo so aparece no meio da execucao -- quando a linha falhada ja
// esta gravada em `_prisma_migrations` e trava os proximos deploys com P3009. Rodar
// antes, numa transacao revertida, custa segundos.
//
// A segunda execucao e o teste de idempotencia. Importa mais do que parece neste
// repositorio: quando uma migration falha em producao, `migrate resolve --rolled-back`
// nao garante que ela volte para a fila, e a saida tem sido commitar uma copia com nome
// novo. Essa copia roda onde a original ja passou, entao tem de ser no-op.
//
// LIMITE, que vale dizer em voz alta: isto roda contra o estado do banco LOCAL. Uma
// migration que so quebra por causa de dados que existem aqui e nao em producao passa
// por este teste -- foi assim que 20261214000000_operations_public_task_intake foi para
// producao e derrubou o deploy de 2026-09-17. Para aquela classe quem responde e a
// checagem estatica de promote-production.js (ensureNewMigrationsResolveSettingGroup).
//
// Uso:
//   node scripts/migration-dry-run.mjs                      # migrations novas vs origin/production
//   node scripts/migration-dry-run.mjs <dir|arquivo> [...]   # alvos explicitos
//   node scripts/migration-dry-run.mjs --allow-non-idempotent

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrationsDir = path.join(repoRoot, 'apps', 'api', 'prisma', 'migrations');

const argv = process.argv.slice(2);
const allowNonIdempotent = argv.includes('--allow-non-idempotent');
const targets = argv.filter((a) => !a.startsWith('--'));

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envFile = path.join(repoRoot, 'apps', 'api', '.env');
  if (!fs.existsSync(envFile)) return null;
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"]+)"?\s*$/);
    if (m) return m[1];
  }
  return null;
}

// Migration nova = a que ainda nao esta em producao. Duas fontes, e as duas importam:
//
//   1. commitada em master e ausente em origin/production -- mesma conta que o
//      changed-apps.mjs da skill de deploy faz para descobrir o que vai subir;
//   2. ainda nao commitada (nova ou alterada na arvore de trabalho).
//
// Sem a segunda o script ignoraria justamente a migration que voce acabou de escrever,
// que e quando ele teria mais valor.
function newMigrationFiles() {
  const found = new Set();

  const committed = spawnSync(
    'git',
    ['diff', '--name-only', '--diff-filter=A', 'origin/production...master', '--',
      'apps/api/prisma/migrations'],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  if (committed.status !== 0) {
    const detail = (committed.stderr || '').trim();
    throw new Error(
      'Nao consegui comparar com origin/production' + (detail ? `: ${detail}` : '') +
      '\nRode `git fetch origin` antes, ou passe os caminhos das migrations como argumento.'
    );
  }
  for (const line of (committed.stdout || '').split('\n')) {
    const rel = line.trim();
    if (rel.endsWith('migration.sql')) found.add(path.join(repoRoot, rel));
  }

  // `-uall` lista o arquivo dentro de um diretorio novo; sem ele o git para no diretorio.
  const working = spawnSync(
    'git',
    ['status', '--porcelain', '-uall', '--', 'apps/api/prisma/migrations'],
    { cwd: repoRoot, encoding: 'utf8' }
  );
  for (const line of (working.stdout || '').split('\n')) {
    if (!line.trim()) continue;
    const rel = line.slice(3).trim().replace(/^"|"$/g, '');
    if (rel.endsWith('migration.sql')) found.add(path.join(repoRoot, rel));
  }

  return [...found].sort();
}

// Aceita o diretorio da migration ou o proprio .sql.
function resolveTarget(arg) {
  const candidates = [
    arg,
    path.join(arg, 'migration.sql'),
    path.join(migrationsDir, arg),
    path.join(migrationsDir, arg, 'migration.sql'),
  ];
  for (const c of candidates) {
    const abs = path.isAbsolute(c) ? c : path.join(repoRoot, c);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs;
  }
  throw new Error(`Migration nao encontrada: ${arg}`);
}

async function main() {
  const url = readDatabaseUrl();
  if (!url) {
    console.error('DATABASE_URL nao encontrada (env ou apps/api/.env).');
    process.exit(2);
  }

  let files;
  try {
    files = targets.length > 0 ? targets.map(resolveTarget) : newMigrationFiles();
  } catch (error) {
    console.error(error.message);
    process.exit(2);
  }

  if (files.length === 0) {
    console.log('Nenhuma migration nova para testar.');
    return;
  }

  const { Client } = require('pg');
  const client = new Client({ connectionString: url });
  await client.connect();
  console.log(`banco: ${url.replace(/:[^:@/]*@/, ':***@')}`);
  console.log(`${files.length} migration(s) para testar\n`);

  let failures = 0;
  for (const file of files) {
    const name = path.basename(path.dirname(file));
    const sql = fs.readFileSync(file, 'utf8');

    await client.query('BEGIN');
    try {
      await client.query(sql);
    } catch (error) {
      await client.query('ROLLBACK');
      console.log(`FALHOU  ${name}\n        1a execucao: ${error.message}`);
      failures++;
      continue;
    }

    let idempotent = true;
    let idempotencyError = '';
    try {
      await client.query(sql);
    } catch (error) {
      idempotent = false;
      idempotencyError = error.message;
    }
    await client.query('ROLLBACK');

    if (idempotent) {
      console.log(`OK      ${name}`);
    } else if (allowNonIdempotent) {
      console.log(`AVISO   ${name}\n        nao e idempotente: ${idempotencyError}`);
    } else {
      console.log(
        `FALHOU  ${name}\n        2a execucao: ${idempotencyError}\n` +
        '        Uma copia com nome novo roda onde a original ja passou, entao a migration\n' +
        '        precisa ser no-op na segunda vez. Use IF NOT EXISTS / ON CONFLICT DO NOTHING,\n' +
        '        ou repita com --allow-non-idempotent se isto for mesmo intencional.'
      );
      failures++;
    }
  }

  await client.end();
  console.log(
    failures === 0
      ? '\nTudo passou (transacoes revertidas, banco intacto).'
      : `\n${failures} migration(s) com problema.`
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(`ERRO: ${error.message}`);
  process.exit(2);
});
