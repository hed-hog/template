import { existsSync, readFileSync } from "fs";
import { dirname, join } from "path";

export const getLocaleText = (key: string, locale: string, defaultValue = 'Unknown') => {

  const stack = new Error().stack;
  if (stack) {
    const stackLines = stack.split('\n');
    const callerLine = stackLines[2];
    const match = callerLine.match(/\((.*):\d+:\d+\)/);

    if (match && match[1]) {
      const dir = dirname(match[1]);
      function findLocaleFile(startDir: string, locale: string): string | null {
        let currentDir = startDir;
        while (true) {
          const languageDir = join(currentDir, 'language');
          const localeFile = join(languageDir, `${locale}.json`);
          if (existsSync(localeFile)) {
            return localeFile;
          }
          const parentDir = dirname(currentDir);
          if (parentDir === currentDir) {
            break; // reached root
          }
          currentDir = parentDir;
        }
        return null;
      }

      const localeFilePath = findLocaleFile(dir, locale);
      if (localeFilePath) {
        try {
          const data = JSON.parse(readFileSync(localeFilePath, 'utf-8'));

          const keys = key.split('.');
          let value: any = data;
          for (const k of keys) {

            if (value && typeof value === 'object' && k in value) {
              value = value[k];
            } else {
              value = undefined;
              break;
            }
          }
          if (value !== undefined) {
            return value;
          }
        } catch (e) {
          // ignore parse errors
        }
      }
    }
  }
  console.warn(
    `\x1b[33m[Locale] Key \x1b[36m'${key}'\x1b[33m not found for locale '${locale}'.\x1b[0m`
  );
  return defaultValue || key;
}