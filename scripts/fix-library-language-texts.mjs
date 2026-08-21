#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
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
  return execSync(command, {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .toString('utf8')
    .trim();
}

function runAllowEmpty(command) {
  try {
    return run(command);
  } catch {
    return '';
  }
}

function toPosix(pathValue) {
  return pathValue.replace(/\\/g, '/');
}

function escapePointerToken(token) {
  return token.replace(/~/g, '~0').replace(/\//g, '~1');
}

function unescapePointerToken(token) {
  return token.replace(/~1/g, '/').replace(/~0/g, '~');
}

function collectStringPointers(value, pointer = '', out = new Map()) {
  if (typeof value === 'string') {
    out.set(pointer || '/', value);
    return out;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      collectStringPointers(item, `${pointer}/${index}`, out);
    });
    return out;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      const escaped = escapePointerToken(key);
      collectStringPointers(item, `${pointer}/${escaped}`, out);
    });
  }

  return out;
}

function getByPointer(root, pointer) {
  if (pointer === '/' || pointer === '') return root;
  const tokens = pointer
    .split('/')
    .slice(1)
    .map((item) => unescapePointerToken(item));

  let cursor = root;
  for (const token of tokens) {
    if (cursor == null) return undefined;
    cursor = cursor[token];
  }
  return cursor;
}

function setByPointer(root, pointer, value) {
  if (pointer === '/' || pointer === '') {
    throw new Error('Root replacement is not supported');
  }

  const tokens = pointer
    .split('/')
    .slice(1)
    .map((item) => unescapePointerToken(item));

  const last = tokens.pop();
  if (!last) return;

  let cursor = root;
  for (const token of tokens) {
    if (cursor[token] == null) return;
    cursor = cursor[token];
  }

  cursor[last] = value;
}

function detectLanguageFromPath(filePath) {
  const normalized = toPosix(filePath);
  const fileName = normalized.split('/').pop() || '';
  const code = fileName.replace(/\.json$/i, '').toLowerCase();
  if (!code) return 'unknown';
  return code;
}

function extractPlaceholderTokens(text) {
  const patterns = [
    /\{\{[^{}]+\}\}/g,
    /\{[^{}]+\}/g,
    /%\d*\$?[sdif]/g,
    /%[sdif]/g,
    /:[a-zA-Z_][a-zA-Z0-9_]*/g,
    /<\/?[a-zA-Z][^>]*>/g,
  ];

  const tokens = [];
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) tokens.push(...matches);
  }

  return tokens.sort();
}

function sameTokenMultiset(a, b) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function applyCasePattern(sourceWord, targetWord) {
  if (sourceWord === sourceWord.toUpperCase()) {
    return targetWord.toUpperCase();
  }

  const first = sourceWord.charAt(0);
  const rest = sourceWord.slice(1);
  if (first === first.toUpperCase() && rest === rest.toLowerCase()) {
    return targetWord.charAt(0).toUpperCase() + targetWord.slice(1);
  }

  return targetWord;
}

