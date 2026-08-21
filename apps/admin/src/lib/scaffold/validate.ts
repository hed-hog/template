import { SCAFFOLD_COLUMN_TYPES, SCAFFOLD_TEMPLATES } from './types';
import type { ScaffoldColumn, ScaffoldFs, ScaffoldPlan } from './types';

const IDENTIFIER_PATTERN = /^[a-z][a-z0-9_]*$/;
const LIBRARY_PATTERN = /^[a-z][a-z0-9-]*$/;
const ROUTE_PATTERN = /^\/[a-z0-9][a-z0-9\-/]*$/;
const API_PATH_PATTERN = /^\/[a-z0-9][a-z0-9\-/]*$/;
const ROLE_SLUG_PATTERN = /^[a-z][a-z0-9-]*$/;
const ICON_PATTERN = /^[a-z][a-z0-9-]*$/;

/** Colunas geradas automaticamente pelo YAML; não podem ser redeclaradas. */
const RESERVED_COLUMNS = new Set(['id', 'created_at', 'updated_at']);

export type ScaffoldValidationIssue = {
  field: string;
  message: string;
};

function validateColumn(
  column: ScaffoldColumn,
  index: number,
  issues: ScaffoldValidationIssue[]
) {
  const field = `columns[${index}]`;

  if (!IDENTIFIER_PATTERN.test(column.name)) {
    issues.push({
      field,
      message: `Nome de coluna inválido: "${column.name}". Use snake_case começando por letra.`,
    });
  }

  if (RESERVED_COLUMNS.has(column.name)) {
    issues.push({
      field,
      message: `A coluna "${column.name}" é gerada automaticamente e não deve ser declarada.`,
    });
  }

  if (!SCAFFOLD_COLUMN_TYPES.includes(column.type)) {
    issues.push({ field, message: `Tipo de coluna inválido: "${column.type}".` });
  }

  if (column.type === 'enum') {
    const values = column.enumValues ?? [];

    if (values.length < 2) {
      issues.push({
        field,
        message: `A coluna enum "${column.name}" precisa de ao menos dois valores.`,
      });
    }

    if (values.some((value) => !IDENTIFIER_PATTERN.test(value))) {
      issues.push({
        field,
        message: `Valores de enum inválidos em "${column.name}". Use snake_case.`,
      });
    }
  }

  if (column.type === 'fk' && !IDENTIFIER_PATTERN.test(column.referencesTable ?? '')) {
    issues.push({
      field,
      message: `A coluna "${column.name}" é uma FK e precisa de uma tabela de destino válida.`,
    });
  }
}

export function validatePlan(
  plan: ScaffoldPlan,
  fs: ScaffoldFs
): ScaffoldValidationIssue[] {
  const issues: ScaffoldValidationIssue[] = [];

  if (!LIBRARY_PATTERN.test(plan.library)) {
    issues.push({ field: 'library', message: 'Biblioteca inválida.' });
  } else if (!fs.exists(`libraries/${plan.library}`)) {
    issues.push({
      field: 'library',
      message: `Biblioteca "${plan.library}" não existe em libraries/.`,
    });
  }

  if (!IDENTIFIER_PATTERN.test(plan.entity)) {
    issues.push({
      field: 'entity',
      message: 'Nome da entidade inválido. Use snake_case singular, ex.: service_order.',
    });
  }

  if (!ROUTE_PATTERN.test(plan.route)) {
    issues.push({
      field: 'route',
      message: 'Rota inválida. Use letras minúsculas, números, hífen e barra, ex.: /crm/contracts.',
    });
  } else if (!plan.route.startsWith(`/${plan.library}/`)) {
    issues.push({
      field: 'route',
      message: `A rota precisa começar por /${plan.library}/ para ficar dentro da biblioteca.`,
    });
  }

  if (plan.route.endsWith('/')) {
    issues.push({ field: 'route', message: 'A rota não pode terminar com barra.' });
  }

  if (!SCAFFOLD_TEMPLATES.includes(plan.template)) {
    issues.push({ field: 'template', message: 'Template desconhecido.' });
  }

  if (!plan.labelEn.trim() || !plan.labelPt.trim()) {
    issues.push({ field: 'label', message: 'Informe o título em inglês e em português.' });
  }

  if (plan.generateBackend) {
    if (!API_PATH_PATTERN.test(plan.apiBasePath)) {
      issues.push({
        field: 'apiBasePath',
        message: 'Prefixo da API inválido. Ex.: /service-order.',
      });
    }

    if (plan.columns.length === 0) {
      issues.push({
        field: 'columns',
        message: 'Informe ao menos uma coluna para gerar a tabela e o CRUD.',
      });
    }
  }

  const seen = new Set<string>();

  plan.columns.forEach((column, index) => {
    if (seen.has(column.name)) {
      issues.push({
        field: `columns[${index}]`,
        message: `Coluna duplicada: "${column.name}".`,
      });
    }

    seen.add(column.name);
    validateColumn(column, index, issues);
  });

  if (!ICON_PATTERN.test(plan.menu.icon)) {
    issues.push({
      field: 'menu.icon',
      message: 'Ícone inválido. Use o nome kebab-case do ícone lucide, ex.: file-text.',
    });
  }

  if (!Number.isInteger(plan.menu.order) || plan.menu.order < 0) {
    issues.push({ field: 'menu.order', message: 'Ordem do menu inválida.' });
  }

  plan.roles.forEach((role) => {
    if (!ROLE_SLUG_PATTERN.test(role)) {
      issues.push({ field: 'roles', message: `Slug de cargo inválido: "${role}".` });
    }
  });

  if (plan.newRole && !ROLE_SLUG_PATTERN.test(plan.newRole.slug)) {
    issues.push({ field: 'newRole', message: 'Slug do novo cargo inválido.' });
  }

  return issues;
}
