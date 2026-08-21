import { describe, expect, it } from 'vitest';
import { createTestPlan } from '../scaffold-fixtures';
import {
  buildApiRoutes,
  generateMenuYamlEntry,
  generateRoleYamlEntry,
  generateRouteYamlEntries,
  generateTableYaml,
  yamlString,
} from './yaml';

describe('yamlString', () => {
  it('mantém texto simples sem aspas', () => {
    expect(yamlString('Ordens de serviço')).toBe('Ordens de serviço');
  });

  it('cita valores ambíguos', () => {
    expect(yamlString('true')).toBe("'true'");
    expect(yamlString('123')).toBe("'123'");
    expect(yamlString('')).toBe("''");
    expect(yamlString("O'Brien")).toBe("'O''Brien'");
    expect(yamlString('chave: valor')).toBe("'chave: valor'");
  });
});

describe('generateTableYaml', () => {
  const yaml = generateTableYaml(createTestPlan());

  it('abre com pk e fecha com created_at/updated_at', () => {
    expect(yaml.startsWith('columns:\n  - type: pk\n')).toBe(true);
    expect(yaml).toContain('  - type: created_at\n  - type: updated_at');
  });

  it('escreve varchar com length', () => {
    expect(yaml).toContain('  - name: title\n    type: varchar\n    length: 180');
  });

  it('escreve enum com valores e default', () => {
    expect(yaml).toContain('    values: [open, closed]');
    expect(yaml).toContain("    default: open");
  });

  it('escreve fk nullable com SET NULL', () => {
    expect(yaml).toContain('    references:\n      table: person');
    expect(yaml).toContain('      onDelete: SET NULL');
  });

  it('indexa fk e enum', () => {
    expect(yaml).toContain('indices:');
    expect(yaml).toContain('  - columns: [status]');
    expect(yaml).toContain('  - columns: [person_id]');
  });

  it('emite bloco locale para colunas traduzíveis', () => {
    const plan = createTestPlan({
      columns: [
        {
          name: 'name',
          type: 'locale_varchar',
          nullable: false,
          length: 255,
          labelEn: 'Name',
          labelPt: 'Nome',
          inList: true,
          inFilters: false,
        },
      ],
    });

    const localeYaml = generateTableYaml(plan);

    expect(localeYaml).toContain('    type: locale_varchar');
    expect(localeYaml).toContain('    locale:\n      en: Name\n      pt: Nome');
  });
});

describe('generateMenuYamlEntry', () => {
  it('inclui o menu pai via where', () => {
    const entry = generateMenuYamlEntry(createTestPlan());

    expect(entry).toContain('- menu_id:\n    where:\n      slug: /crm');
    expect(entry).toContain('  url: /crm/service-orders');
    expect(entry).toContain('  slug: /crm/service-orders');
    expect(entry).toContain('      - where:\n          slug: admin');
    expect(entry).toContain('          slug: admin-crm');
  });

  it('omite menu_id em menu raiz', () => {
    const entry = generateMenuYamlEntry(
      createTestPlan({ menu: { parentSlug: null, icon: 'hash', order: 1 } })
    );

    expect(entry.startsWith('- url: /crm/service-orders')).toBe(true);
  });
});

describe('buildApiRoutes', () => {
  it('gera uma rota por endpoint habilitado', () => {
    expect(buildApiRoutes(createTestPlan())).toEqual([
      { url: '/service-order', method: 'GET' },
      { url: '/service-order/stats', method: 'GET' },
      { url: '/service-order', method: 'POST' },
      { url: '/service-order/:id', method: 'GET' },
      { url: '/service-order/:id', method: 'PATCH' },
      { url: '/service-order/:id', method: 'DELETE' },
    ]);
  });

  it('respeita endpoints desligados', () => {
    const plan = createTestPlan({
      endpoints: {
        list: true,
        stats: false,
        get: false,
        create: false,
        update: false,
        remove: false,
      },
    });

    expect(buildApiRoutes(plan)).toEqual([{ url: '/service-order', method: 'GET' }]);
  });
});

describe('generateRouteYamlEntries', () => {
  it('declara tipo HTTP e os cargos de cada rota', () => {
    const entries = generateRouteYamlEntries(createTestPlan());

    expect(entries).toContain('- url: /service-order\n  method: GET\n  type: HTTP');
    expect(entries.match(/type: HTTP/g)).toHaveLength(6);
  });
});

describe('generateRoleYamlEntry', () => {
  it('retorna vazio quando não há cargo novo', () => {
    expect(generateRoleYamlEntry(createTestPlan())).toBe('');
  });

  it('gera slug, nome e descrição bilíngues', () => {
    const entry = generateRoleYamlEntry(
      createTestPlan({
        newRole: {
          slug: 'admin-service-order',
          nameEn: 'Service Order Admin',
          namePt: 'Administrador de OS',
          descriptionEn: 'Manages service orders.',
          descriptionPt: 'Gerencia ordens de serviço.',
        },
      })
    );

    expect(entry).toContain('- slug: admin-service-order');
    expect(entry).toContain('    pt: Administrador de OS');
  });
});