function applyWordReplacements(text, replacements) {
  let result = text;

  for (const [from, to] of replacements) {
    const escapedFrom = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escapedFrom}\\b`, 'gi');
    result = result.replace(regex, (match) => applyCasePattern(match, to));
  }

  return result;
}

function applyPortugueseHeuristics(text) {
  const replacements = [
    ['catalogo', 'cat\u00e1logo'],
    ['titulo', 't\u00edtulo'],
    ['operacao', 'opera\u00e7\u00e3o'],
    ['operacoes', 'opera\u00e7\u00f5es'],
    ['distribuicao', 'distribui\u00e7\u00e3o'],
    ['descricao', 'descri\u00e7\u00e3o'],
    ['comparacao', 'compara\u00e7\u00e3o'],
    ['comparacoes', 'compara\u00e7\u00f5es'],
    ['configuracoes', 'configura\u00e7\u00f5es'],
    ['publicacao', 'publica\u00e7\u00e3o'],
    ['importacao', 'importa\u00e7\u00e3o'],
    ['importacoes', 'importa\u00e7\u00f5es'],
    ['relacoes', 'rela\u00e7\u00f5es'],
    ['dinamicos', 'din\u00e2micos'],
    ['logicos', 'l\u00f3gicos'],
    ['tecnicos', 't\u00e9cnicos'],
    ['generica', 'gen\u00e9rica'],
    ['rapidos', 'r\u00e1pidos'],
    ['rapido', 'r\u00e1pido'],
    ['unico', '\u00fanico'],
    ['dominios', 'dom\u00ednios'],
    ['modulo', 'm\u00f3dulo'],
    ['modulos', 'm\u00f3dulos'],
    ['estatistica', 'estat\u00edstica'],
    ['filtravel', 'filtr\u00e1vel'],
    ['filtraveis', 'filtr\u00e1veis'],
    ['visao', 'vis\u00e3o'],
    ['acao', 'a\u00e7\u00e3o'],
    ['acoes', 'a\u00e7\u00f5es'],
    ['afiliacao', 'afilia\u00e7\u00e3o'],
    ['afiliacoes', 'afilia\u00e7\u00f5es'],
    ['comissao', 'comiss\u00e3o'],
    ['comissoes', 'comiss\u00f5es'],
    ['selecao', 'sele\u00e7\u00e3o'],
    ['padrao', 'padr\u00e3o'],
    ['pre-venda', 'pr\u00e9-venda'],
    ['nao', 'n\u00e3o'],
  ];

  let result = applyWordReplacements(text, replacements);
  result = result.replace(/\s+\.{3}/g, '...');
  return result;
}

function cleanJsonResponse(raw) {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\n([\s\S]*?)\n```/i);
  if (fenced?.[1]) return fenced[1].trim();
  return trimmed;
}

async function requestCorrections({ filePath, language, changes }) {
  if (!API_KEY) {
    throw new Error('Missing DOCS_LLM_API_KEY');
  }

  const system = [
    'You are a translation quality and grammar editor for i18n JSON values.',
    'Rules:',
    '- Keep the original language of each entry.',
    '- Correct only grammar, fluency, punctuation and spelling.',
    '- For Portuguese (pt), ensure accents and special characters are correct and complete.',
    '- Do NOT translate entries to a different language.',
    '- Preserve placeholders/tokens exactly: {var}, {{var}}, %s, %d, :id, HTML tags, and escaped line breaks.',
    '- Do NOT change semantic meaning.',
    '- Return JSON only: {"updates":[{"pointer":"/path","corrected":"text"}]}',
  ].join('\n');

  const user = [
    `File: ${filePath}`,
    `Language hint: ${language}`,
    'Changed text values to review:',
    JSON.stringify(changes, null, 2),
    'Return only JSON with this schema:',
    '{"updates":[{"pointer":"/key/path","corrected":"corrected text"}]}',
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

  const clean = cleanJsonResponse(content);
  const parsed = JSON.parse(clean);
  if (!parsed || !Array.isArray(parsed.updates)) {
    throw new Error('LLM returned invalid schema');
  }

  return parsed.updates;
}

function collectChangedLanguageFiles(base, head) {
  const command = [
    `git diff --name-only --diff-filter=ACMRT ${base} ${head} --`,
    '":(glob)libraries/*/hedhog/frontend/messages/**/*.json"',
    '":(glob)libraries/*/src/language/**/*.json"',
  ].join(' ');

  const raw = runAllowEmpty(command);
  if (!raw) return [];

  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => toPosix(line));
}

