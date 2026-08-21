import { resolveScaffoldRoot } from '@/lib/scaffold/dev-guard';
import {
  buildDeletionFollowUps,
  buildDeletionPlan,
  DeletePageError,
  type DeletionFile,
} from '@/lib/scaffold/delete-page';
import {
  assertSafePath,
  createNodeScaffoldFs,
  ScaffoldPathError,
} from '@/lib/scaffold/paths';
import type { PageManifestEntry } from '@/lib/pages-manifest';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function migrationTimestamp(): string {
  const now = new Date();

  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0'),
  ].join('');
}

/**
 * Lê o manifesto fresco do disco (não o snapshot de build) para refletir
 * exclusões feitas antes nesta mesma sessão.
 */
function readManifest(root: string): PageManifestEntry[] {
  const manifestPath = path.join(
    root,
    'apps',
    'admin',
    'src',
    'generated',
    'pages-manifest.json'
  );

  try {
    const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf-8')) as {
      pages: PageManifestEntry[];
    };

    return parsed.pages ?? [];
  } catch {
    return [];
  }
}

function regenerateManifest(root: string) {
  const adminDir = path.join(root, 'apps', 'admin');

  spawnSync(process.execPath, ['scripts/generate-pages-manifest.mjs'], {
    cwd: adminDir,
    stdio: 'ignore',
  });
}

export async function POST(request: Request) {
  const root = resolveScaffoldRoot();

  if (!root) {
    return new NextResponse(null, { status: 404 });
  }

  let body: {
    mode?: string;
    route?: string;
    menuSlug?: string | null;
    menuLabelPt?: string | null;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: 'JSON inválido.' }, { status: 400 });
  }

  const mode = body.mode === 'apply' ? 'apply' : 'preview';

  if (!body.route) {
    return NextResponse.json({ message: 'Rota ausente.' }, { status: 400 });
  }

  const scaffoldFs = createNodeScaffoldFs(root);
  const pages = readManifest(root);

  let files: DeletionFile[];

  try {
    files = buildDeletionPlan(
      {
        route: body.route,
        menuSlug: body.menuSlug ?? null,
        menuLabelPt: body.menuLabelPt ?? null,
      },
      pages,
      scaffoldFs,
      migrationTimestamp()
    );
  } catch (error) {
    if (error instanceof DeletePageError) {
      return NextResponse.json({ message: error.message }, { status: 404 });
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Falha ao montar o plano.',
      },
      { status: 500 }
    );
  }

  const page = pages.find((entry) => entry.route === body.route);
  const hasMenuMigration = files.some((file) => file.category === 'migration');
  const steps = page
    ? buildDeletionFollowUps(page, hasMenuMigration)
    : [];

  if (mode === 'preview') {
    return NextResponse.json({ files, steps });
  }

  const deleted: string[] = [];

  try {
    for (const file of files) {
      const absolute = assertSafePath(root, file.path);

      if (file.action === 'delete') {
        fs.rmSync(absolute, { recursive: true, force: true });
        deleted.push(file.path);
      } else {
        // rewrite (i18n / menu.yaml) e create (migration)
        fs.mkdirSync(path.dirname(absolute), { recursive: true });
        fs.writeFileSync(absolute, file.contents ?? '', 'utf-8');
      }
    }
  } catch (error) {
    if (error instanceof ScaffoldPathError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : 'Falha ao excluir os arquivos.',
        deleted,
      },
      { status: 500 }
    );
  }

  regenerateManifest(root);

  return NextResponse.json({ files, steps, deleted });
}
