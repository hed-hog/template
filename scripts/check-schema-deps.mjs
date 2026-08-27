#!/usr/bin/env node
/**
 * Falha quando uma library tem FK para tabela de outra library sem declarar
 * dependencia dela no package.json.
 *
 * Por que importa: o `hedhog add <lib>` instala em profundidade, na ordem das
 * dependencias declaradas, e cria a migration de cada library logo depois de
 * resolver as dela. Sem a declaracao, a migration que cria o FK pode ganhar um
 * timestamp anterior ao da tabela referenciada, e o `prisma migrate deploy` do
 * projeto gerado morre no meio:
 *
 *   Error: P3018 ... ERROR: relation "tag" does not exist
 *
 * Foi o que aconteceu em 22/08/2026 com `crm` -> `tag`: seis outras libraries
 * estavam na mesma situacao, esperando a combinacao certa para quebrar.
 *
 * Uso: pnpm check:schema-deps
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const librariesDir = join(root, 'libraries');

if (!existsSync(librariesDir)) {
  console.log('Sem libraries/ neste repositorio: nada a verificar.');
  process.exit(0);
}

const libraries = readdirSync(librariesDir, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      existsSync(join(librariesDir, entry.name, 'package.json')),
  )
  .map((entry) => entry.name);

/** tabela -> library que a define (o nome do arquivo e o nome da tabela). */
const owner = new Map();
/** library -> tabelas que ela referencia por FK. */
const references = new Map();
/** library -> libraries declaradas no package.json. */
const declared = new Map();

for (const library of libraries) {
  const tableDir = join(librariesDir, library, 'hedhog', 'table');
  const referenced = new Set();

  if (existsSync(tableDir)) {
    for (const file of readdirSync(tableDir).filter((f) => f.endsWith('.yaml'))) {
      owner.set(file.replace(/\.yaml$/, ''), library);
      const body = readFileSync(join(tableDir, file), 'utf8');
      for (const match of body.matchAll(
        /references:\s*\n\s*table:\s*([A-Za-z0-9_]+)/g,
      )) {
        referenced.add(match[1]);
      }
    }
  }
  references.set(library, referenced);

  const pkg = JSON.parse(
    readFileSync(join(librariesDir, library, 'package.json'), 'utf8'),
  );
  const names = new Set();
  for (const name of Object.keys({
    ...pkg.dependencies,
    ...pkg.peerDependencies,
  })) {
    const match = /^@hed-hog(?:-pro)?\/(.+)$/.exec(name);
    if (match && libraries.includes(match[1])) names.add(match[1]);
  }
  declared.set(library, names);
}

// Um caminho indireto tambem garante a ordem, porque a instalacao e em profundidade.
function reachable(library, seen = new Set()) {
  for (const dependency of declared.get(library) ?? []) {
    if (seen.has(dependency)) continue;
    seen.add(dependency);
    reachable(dependency, seen);
  }
  return seen;
}

const findings = new Map();
for (const library of libraries) {
  const canReach = reachable(library);
  for (const table of references.get(library) ?? []) {
    const tableOwner = owner.get(table);
    if (!tableOwner || tableOwner === library || canReach.has(tableOwner)) {
      continue;
    }
    const key = `${library} -> ${tableOwner}`;
    if (!findings.has(key)) findings.set(key, new Set());
    findings.get(key).add(table);
  }
}

console.log(
  `${libraries.length} libraries verificadas, ${owner.size} tabelas mapeadas.`,
);

if (findings.size === 0) {
  console.log('Nenhuma dependencia de schema nao declarada.');
  process.exit(0);
}

console.error(`\n${findings.size} dependencia(s) de schema nao declarada(s):\n`);
for (const [pair, tables] of [...findings].sort()) {
  const [library, tableOwner] = pair.split(' -> ');
  console.error(`  libraries/${library}/package.json precisa declarar @hed-hog-pro/${tableOwner}`);
  console.error(`      FK para: ${[...tables].sort().join(', ')}`);
}
console.error(
  '\nSem a declaracao, a migration pode ser criada antes da tabela que ela referencia\n' +
    'e o `prisma migrate deploy` do projeto gerado falha com P3018.',
);
process.exit(1);