function readJsonFromGitRef(ref, filePath) {
  const safePath = toPosix(filePath);
  const content = runAllowEmpty(`git show ${ref}:${safePath}`);
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function readJsonFromWorkspace(filePath) {
  const full = join(ROOT, filePath);
  if (!existsSync(full)) return null;

  try {
    return JSON.parse(readFileSync(full, 'utf8'));
  } catch {
    return null;
  }
}

function buildChangedStringEntries(previousObj, currentObj) {
  const currentMap = collectStringPointers(currentObj);
  const previousMap = previousObj ? collectStringPointers(previousObj) : new Map();

  const changes = [];
  for (const [pointer, currentText] of currentMap.entries()) {
    const previousText = previousMap.get(pointer);
    if (previousText === currentText) continue;
    changes.push({ pointer, text: currentText });
  }

  return changes;
}

async function processFile(base, filePath, stats) {
  const currentObj = readJsonFromWorkspace(filePath);
  if (!currentObj || typeof currentObj !== 'object') {
    stats.skipped.push({ filePath, reason: 'invalid_current_json' });
    return;
  }

  const previousObj = readJsonFromGitRef(base, filePath);
  const changes = buildChangedStringEntries(previousObj, currentObj);
  const language = detectLanguageFromPath(filePath);
  if (changes.length === 0) {
    stats.scanned += 1;
    return;
  }

  let updates;
  try {
    updates = await requestCorrections({
      filePath,
      language,
      changes,
    });
  } catch (error) {
    stats.skipped.push({
      filePath,
      reason: `llm_error:${error instanceof Error ? error.message : String(error)}`,
    });
    return;
  }

  const changedPointers = new Set(changes.map((item) => item.pointer));
  const updatesByPointer = new Map();
  for (const update of updates) {
    if (!update || typeof update.pointer !== 'string' || typeof update.corrected !== 'string') {
      continue;
    }

    if (!changedPointers.has(update.pointer)) continue;
    updatesByPointer.set(update.pointer, update.corrected);
  }

  let applied = 0;

  for (const change of changes) {
    const original = getByPointer(currentObj, change.pointer);
    if (typeof original !== 'string') continue;

    let candidate = updatesByPointer.get(change.pointer) ?? original;
    if (language.startsWith('pt')) {
      candidate = applyPortugueseHeuristics(candidate);
    }

    if (candidate === original) continue;

    const originalTokens = extractPlaceholderTokens(original);
    const correctedTokens = extractPlaceholderTokens(candidate);

    if (!sameTokenMultiset(originalTokens, correctedTokens)) {
      stats.skippedItems += 1;
      continue;
    }

    setByPointer(currentObj, change.pointer, candidate);
    applied += 1;
  }

  if (applied > 0) {
    const full = join(ROOT, filePath);
    writeFileSync(full, `${JSON.stringify(currentObj, null, 2)}\n`, 'utf8');
    stats.correctedFiles += 1;
    stats.correctedItems += applied;
  }

  stats.scanned += 1;
}

async function main() {
  const args = parseArgs(process.argv);
  const base = args.base || process.env.BASE_SHA;
  const head = args.head || process.env.HEAD_SHA || 'HEAD';

  if (!base) {
    console.log('No base SHA provided. Use --base <sha> or BASE_SHA env.');
    process.exit(0);
  }

  const files = collectChangedLanguageFiles(base, head);
  if (files.length === 0) {
    console.log('No language JSON changes detected in libraries.');
    process.exit(0);
  }

  const stats = {
    scanned: 0,
    correctedFiles: 0,
    correctedItems: 0,
    skippedItems: 0,
    skipped: [],
  };

  for (const filePath of files) {
    await processFile(base, filePath, stats);
  }

  console.log('Language text correction summary:');
  console.log(`- Files detected: ${files.length}`);
  console.log(`- Files scanned: ${stats.scanned}`);
  console.log(`- Files corrected: ${stats.correctedFiles}`);
  console.log(`- Text items corrected: ${stats.correctedItems}`);
  console.log(`- Items skipped (placeholder protection): ${stats.skippedItems}`);

  if (stats.skipped.length > 0) {
    console.log('- Files skipped:');
    for (const item of stats.skipped) {
      console.log(`  - ${item.filePath} (${item.reason})`);
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
