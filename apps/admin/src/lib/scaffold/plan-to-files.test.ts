import { describe, expect, it } from 'vitest';
import { buildFollowUpSteps, buildScaffoldFiles } from './plan-to-files';
import { createMemoryFs, createTestPlan } from './scaffold-fixtures';
import type { ScaffoldFile } from './types';

const LIBRARY_MODULE = `import { Module } from '@nestjs/common';

@Module({
  imports: [],
})
export class CrmModule {}
`;

const fs = createMemoryFs({
  'libraries/crm/package.json': '{}',
  'libraries/crm/src/crm.module.ts': LIBRARY_MODULE,
  'libraries/crm/hedhog/data/menu.yaml': '- url: /crm\n  slug: /crm\n',
  'libraries/crm/hedhog/data/route.yaml': '- url: /person\n  method: GET\n',
  'apps/admin/messages/crm/pt.json': '{\n  "AccountsPage": {\n    "title": "Contas"\n  }\n}',
});

function build(plan = createTestPlan()): ScaffoldFile[] {
  return buildScaffoldFiles(plan, fs, { timestamp: '20260722173000' });
}

function byPath(files: ScaffoldFile[], path: string): ScaffoldFile {
  const file = files.find((item) => item.path === path);

  if (!file) {
    throw new Error(`Arquivo não gerado: ${path}`);
  }

  return file;
}

