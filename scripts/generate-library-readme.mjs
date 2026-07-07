#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const API_URL = process.env.DOCS_LLM_API_URL || 'https://api.openai.com/v1';
const API_MODEL = process.env.DOCS_LLM_MODEL || 'gpt-4.1-mini';
const API_KEY = process.env.DOCS_LLM_API_KEY;

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith('--')) continue;
    const key = item.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
    args[key] = value;
    if (value !== 'true') i += 1;
  }
  return args;
}

function run(command) {
  return execSync(command, { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
    .toString('utf8')
    .trim();
}

function safeRead(filePath) {
  return existsSync(filePath) ? readFileSync(filePath, 'utf8') : '';
}

function walkFiles(dirPath) {
  if (!existsSync(dirPath)) return [];
  const entries = readdirSync(dirPath, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full));
      continue;
    }
    out.push(full);
  }
  return out;
}

function toPosix(pathValue) {
  return pathValue.replace(/\\/g, '/');
}

function collectChangedLibraries(base, head) {
  const diff = run(`git diff --name-only ${base} ${head}`);
  if (!diff) return [];

  const files = diff.split('\n').map((line) => line.trim()).filter(Boolean);
  const libs = new Set();

  for (const file of files) {
    const normalized = toPosix(file);
    const match = normalized.match(/^libraries\/([^/]+)\//);
    if (!match) continue;

    const relevant =
      normalized.includes('/src/') ||
      normalized.includes('/hedhog/table/') ||
      normalized.endsWith('/hedhog/data/route.yaml') ||
      normalized.endsWith('/hedhog/data/role.yaml') ||
      normalized.endsWith('/package.json');

    if (relevant) libs.add(match[1]);
  }

  return Array.from(libs.values()).sort();
}

function listLibraryDirectories() {
  const librariesRoot = join(ROOT, 'libraries');
  if (!existsSync(librariesRoot)) return [];

  return readdirSync(librariesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function collectLibrariesMissingReadme() {
  const missing = [];

  for (const libraryName of listLibraryDirectories()) {
    const libraryPath = join(ROOT, 'libraries', libraryName);
    const readmePath = join(libraryPath, 'README.md');

    if (existsSync(readmePath)) continue;

    const hasSource = existsSync(join(libraryPath, 'src'));
    const hasTable = existsSync(join(libraryPath, 'hedhog', 'table'));

    if (hasSource || hasTable) {
      missing.push(libraryName);
    }
  }

  return missing;
}

function collectContextFiles(libraryName) {
  const basePath = join(ROOT, 'libraries', libraryName);
  const srcFiles = walkFiles(join(basePath, 'src')).filter((file) => {
    const normalized = toPosix(file);
    return (
      normalized.endsWith('.controller.ts') ||
      normalized.endsWith('.service.ts') ||
      normalized.includes('/dto/') ||
      normalized.endsWith('.module.ts') ||
      normalized.endsWith('/index.ts')
    );
  });

  const tableFiles = walkFiles(join(basePath, 'hedhog', 'table')).filter((file) =>
    file.endsWith('.yaml'),
  );

  const dataFiles = [
    join(basePath, 'hedhog', 'data', 'route.yaml'),
    join(basePath, 'hedhog', 'data', 'role.yaml'),
  ].filter((file) => existsSync(file));

  const packageJson = join(basePath, 'package.json');
  const files = [...srcFiles, ...tableFiles, ...dataFiles];
  if (existsSync(packageJson)) files.push(packageJson);

  return files;
}

function formatContext(files, maxChars = 180000) {
  let out = '';
  for (const file of files) {
    const rel = toPosix(file.replace(`${ROOT}\\`, '').replace(`${ROOT}/`, ''));
    const content = safeRead(file);
    const block = `\n\n### FILE: ${rel}\n\n\`\`\`\n${content}\n\`\`\`\n`;
    if ((out + block).length > maxChars) break;
    out += block;
  }
  return out;
}

async function generateReadme(libraryName, contextText, existingReadme) {
  if (!API_KEY) {
    throw new Error('Missing DOCS_LLM_API_KEY');
  }

  const system = [
    'Voce e um gerador tecnico de README para libraries do monorepo HedHog.',
    'Idioma: portugues brasileiro tecnico.',
    'Nao invente rotas/campos/regras fora do codigo fornecido.',
    'Use este template obrigatorio:',
    '1. Visao geral do modulo',
    '2. Escopo e responsabilidades',
    '3. Endpoints',
    '4. Regras de autenticacao e autorizacao',
    '5. Estruturas de request/response',
    '6. Erros comuns',
    '7. Banco de dados (tabelas YAML)',
    '8. Regras de negocio relevantes',
    '9. Guia rapido de uso (exemplos)',
  ].join('\n');

  const user = [
    `Modulo alvo: @hed-hog/${libraryName}`,
    'Tarefa: criar ou atualizar README do modulo.',
    'Se existir README atual, preserve o que estiver correto e atualize o necessario.',
    'Inclua para cada endpoint: metodo, path, auth/publica, descricao, params/query/body, resposta e erros.',
    'Inclua para cada tabela YAML: finalidade, colunas, defaults, nulabilidade, integridade, indices e enums.',
    existingReadme
      ? `README atual:\n\n\`\`\`markdown\n${existingReadme}\n\`\`\``
      : 'README atual: inexistente.',
    `Codigo fonte e YAMLs:\n${contextText}`,
    'Responda somente com o conteudo final do README em Markdown.',
  ].join('\n\n');

  const endpoint = `${API_URL.replace(/\/$/, '')}/chat/completions`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: API_MODEL,
      temperature: 0.1,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`LLM request failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('LLM returned empty content');
  }

  return content.endsWith('\n') ? content : `${content}\n`;
}

async function main() {
  const args = parseArgs(process.argv);
  const base = args.base || process.env.BASE_SHA;
  const head = args.head || process.env.HEAD_SHA || 'HEAD';
  const all = args.all === 'true';

  if (!all && !base) {
    console.log('No base SHA provided. Use --all or pass --base <sha>.');
    process.exit(0);
  }

  const libraries = all
    ? listLibraryDirectories()
    : Array.from(
        new Set([
          ...collectChangedLibraries(base, head),
          ...collectLibrariesMissingReadme(),
        ]),
      ).sort();

  if (libraries.length === 0) {
    console.log('No changed libraries detected.');
    process.exit(0);
  }

  console.log(`Libraries to document: ${libraries.join(', ')}`);

  for (const libraryName of libraries) {
    const libraryPath = join(ROOT, 'libraries', libraryName);
    const readmePath = join(libraryPath, 'README.md');

    if (!existsSync(libraryPath)) continue;

    const files = collectContextFiles(libraryName);
    if (files.length === 0) continue;

    const contextText = formatContext(files);
    const existingReadme = safeRead(readmePath);

    console.log(`Generating README for ${libraryName}...`);
    const markdown = await generateReadme(libraryName, contextText, existingReadme);

    if (!existsSync(libraryPath)) {
      mkdirSync(libraryPath, { recursive: true });
    }

    writeFileSync(readmePath, markdown, 'utf8');
  }

  console.log('README generation finished.');
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
