import fs from 'node:fs';
import path from 'node:path';
import type { ScaffoldFs } from './types';

/**
 * Diretórios (relativos à raiz do monorepo) em que o scaffolding pode escrever.
 * Qualquer caminho fora desta lista é recusado, mesmo em desenvolvimento.
 */
export const WRITABLE_ROOTS = [
  'apps/admin/src/app/(app)/(libraries)',
  'apps/admin/messages',
  'apps/api/prisma/migrations',
  'libraries',
] as const;

export class ScaffoldPathError extends Error {}

export function toPosixPath(value: string): string {
  return value.split(path.sep).join('/');
}

/**
 * Sobe a partir do diretório de trabalho até encontrar o `pnpm-workspace.yaml`.
 * Retorna `null` quando o processo não roda dentro do monorepo (build standalone).
 */
export function resolveMonorepoRoot(startDir = process.cwd()): string | null {
  let current = path.resolve(startDir);

  for (let depth = 0; depth < 10; depth += 1) {
    if (fs.existsSync(path.join(current, 'pnpm-workspace.yaml'))) {
      return current;
    }

    const parent = path.dirname(current);

    if (parent === current) {
      return null;
    }

    current = parent;
  }

  return null;
}

/**
 * Valida o caminho relativo e devolve o absoluto. Recusa caminhos absolutos,
 * travessia com `..` e qualquer destino fora de `WRITABLE_ROOTS`.
 */
export function assertSafePath(root: string, relativePath: string): string {
  const normalized = toPosixPath(relativePath).replace(/^\.\//, '');

  if (!normalized || normalized.startsWith('/') || /^[A-Za-z]:/.test(normalized)) {
    throw new ScaffoldPathError(`Caminho absoluto não permitido: ${relativePath}`);
  }

  if (normalized.split('/').includes('..')) {
    throw new ScaffoldPathError(`Travessia de diretório não permitida: ${relativePath}`);
  }

  const isWritable = WRITABLE_ROOTS.some(
    (writableRoot) =>
      normalized === writableRoot || normalized.startsWith(`${writableRoot}/`)
  );

  if (!isWritable) {
    throw new ScaffoldPathError(`Caminho fora das raízes permitidas: ${relativePath}`);
  }

  const absolute = path.resolve(root, normalized);
  const resolvedRoot = path.resolve(root);

  // Defesa em profundidade: symlinks ou normalizações inesperadas não podem
  // fazer o caminho escapar da raiz do monorepo.
  if (
    absolute !== resolvedRoot &&
    !absolute.startsWith(resolvedRoot + path.sep)
  ) {
    throw new ScaffoldPathError(`Caminho fora do monorepo: ${relativePath}`);
  }

  return absolute;
}

export function createNodeScaffoldFs(root: string): ScaffoldFs {
  return {
    read(relativePath) {
      const absolute = path.resolve(root, toPosixPath(relativePath));

      try {
        return fs.readFileSync(absolute, 'utf-8');
      } catch {
        return null;
      }
    },
    exists(relativePath) {
      return fs.existsSync(path.resolve(root, toPosixPath(relativePath)));
    },
  };
}
