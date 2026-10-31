import fs from 'fs';
import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import path from 'path';

/**
 * Recursively loads and merges all JSON files from a directory and its subdirectories
 * Keys are prefixed with the directory structure to avoid conflicts
 * @param dirPath - The directory path to scan
 * @param locale - The locale code (e.g., 'en', 'pt')
 * @param basePath - The base path for recursive calls (used internally)
 * @returns Merged messages object with namespaced keys
 */
function loadMessagesRecursively(
  dirPath: string,
  locale: string,
  basePath: string = ''
): Record<string, unknown> {
  let messages: Record<string, unknown> = {};

  // Check if directory exists
  if (!fs.existsSync(dirPath)) {
    return messages;
  }

  // Read all items in the directory
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);

    if (item.isDirectory()) {
      // Build the namespace from the folder structure
      const namespace = basePath ? `${basePath}.${item.name}` : item.name;

      // Recursively load messages from subdirectory with namespace
      const subMessages = loadMessagesRecursively(itemPath, locale, namespace);
      messages = deepMerge(messages, subMessages);
    } else if (item.isFile() && item.name === `${locale}.json`) {
      // Load JSON file
      try {
        const fileContent = fs.readFileSync(itemPath, 'utf-8');
        const json = JSON.parse(fileContent);

        // If we're in a subdirectory, nest the content under the namespace
        if (basePath) {
          const nested = setNestedValue({}, basePath, json);
          messages = deepMerge(messages, nested);
        } else {
          // Root level - merge directly
          messages = deepMerge(messages, json);
        }
      } catch (error) {
        console.error(`Error loading ${itemPath}:`, error);
      }
    }
  }

  return messages;
}

/**
 * Deep merge two objects
 */
function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>
): Record<string, unknown> {
  const output: Record<string, unknown> = { ...target };

  if (isObject(target) && isObject(source)) {
    Object.keys(source).forEach((key) => {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (isObject(sourceValue)) {
        if (!isObject(targetValue)) {
          output[key] = sourceValue;
        } else {
          output[key] = deepMerge(targetValue, sourceValue);
        }
      } else {
        output[key] = sourceValue;
      }
    });
  }

  return output;
}

/**
 * Check if value is a plain object
 */
function isObject(item: unknown): item is Record<string, unknown> {
  return !!item && typeof item === 'object' && !Array.isArray(item);
}

/**
 * Set a nested value using dot notation path
 */
function setNestedValue(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const keys = path.split('.');
  const result: Record<string, unknown> = { ...obj };
  let current: Record<string, unknown> = result;

  for (let i = 0; i < keys.length - 1; i++) {
    if (keys[i]) {
      const key = String(keys[i]);
      if (!isObject(current[key])) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
  }

  const lastKey = keys[keys.length - 1];
  if (lastKey !== undefined) {
    current[lastKey] = value;
  }
  return result;
}

const SUPPORTED_LOCALES = ['en', 'pt'];

/**
 * Primeiro idioma do `Accept-Language` que o admin tem (`pt-BR` → `pt`), na
 * ordem de preferência do navegador.
 */
function localeFromAcceptLanguage(header: string | null): string | null {
  const ranked = (header ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = params.find((p) => p.trim().startsWith('q='));
      return {
        base: tag.trim().toLowerCase().split('-')[0] ?? '',
        q: q ? Number(q.trim().slice(2)) || 0 : 1,
      };
    })
    .filter((item) => item.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.find((item) => SUPPORTED_LOCALES.includes(item.base))?.base ?? null;
}

export default getRequestConfig(async () => {
  const store = await cookies();
  // Sem cookie (o LanguageSelector só o grava no cliente), o idioma do
  // navegador decide: antes caía em 'en' e a tela saía em inglês com o menu,
  // que vem da API, em português (HCD-0002).
  const locale =
    store.get('locale')?.value ||
    localeFromAcceptLanguage((await headers()).get('accept-language')) ||
    'en';

  // Load messages from the messages directory and all subdirectories
  const messagesDir = path.join(process.cwd(), 'messages');
  const messages = loadMessagesRecursively(messagesDir, locale);

  return {
    locale,
    messages,
  };
});
