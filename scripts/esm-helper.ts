/**
 * ESM helper for getting __dirname and __filename equivalents
 * Use this in TypeScript scripts that are executed as ES modules
 */
import { dirname } from 'path';
import { fileURLToPath } from 'url';

export function getDirname(importMetaUrl: string): string {
  const __filename = fileURLToPath(importMetaUrl);
  return dirname(__filename);
}

export function getFilename(importMetaUrl: string): string {
  return fileURLToPath(importMetaUrl);
}
