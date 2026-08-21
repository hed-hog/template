#!/usr/bin/env node
// Copia libraries/*/hedhog/frontend/e2e/*.spec.ts.ejs para e2e/generated/*.spec.ts.
//
// Cada library dona de um módulo do admin traz seu próprio spec e2e junto do
// código-fonte (mesmo padrão de hedhog/frontend/{app,messages,public,widgets}).
// Rodar isso antes do Playwright garante que só entram specs de libraries que
// de fato existem em `libraries/` neste projeto — sem precisar consultar
// hedhog.json: se a library não estiver instalada, a pasta não existe e o
// glob simplesmente não encontra nada para ela.
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, copyFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const librariesDir = join(repoRoot, 'libraries');
const outDir = join(__dirname, 'generated');

export default async function generateSpecs() {
  rmSync(outDir, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });

  // Specs gerados importam `./support` (mesmo helper usado pelos specs
  // hand-authored) — copiamos para dentro de generated/ para que a pasta
  // fique autocontida e a importação relativa continue resolvendo.
  copyFileSync(join(__dirname, 'support.ts'), join(outDir, 'support.ts'));

  const libraryNames = existsSync(librariesDir)
    ? readdirSync(librariesDir).filter((name) => statSync(join(librariesDir, name)).isDirectory())
    : [];

  let count = 0;
  for (const name of libraryNames) {
    const e2eDir = join(librariesDir, name, 'hedhog', 'frontend', 'e2e');
    if (!existsSync(e2eDir)) continue;

    for (const file of readdirSync(e2eDir)) {
      if (!file.endsWith('.spec.ts.ejs')) continue;
      const target = join(outDir, basename(file, '.ejs'));
      copyFileSync(join(e2eDir, file), target);
      count++;
    }
  }

  console.log(`[e2e] ${count} spec(s) gerado(s) em e2e/generated a partir de libraries/*/hedhog/frontend/e2e`);
}

// Permite rodar standalone: node e2e/generate-specs.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await generateSpecs();
}
