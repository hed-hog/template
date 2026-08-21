import { describe, expect, it } from 'vitest';
import { createMemoryFs, createTestPlan } from './scaffold-fixtures';
import { validatePlan } from './validate';

const fs = createMemoryFs({ 'libraries/crm/package.json': '{}' });

function fields(plan = createTestPlan()) {
  return validatePlan(plan, fs).map((issue) => issue.field);
}

describe('validatePlan', () => {
  it('aceita um plano válido', () => {
    expect(validatePlan(createTestPlan(), fs)).toEqual([]);
  });

  it('recusa biblioteca inexistente', () => {
    expect(fields(createTestPlan({ library: 'ghost' }))).toContain('library');
  });

  it('recusa entidade fora de snake_case', () => {
    expect(fields(createTestPlan({ entity: 'ServiceOrder' }))).toContain('entity');
    expect(fields(createTestPlan({ entity: '1order' }))).toContain('entity');
  });

  it('recusa rota fora da biblioteca', () => {
    expect(fields(createTestPlan({ route: '/lms/orders' }))).toContain('route');
  });

  it('recusa rota com caracteres inválidos', () => {
    expect(fields(createTestPlan({ route: '/crm/Orders' }))).toContain('route');
  });

  it('recusa colunas reservadas e duplicadas', () => {
    const plan = createTestPlan({
      columns: [
        {
          name: 'created_at',
          type: 'datetime',
          nullable: false,
          labelEn: 'Created',
          labelPt: 'Criado',
          inList: true,
          inFilters: false,
        },
        {
          name: 'created_at',
          type: 'datetime',
          nullable: false,
          labelEn: 'Created',
          labelPt: 'Criado',
          inList: true,
          inFilters: false,
        },
      ],
    });

    const messages = validatePlan(plan, fs).map((issue) => issue.message);

    expect(messages.some((message) => message.includes('automaticamente'))).toBe(true);
    expect(messages.some((message) => message.includes('duplicada'))).toBe(true);
  });

  it('exige valores em colunas enum', () => {
    const plan = createTestPlan({
      columns: [
        {
          name: 'status',
          type: 'enum',
          nullable: false,
          enumValues: ['open'],
          labelEn: 'Status',
          labelPt: 'Situação',
          inList: true,
          inFilters: true,
        },
      ],
    });

    expect(validatePlan(plan, fs)).not.toEqual([]);
  });

  it('exige tabela de destino em colunas fk', () => {
    const plan = createTestPlan({
      columns: [
        {
          name: 'person_id',
          type: 'fk',
          nullable: false,
          labelEn: 'Person',
          labelPt: 'Pessoa',
          inList: true,
          inFilters: false,
        },
      ],
    });

    expect(validatePlan(plan, fs)).not.toEqual([]);
  });

  it('não exige colunas quando o backend não é gerado', () => {
    const plan = createTestPlan({ generateBackend: false, columns: [] });

    expect(validatePlan(plan, fs)).toEqual([]);
  });

  it('recusa ícone e ordem inválidos', () => {
    const issues = fields(
      createTestPlan({ menu: { parentSlug: null, icon: 'File Text', order: -1 } })
    );

    expect(issues).toContain('menu.icon');
    expect(issues).toContain('menu.order');
  });
});
