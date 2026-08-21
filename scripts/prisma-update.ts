import { spawnSync } from 'child_process';
import * as path from 'path';

type CommandFailure = Error & {
  output?: string;
  status?: number | null;
};

const REPO_ROOT = path.resolve(__dirname, '..');
const API_ROOT = path.resolve(REPO_ROOT, 'apps', 'api');
const PNPM_COMMAND = 'pnpm';

function quoteArg(arg: string): string {
  if (/^[A-Za-z0-9_./:@-]+$/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '\\"')}"`;
}

function runCommand(
  args: string[],
  cwd: string,
  options?: { suppressOutputOnFailure?: boolean },
): void {
  const command = `${PNPM_COMMAND} ${args.map(quoteArg).join(' ')}`;
  const result = spawnSync(command, {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    shell: true,
  });

  const stdout = result.stdout ?? '';
  const stderr = result.stderr ?? '';
  const output = `${stdout}${stderr}`;

  if (result.error) {
    throw result.error;
  }

  if (result.status === 0) {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
    return;
  }

  if (!options?.suppressOutputOnFailure) {
    if (stdout) process.stdout.write(stdout);
    if (stderr) process.stderr.write(stderr);
  }

  const error = new Error(
    `Command failed with exit code ${result.status ?? 1}: ${command}`,
  ) as CommandFailure;

  error.output = output;
  error.status = result.status;

  throw error;
}

function isEmptyDatabaseError(output: string): boolean {
  return /P4001|The introspected database was empty|could not create any models/i.test(
    output,
  );
}

function printEmptyDatabaseMessage(): void {
  const line = '═'.repeat(78);

  console.error(`\n${line}`);
  console.error('\x1b[33m\x1b[1m🗄️  Banco de dados vazio detectado\x1b[0m');
  console.error(line);
  console.error(
    'A conexão com o banco funcionou, mas o Prisma não encontrou nenhuma tabela para introspectar.',
  );
  console.error(
    'Isso normalmente significa que o ambiente ainda não foi inicializado com a estrutura padrão do projeto.',
  );
  console.error('');
  console.error('\x1b[36mExecute os comandos abaixo na raiz do repositório:\x1b[0m');
  console.error('');
  console.error('  docker-compose up -d   # se o PostgreSQL ainda não estiver rodando');
  console.error('  hedhog dev apply       # cria as tabelas e popula os dados declarativos');
  console.error('  pnpm db:update         # sincroniza o Prisma schema/client');
  console.error('  pnpm start:admin       # tenta subir a aplicação novamente');
  console.error('');
  console.error('\x1b[90mDetalhe técnico: Prisma P4001 (database introspection found no tables).\x1b[0m');
  console.error(`${line}\n`);
}

function exitWithOriginalError(error: unknown): never {
  if (error instanceof Error) {
    const commandError = error as CommandFailure;

    if (commandError.output) {
      process.stderr.write(commandError.output);
    } else {
      console.error(error.message);
    }

    process.exit(commandError.status ?? 1);
  }

  console.error(error);
  process.exit(1);
}

function main(): void {
  try {
    runCommand(['exec', 'ts-node', '../../scripts/reset-prisma-schema.ts'], API_ROOT);

    try {
      runCommand(['exec', 'prisma', 'db', 'pull'], API_ROOT, {
        suppressOutputOnFailure: true,
      });
    } catch (error) {
      const output = (error as CommandFailure)?.output ?? '';

      if (isEmptyDatabaseError(output)) {
        printEmptyDatabaseMessage();
        process.exit((error as CommandFailure)?.status ?? 1);
      }

      exitWithOriginalError(error);
    }

    runCommand(['--filter', '@hed-hog/api-prisma', 'prisma:update'], REPO_ROOT);
    runCommand(['exec', 'prisma', 'generate'], API_ROOT);
  } catch (error) {
    exitWithOriginalError(error);
  }
}

main();
