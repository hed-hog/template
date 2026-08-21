#!/usr/bin/env node
/**
 * Traz as mudancas de baseline do projeto de trabalho (hub) para este template,
 * via `hedhog dev update-bootstrap`, que e guiado pelo `bootstrap.sync.json`.
 *
 * O comando roda com cwd no HUB (a origem) e escreve neste repositorio
 * (o destino), entao este script so resolve os dois caminhos e delega.
 *
 * Uso:
 *   pnpm sync:bootstrap:check     # dry-run: mostra o plano, nao escreve nada
 *   pnpm sync:bootstrap           # aplica, pedindo confirmacao
 *   pnpm sync:bootstrap -- --yes  # aplica sem perguntar
 *
 * Origem, em ordem de precedencia:
 *   --source <caminho>
 *   $HEDHOG_HUB_PATH
 *   ../../hcodev/hub (relativo a este repositorio)
 *
 * IMPORTANTE: revise o plano antes de aplicar. O `include` do manifesto cobre
 * `apps/api/**` e `scripts/**` inteiros, entao codigo especifico do hub
 * (observabilidade, interceptors legados, scripts pontuais) aparece como
 * adicao. Rodar direto com --yes leva isso para o template.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const templateRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const argv = process.argv.slice(2);
const takeFlag = (name) => {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv.splice(index, 2)[1];
};
const hasFlag = (name) => {
  const index = argv.indexOf(name);
  if (index === -1) return false;
  argv.splice(index, 1);
  return true;
};

const sourceOverride = takeFlag('--source');
const check = hasFlag('--check');
const yes = hasFlag('--yes');
const verbose = hasFlag('--verbose');

const source = resolve(
  sourceOverride ??
    process.env.HEDHOG_HUB_PATH ??
    resolve(templateRoot, '..', '..', 'hcodev', 'hub'),
);

if (!existsSync(source)) {
  console.error(`Origem nao encontrada: ${source}`);
  console.error(
    'Informe com --source <caminho> ou defina HEDHOG_HUB_PATH.',
  );
  process.exit(1);
}

// Um projeto HedHog de verdade tem os dois; sem isso o update-bootstrap
// produziria um plano sem sentido.
for (const marker of ['apps/api', 'libraries']) {
  if (!existsSync(resolve(source, marker))) {
    console.error(`"${source}" nao parece um projeto HedHog: falta ${marker}/.`);
    process.exit(1);
  }
}

const args = ['dev', 'update-bootstrap', '--template', templateRoot];
if (check) args.push('--dry-run');
if (yes) args.push('--yes');
if (verbose) args.push('--verbose');

console.log(`origem:  ${source}`);
console.log(`destino: ${templateRoot}`);
console.log(`comando: hedhog ${args.join(' ')}\n`);

if (!check) {
  console.log(
    'Revise o plano antes de confirmar: adicoes especificas do hub nao\n' +
      'pertencem ao bootstrap. Use `pnpm sync:bootstrap:check` para so olhar.\n',
  );
}

// shell: true porque no Windows `hedhog` e um shim .cmd/.ps1. Com shell o
// comando vai como string unica (passar array dispara DEP0190), entao o unico
// argumento variavel — o caminho do template — vai entre aspas.
const quote = (value) => (/[\s"]/.test(value) ? `"${value}"` : value);
const command = `hedhog ${args.map(quote).join(' ')}`;

const child = spawn(command, {
  cwd: source,
  stdio: 'inherit',
  shell: true,
});

child.on('error', (error) => {
  console.error(`Falha ao executar o hedhog: ${error.message}`);
  console.error('Instale com: npm i -g @hed-hog/cli');
  process.exit(1);
});

child.on('close', (code) => process.exit(code ?? 1));