describe('buildScaffoldFiles', () => {
  const files = build();
  const paths = files.map((file) => file.path);

  it('gera a página no diretório da rota', () => {
    expect(paths).toContain(
      'apps/admin/src/app/(app)/(libraries)/crm/service-orders/page.tsx'
    );
    expect(paths).toContain(
      'apps/admin/src/app/(app)/(libraries)/crm/service-orders/_components/service-order-types.ts'
    );
    expect(paths).toContain(
      'apps/admin/src/app/(app)/(libraries)/crm/service-orders/_components/service-order-form-sheet.tsx'
    );
  });

  it('a listagem nasce com ordenação por cabeçalho ligada ao backend', () => {
    const page = files.find(
      (file) =>
        file.path ===
        'apps/admin/src/app/(app)/(libraries)/crm/service-orders/page.tsx'
    );

    expect(page).toBeDefined();
    const contents = page!.contents ?? '';

    // Allowlist tipada: `id` (o default) mais as colunas escalares da listagem.
    // `person_id` é fk e fica de fora — ordenaria pelo id, não pelo nome.
    expect(contents).toContain(
      "type SortField = 'id' | 'title' | 'status';"
    );
    expect(contents).toContain('const sort = useTableSort<SortField>({');
    expect(contents).toContain("onSortChange: () => setPage(1),");

    // Os dois params na requisição E na queryKey — sem a chave, o react-query
    // serviria o cache da ordem anterior.
    expect(contents).toContain("params.set('sortField', sort.sortField);");
    expect(contents).toContain("params.set('sortOrder', sort.sortOrder);");
    expect(contents).toMatch(/queryKey: \[[\s\S]*sort\.sortField,[\s\S]*\],/);

    expect(contents).toContain("sortProps: sort.getSortProps('title'),");
    expect(contents).not.toContain("sortProps: sort.getSortProps('person_id'),");

    // A tela nasce com o padrão de tabela do admin: colunas declaradas uma vez,
    // arrastáveis e ocultáveis, com a escolha do usuário preservada.
    expect(contents).toContain('const columns = useEntityColumns<ServiceOrder>({');
    expect(contents).toContain(
      "storageKey: 'crm-service-order-columns-v1',"
    );
    expect(contents).toContain('<EntityTable');
    // A coluna de ações é a única travada.
    expect(contents).toContain('hideable: false,');
  });

  it('gera os artefatos de backend da biblioteca', () => {
    expect(paths).toContain('libraries/crm/hedhog/table/service_order.yaml');
    expect(paths).toContain('libraries/crm/src/service-order/service-order.service.ts');
    expect(paths).toContain(
      'libraries/crm/src/service-order/service-order.controller.ts'
    );
    expect(paths).toContain('libraries/crm/src/service-order/service-order.module.ts');
    expect(paths).toContain(
      'libraries/crm/src/service-order/dto/service-order.dto.ts'
    );
  });

  it('gera exatamente uma migration', () => {
    const migrations = paths.filter((path) =>
      path.startsWith('apps/api/prisma/migrations/')
    );

    expect(migrations).toEqual([
      'apps/api/prisma/migrations/20260722173000_crm_service_order_page/migration.sql',
    ]);
  });

  it('acrescenta ao menu.yaml existente sem apagar o conteúdo', () => {
    const menu = byPath(files, 'libraries/crm/hedhog/data/menu.yaml');

    expect(menu.action).toBe('merge');
    expect(menu.contents.startsWith('- url: /crm\n  slug: /crm\n')).toBe(true);
    expect(menu.contents).toContain('  url: /crm/service-orders');
  });

  it('faz patch do módulo raiz da biblioteca', () => {
    const libraryModule = byPath(files, 'libraries/crm/src/crm.module.ts');

    expect(libraryModule.action).toBe('patch');
    expect(libraryModule.contents).toContain(
      'forwardRef(() => ServiceOrderModule),'
    );
  });

  it('cria o pt.json preservando namespaces existentes', () => {
    const messages = byPath(files, 'apps/admin/messages/crm/pt.json');
    const parsed = JSON.parse(messages.contents);

    expect(messages.action).toBe('merge');
    expect(parsed.AccountsPage.title).toBe('Contas');
    expect(parsed.ServiceOrderPage.title).toBe('Ordens de serviço');
  });

  it('cria o en.json que ainda não existe', () => {
    const messages = byPath(files, 'apps/admin/messages/crm/en.json');

    expect(messages.action).toBe('create');
    expect(messages.exists).toBe(false);
  });

  it('marca colisão quando a página já existe', () => {
    const withExistingPage = buildScaffoldFiles(
      createTestPlan(),
      createMemoryFs({
        'libraries/crm/package.json': '{}',
        'apps/admin/src/app/(app)/(libraries)/crm/service-orders/page.tsx': 'old',
      }),
      { timestamp: '20260722173000' }
    );

    expect(
      byPath(
        withExistingPage,
        'apps/admin/src/app/(app)/(libraries)/crm/service-orders/page.tsx'
      ).exists
    ).toBe(true);
  });

  it('sem backend, não gera table YAML, CRUD nem rotas', () => {
    const frontendOnly = build(createTestPlan({ generateBackend: false }));
    const frontendPaths = frontendOnly.map((file) => file.path);

    expect(frontendPaths).not.toContain('libraries/crm/hedhog/table/service_order.yaml');
    expect(
      frontendPaths.some((path) => path.includes('service-order.controller.ts'))
    ).toBe(false);
    expect(frontendPaths).toContain('libraries/crm/hedhog/data/menu.yaml');
  });

  it('gera o role.yaml apenas quando há cargo novo', () => {
    expect(build().map((file) => file.path)).not.toContain(
      'libraries/crm/hedhog/data/role.yaml'
    );

    const withRole = build(
      createTestPlan({
        newRole: {
          slug: 'admin-service-order',
          nameEn: 'SO Admin',
          namePt: 'Admin de OS',
          descriptionEn: 'Manages.',
          descriptionPt: 'Gerencia.',
        },
      })
    );

    expect(withRole.map((file) => file.path)).toContain(
      'libraries/crm/hedhog/data/role.yaml'
    );
  });
});

describe('buildFollowUpSteps', () => {
  it('nunca executa comandos, apenas lista o que falta rodar', () => {
    const steps = buildFollowUpSteps(createTestPlan());

    expect(steps[0]).toBe('cd apps/api && pnpm prisma:deploy');
    expect(steps).toContain('hedhog dev assets-to-library crm');
  });
});
