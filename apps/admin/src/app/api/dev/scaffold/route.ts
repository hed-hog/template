import { resolveScaffoldRoot } from '@/lib/scaffold/dev-guard';
import {
  assertSafePath,
  createNodeScaffoldFs,
  ScaffoldPathError,
} from '@/lib/scaffold/paths';
import {
  buildFollowUpSteps,
  buildScaffoldFiles,
} from '@/lib/scaffold/plan-to-files';
import type { ScaffoldFile, ScaffoldPlan } from '@/lib/scaffold/types';
import { validatePlan } from '@/lib/scaffold/validate';
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

export async function POST(request: Request) {
  const root = resolveScaffoldRoot();

  if (!root) {
    return new NextResponse(null, { status: 404 });
  }

  let body: { mode?: string; plan?: ScaffoldPlan };

  try {
    body = (await request.json()) as { mode?: string; plan?: ScaffoldPlan };
  } catch {
    return NextResponse.json({ message: 'JSON inválido.' }, { status: 400 });
  }

  const mode = body.mode === 'apply' ? 'apply' : 'preview';
  const plan = body.plan;

  if (!plan) {
    return NextResponse.json({ message: 'Plano ausente.' }, { status: 400 });
  }

  const scaffoldFs = createNodeScaffoldFs(root);
  const issues = validatePlan(plan, scaffoldFs);

  if (issues.length > 0) {
    return NextResponse.json({ issues }, { status: 422 });
  }

  let files: ScaffoldFile[];

  try {
    files = buildScaffoldFiles(plan, scaffoldFs, {
      timestamp: migrationTimestamp(),
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Falha ao gerar os arquivos.' },
      { status: 500 }
    );
  }

  const conflicts = files.filter(
    (file) => file.action === 'create' && file.exists
  );

  const steps = buildFollowUpSteps(plan);

  if (mode === 'preview') {
    return NextResponse.json({ files, conflicts: conflicts.map((f) => f.path), steps });
  }

  if (conflicts.length > 0 && !plan.overwrite) {
    return NextResponse.json(
      {
        message: 'Arquivos já existentes. Marque "sobrescrever" para continuar.',
        conflicts: conflicts.map((file) => file.path),
      },
      { status: 409 }
    );
  }

  const written: string[] = [];
  const skipped: ScaffoldFile[] = [];

  try {
    files.forEach((file) => {
      if (file.action === 'manual') {
        skipped.push(file);
        return;
      }

      const absolute = assertSafePath(root, file.path);

      fs.mkdirSync(path.dirname(absolute), { recursive: true });
      fs.writeFileSync(absolute, file.contents, 'utf-8');
      written.push(file.path);
    });
  } catch (error) {
    if (error instanceof ScaffoldPathError) {
      return NextResponse.json({ message: error.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : 'Falha ao gravar os arquivos.',
        written,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ written, manual: skipped, steps });
}
