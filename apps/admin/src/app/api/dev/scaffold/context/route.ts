import { resolveScaffoldRoot } from '@/lib/scaffold/dev-guard';
import type { ScaffoldContext } from '@/lib/scaffold/types';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function listDirectories(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

/** Entidades já modeladas na library, a partir de `hedhog/table/*.yaml`. */
function listEntities(root: string, library: string): string[] {
  const tableDir = path.join(root, 'libraries', library, 'hedhog', 'table');

  try {
    return fs
      .readdirSync(tableDir)
      .filter((file) => file.endsWith('.yaml'))
      .map((file) => file.replace(/\.yaml$/, ''))
      .sort();
  } catch {
    return [];
  }
}

export async function GET() {
  const root = resolveScaffoldRoot();

  if (!root) {
    return new NextResponse(null, { status: 404 });
  }

  const libraries = listDirectories(path.join(root, 'libraries')).filter(
    (library) =>
      fs.existsSync(path.join(root, 'libraries', library, 'package.json'))
  );

  const entitiesByLibrary: Record<string, string[]> = {};
  libraries.forEach((library) => {
    entitiesByLibrary[library] = listEntities(root, library);
  });

  const pagesRoot = path.join(
    root,
    'apps',
    'admin',
    'src',
    'app',
    '(app)',
    '(libraries)'
  );

  const existingRoutes: string[] = [];
  const stack = [pagesRoot];

  while (stack.length > 0) {
    const current = stack.pop();

    if (!current) {
      continue;
    }

    let entries: fs.Dirent[];

    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    entries.forEach((entry) => {
      if (entry.isDirectory()) {
        stack.push(path.join(current, entry.name));
        return;
      }

      if (entry.name === 'page.tsx') {
        const relative = path
          .relative(pagesRoot, current)
          .split(path.sep)
          .filter(Boolean)
          .join('/');

        existingRoutes.push(`/${relative}`);
      }
    });
  }

  const context: ScaffoldContext = {
    libraries,
    entitiesByLibrary,
    existingRoutes: existingRoutes.sort(),
  };

  return NextResponse.json(context);
}
