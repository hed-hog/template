#!/usr/bin/env tsx

import { execSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { stdin as input, stdout as output } from 'node:process';
import { createInterface } from 'node:readline/promises';

// ANSI colors and styles
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
};

const log = {
  success: (msg: string) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  error: (msg: string) => console.error(`${colors.red}✗${colors.reset} ${msg}`),
  warn: (msg: string) => console.warn(`${colors.yellow}⚠${colors.reset} ${msg}`),
  info: (msg: string) => console.log(`${colors.cyan}ℹ${colors.reset} ${msg}`),
  section: (msg: string) => console.log(`\n${colors.bright}${colors.blue}═══ ${msg} ═══${colors.reset}`),
  title: (msg: string) => console.log(`${colors.bright}${colors.magenta}${msg}${colors.reset}`),
};

type Operation =
  | { type: 'copy'; sourceRelative: string; destRelative: string }
  | { type: 'delete'; destRelative: string };

function runGitCommand(command: string, cwd: string): string {
  return execSync(command, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  }).toString();
}

function getRepoRoot(): string {
  return runGitCommand('git rev-parse --show-toplevel', process.cwd()).trim();
}

function parseGitStatusPorcelain(repoRoot: string) {
  const output = runGitCommand('git status --porcelain=1', repoRoot);
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  const ops: Operation[] = [];

  for (const line of lines) {
    const status = line.slice(0, 2);
    const rawPath = line.slice(3);

    // Renamed: "R  old -> new", "RM old -> new", etc.
    if (rawPath.includes(' -> ')) {
      const parts = rawPath.split(' -> ').map((p) => p.trim());
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        console.warn(`[AVISO] Formato de renomeação inválido: ${rawPath}`);
        continue;
      }
      const [oldPath, newPath] = parts;

      ops.push({
        type: 'delete',
        destRelative: normalizeGitPath(oldPath),
      });

      ops.push({
        type: 'copy',
        sourceRelative: normalizeGitPath(newPath),
        destRelative: normalizeGitPath(newPath),
      });

      continue;
    }

    const filePath = normalizeGitPath(rawPath);

    // If there's a D in either column, the file was deleted
    if (status.includes('D')) {
      ops.push({
        type: 'delete',
        destRelative: filePath,
      });
      continue;
    }

    // Changed/added/untracked/modified/copied/etc. files
    ops.push({
      type: 'copy',
      sourceRelative: filePath,
      destRelative: filePath,
    });
  }

  return dedupeOperations(ops);
}

function normalizeGitPath(filePath: string): string {
  return filePath.replace(/\//g, path.sep).trim();
}

function dedupeOperations(ops: Operation[]): Operation[] {
  const deleteMap = new Map<string, Operation>();
  const copyMap = new Map<string, Operation>();

  for (const op of ops) {
    if (op.type === 'delete') {
      deleteMap.set(op.destRelative, op);
    } else {
      copyMap.set(op.destRelative, op);
    }
  }

  return [
    ...Array.from(deleteMap.values()).sort((a, b) =>
      a.destRelative.localeCompare(b.destRelative),
    ),
    ...Array.from(copyMap.values()).sort((a, b) =>
      a.destRelative.localeCompare(b.destRelative),
    ),
  ];
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureParentDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function copyFilePreserveStructure(
  repoRoot: string,
  destinationRoot: string,
  sourceRelative: string,
  destRelative: string,
): Promise<void> {
  const sourcePath = path.join(repoRoot, sourceRelative);
  const destPath = path.join(destinationRoot, destRelative);

  const exists = await pathExists(sourcePath);
  if (!exists) {
    console.warn(`[AVISO] Arquivo de origem não encontrado, pulando cópia: ${sourceRelative}`);
    return;
  }

  await ensureParentDir(destPath);
  await fs.copyFile(sourcePath, destPath);
}

async function deleteDestinationFile(
  destinationRoot: string,
  destRelative: string,
): Promise<void> {
  const destPath = path.join(destinationRoot, destRelative);

  if (!(await pathExists(destPath))) {
    console.warn(`[AVISO] Arquivo não existe no destino para deletar: ${destRelative}`);
    return;
  }

  await fs.rm(destPath, { force: true });
}

async function promptUser(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

function printPlan(
  repoRoot: string,
  destinationRoot: string,
  operations: Operation[],
): void {
  const deletes = operations.filter((op) => op.type === 'delete') as Extract<Operation, { type: 'delete' }>[];
  const copies = operations.filter((op) => op.type === 'copy') as Extract<Operation, { type: 'copy' }>[];

  log.section('ORIGEM');
  console.log(repoRoot);

  log.section('DESTINO');
  console.log(destinationRoot);

  log.section('RESUMO');
  log.info(`Copiar/sobrescrever: ${copies.length}`);
  log.info(`Deletar no destino:  ${deletes.length}`);
  log.info(`Total de operações: ${operations.length}`);

  if (copies.length > 0) {
    log.section('ARQUIVOS A COPIAR/SOBRESCREVER');
    for (const op of copies) {
      log.success(`COPY   ${op.sourceRelative}`);
    }
  }

  if (deletes.length > 0) {
    log.section('ARQUIVOS A DELETAR NO DESTINO');
    for (const op of deletes) {
      log.warn(`DELETE ${op.destRelative}`);
    }
  }
}

async function main(): Promise<void> {
  const repoRoot = getRepoRoot();
  process.chdir(repoRoot);

  const destinationInput = await promptUser('Informe o path da pasta de destino: ');
  if (!destinationInput) {
    console.error('Nenhum path de destino informado.');
    process.exit(1);
  }

  const destinationRoot = path.resolve(destinationInput);

  if (destinationRoot === repoRoot) {
    console.error('O destino não pode ser o mesmo diretório do repositório de origem.');
    process.exit(1);
  }

  const destinationExists = await pathExists(destinationRoot);
  if (!destinationExists) {
    console.error('A pasta de destino não existe.');
    process.exit(1);
  }

  const operations = parseGitStatusPorcelain(repoRoot);

  if (operations.length === 0) {
    console.log('Nenhuma alteração encontrada no git status.');
    return;
  }

  printPlan(repoRoot, destinationRoot, operations);

  const confirmation = (
    await promptUser('\nDeseja prosseguir? Digite "s" para continuar: ')
  ).toLowerCase();

  if (confirmation !== 's') {
    console.log('Operação cancelada pelo usuário.');
    return;
  }

  console.log('\nExecutando...\n');

  for (const op of operations) {
    try {
      if (op.type === 'delete') {
        await deleteDestinationFile(destinationRoot, op.destRelative);
        console.log(`${colors.red}DELETE OK${colors.reset}  ${op.destRelative}`);
      } else {
        await copyFilePreserveStructure(
          repoRoot,
          destinationRoot,
          op.sourceRelative,
          op.destRelative,
        );
        console.log(`${colors.green}COPY OK${colors.reset}    ${op.sourceRelative}`);
      }
    } catch (error) {
      console.error(
        `${colors.red}ERRO${colors.reset} em ${op.type === 'delete' ? op.destRelative : op.sourceRelative}:`,
        error,
      );
    }
  }

  console.log('\nConcluído.');
}

main().catch((error) => {
  console.error('Erro fatal:', error);
  process.exit(1);
});