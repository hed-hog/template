import type { ScaffoldColumn, ScaffoldPlan } from '../types';

const DEFAULT_VARCHAR_LENGTH = 255;
const DEFAULT_DECIMAL_PRECISION = 12;
const DEFAULT_DECIMAL_SCALE = 2;

/** Escapa apenas o necessário para valores escalares em YAML de bloco. */
export function yamlString(value: string): string {
  const needsQuotes =
    value === '' ||
    /^[\s>|&*!%@`{}[\],#?:-]/.test(value) ||
    /:\s|\s#/.test(value) ||
    /[\n"']/.test(value) ||
    /^(true|false|null|yes|no|on|off|~)$/i.test(value) ||
    /^-?\d+(\.\d+)?$/.test(value);

  if (!needsQuotes) {
    return value;
  }

  return `'${value.replace(/'/g, "''")}'`;
}

function columnLines(column: ScaffoldColumn): string[] {
  const lines = [`  - name: ${column.name}`];

  switch (column.type) {
    case 'varchar':
      lines.push('    type: varchar');
      lines.push(`    length: ${column.length ?? DEFAULT_VARCHAR_LENGTH}`);
      break;
    case 'decimal':
      lines.push('    type: decimal');
      lines.push(`    precision: ${column.precision ?? DEFAULT_DECIMAL_PRECISION}`);
      lines.push(`    scale: ${column.scale ?? DEFAULT_DECIMAL_SCALE}`);
      break;
    case 'locale_varchar':
    case 'locale_text':
      lines.push(`    type: ${column.type}`);
      if (column.type === 'locale_varchar') {
        lines.push(`    length: ${column.length ?? DEFAULT_VARCHAR_LENGTH}`);
      }
      break;
    case 'enum':
      lines.push('    type: enum');
      lines.push(`    values: [${(column.enumValues ?? []).join(', ')}]`);
      break;
    case 'fk':
      lines.push('    type: fk');
      break;
    default:
      lines.push(`    type: ${column.type}`);
      break;
  }

  if (column.nullable) {
    lines.push('    isNullable: true');
  }

  if (column.defaultValue != null && column.defaultValue !== '') {
    lines.push(`    default: ${yamlString(column.defaultValue)}`);
  }

  if (column.type === 'fk') {
    lines.push('    references:');
    lines.push(`      table: ${column.referencesTable}`);
    lines.push('      column: id');
    lines.push(`      onDelete: ${column.nullable ? 'SET NULL' : 'CASCADE'}`);
  }

  // Texto exibido ao usuário mora na tabela `<table>_locale`, gerada pelo CLI a
  // partir das colunas `locale_*`; o bloco `locale` nomeia a coluna traduzida.
  if (column.type === 'locale_varchar' || column.type === 'locale_text') {
    lines.push('    locale:');
    lines.push(`      en: ${yamlString(column.labelEn)}`);
    lines.push(`      pt: ${yamlString(column.labelPt)}`);
  }

  return lines;
}

export function generateTableYaml(plan: ScaffoldPlan): string {
  const lines = ['columns:', '  - type: pk'];

  plan.columns.forEach((column) => {
    if (column.type === 'slug') {
      lines.push('  - type: slug');
      return;
    }

    lines.push(...columnLines(column));
  });

  lines.push('  - type: created_at');
  lines.push('  - type: updated_at');

  const indexed = plan.columns.filter(
    (column) => column.type === 'fk' || column.type === 'enum'
  );

  if (indexed.length > 0) {
    lines.push('');
    lines.push('indices:');
    indexed.forEach((column) => {
      lines.push(`  - columns: [${column.name}]`);
    });
  }

  return `${lines.join('\n')}\n`;
}

export function generateMenuYamlEntry(plan: ScaffoldPlan): string {
  const lines: string[] = [];

  if (plan.menu.parentSlug) {
    lines.push('- menu_id:');
    lines.push('    where:');
    lines.push(`      slug: ${plan.menu.parentSlug}`);
    lines.push(`  url: ${plan.route}`);
  } else {
    lines.push(`- url: ${plan.route}`);
  }

  lines.push(`  order: ${plan.menu.order}`);
  lines.push(`  icon: ${plan.menu.icon}`);
  lines.push('  name:');
  lines.push(`    en: ${yamlString(plan.labelEn)}`);
  lines.push(`    pt: ${yamlString(plan.labelPt)}`);
  lines.push(`  slug: ${plan.route}`);
  lines.push('  relations:');
  lines.push('    role:');

  plan.roles.forEach((role) => {
    lines.push('      - where:');
    lines.push(`          slug: ${role}`);
  });

  return `${lines.join('\n')}\n`;
}

export type ScaffoldApiRoute = {
  url: string;
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
};

/** Rotas HTTP correspondentes aos endpoints escolhidos no wizard. */
export function buildApiRoutes(plan: ScaffoldPlan): ScaffoldApiRoute[] {
  const base = plan.apiBasePath;
  const routes: ScaffoldApiRoute[] = [];

  if (plan.endpoints.list) {
    routes.push({ url: base, method: 'GET' });
  }

  if (plan.endpoints.stats) {
    routes.push({ url: `${base}/stats`, method: 'GET' });
  }

  if (plan.endpoints.create) {
    routes.push({ url: base, method: 'POST' });
  }

  if (plan.endpoints.get) {
    routes.push({ url: `${base}/:id`, method: 'GET' });
  }

  if (plan.endpoints.update) {
    routes.push({ url: `${base}/:id`, method: 'PATCH' });
  }

  if (plan.endpoints.remove) {
    routes.push({ url: `${base}/:id`, method: 'DELETE' });
  }

  return routes;
}

export function generateRouteYamlEntries(plan: ScaffoldPlan): string {
  const lines: string[] = [];

  buildApiRoutes(plan).forEach((route) => {
    lines.push(`- url: ${route.url}`);
    lines.push(`  method: ${route.method}`);
    lines.push('  type: HTTP');
    lines.push('  relations:');
    lines.push('    role:');

    plan.roles.forEach((role) => {
      lines.push('      - where:');
      lines.push(`          slug: ${role}`);
    });
  });

  return lines.length > 0 ? `${lines.join('\n')}\n` : '';
}

export function generateRoleYamlEntry(plan: ScaffoldPlan): string {
  if (!plan.newRole) {
    return '';
  }

  const role = plan.newRole;

  return [
    `- slug: ${role.slug}`,
    '  name:',
    `    en: ${yamlString(role.nameEn)}`,
    `    pt: ${yamlString(role.namePt)}`,
    '  description:',
    `    en: ${yamlString(role.descriptionEn)}`,
    `    pt: ${yamlString(role.descriptionPt)}`,
    '',
  ].join('\n');
}
