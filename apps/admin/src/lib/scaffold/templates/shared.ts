import { toKebabCase, toPascalCase } from '../naming';
import type { ScaffoldColumn, ScaffoldPlan } from '../types';

export type GeneratedFile = {
  /** Caminho relativo ao diretório da página. */
  relativePath: string;
  contents: string;
};

export type TemplateOutput = {
  page: string;
  components: GeneratedFile[];
};

export function entityNames(plan: ScaffoldPlan) {
  const pascal = toPascalCase(plan.entity);
  const kebab = toKebabCase(plan.entity);

  return {
    pascal,
    kebab,
    typesModule: `${kebab}-types`,
    formSheetModule: `${kebab}-form-sheet`,
    formSheetComponent: `${pascal}FormSheet`,
    pageComponent: `${pascal}Page`,
  };
}

export function isLocaleColumn(column: ScaffoldColumn): boolean {
  return column.type === 'locale_varchar' || column.type === 'locale_text';
}

/** Colunas que existem na tabela principal e, portanto, no payload da API. */
export function scalarColumns(plan: ScaffoldPlan): ScaffoldColumn[] {
  return plan.columns.filter((column) => !isLocaleColumn(column));
}

export function tsType(column: ScaffoldColumn): string {
  switch (column.type) {
    case 'int':
    case 'fk':
    case 'decimal':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return (column.enumValues ?? []).map((value) => `'${value}'`).join(' | ') || 'string';
    case 'jsonb':
      return 'unknown';
    default:
      return 'string';
  }
}

export function fieldType(column: ScaffoldColumn): string {
  const base = tsType(column);
  return column.nullable ? `${base} | null` : base;
}

export function defaultValueLiteral(column: ScaffoldColumn): string {
  if (column.nullable) {
    return 'null';
  }

  switch (column.type) {
    case 'int':
    case 'fk':
    case 'decimal':
      return column.defaultValue ?? '0';
    case 'boolean':
      return column.defaultValue ?? 'false';
    case 'enum':
      return `'${column.defaultValue ?? column.enumValues?.[0] ?? ''}'`;
    default:
      return column.defaultValue ? `'${column.defaultValue}'` : "''";
  }
}

export function zodSchemaLine(column: ScaffoldColumn): string {
  let base: string;

  switch (column.type) {
    case 'int':
    case 'fk':
      base = 'z.coerce.number().int()';
      break;
    case 'decimal':
      base = 'z.coerce.number()';
      break;
    case 'boolean':
      base = 'z.boolean()';
      break;
    case 'enum':
      base = `z.enum([${(column.enumValues ?? [])
        .map((value) => `'${value}'`)
        .join(', ')}])`;
      break;
    default:
      base = 'z.string()';
      break;
  }

  if (column.nullable) {
    return `  ${column.name}: ${base}.nullable().optional(),`;
  }

  if (column.type === 'varchar' || column.type === 'text' || column.type === 'slug') {
    return `  ${column.name}: ${base}.min(1),`;
  }

  return `  ${column.name}: ${base},`;
}

export function generateTypesFile(plan: ScaffoldPlan): string {
  const names = entityNames(plan);
  const columns = scalarColumns(plan);

  const entityFields = columns
    .map((column) => `  ${column.name}: ${fieldType(column)};`)
    .join('\n');

  const formFields = columns
    .map((column) => `  ${column.name}: ${fieldType(column)};`)
    .join('\n');

  return [
    `export type ${names.pascal} = {`,
    '  id: number;',
    entityFields,
    '  created_at: string;',
    '  updated_at: string;',
    '};',
    '',
    `export type ${names.pascal}FormValues = {`,
    formFields,
    '};',
    '',
    'export type PaginatedResult<T> = {',
    '  data: T[];',
    '  total: number;',
    '  page: number;',
    '  pageSize: number;',
    '  lastPage: number;',
    '  prev: number | null;',
    '  next: number | null;',
    '};',
    '',
  ].join('\n');
}

/** Campo do formulário correspondente ao tipo da coluna. */
export function formFieldJsx(column: ScaffoldColumn): string {
  const label = `{t('field${toPascalCase(column.name)}')}`;

  if (column.type === 'boolean') {
    return [
      `        <FormField`,
      `          control={form.control}`,
      `          name="${column.name}"`,
      `          render={({ field }) => (`,
      `            <FormItem className="flex items-center justify-between rounded-lg border p-3">`,
      `              <FormLabel>${label}</FormLabel>`,
      `              <FormControl>`,
      `                <Switch`,
      `                  checked={Boolean(field.value)}`,
      `                  onCheckedChange={field.onChange}`,
      `                />`,
      `              </FormControl>`,
      `            </FormItem>`,
      `          )}`,
      `        />`,
    ].join('\n');
  }

  if (column.type === 'enum') {
    const options = (column.enumValues ?? [])
      .map(
        (value) =>
          `                    <SelectItem value="${value}">{t('${column.name}_${value}')}</SelectItem>`
      )
      .join('\n');

    return [
      `        <FormField`,
      `          control={form.control}`,
      `          name="${column.name}"`,
      `          render={({ field }) => (`,
      `            <FormItem>`,
      `              <FormLabel>${label}</FormLabel>`,
      `              <Select`,
      `                value={field.value ?? undefined}`,
      `                onValueChange={field.onChange}`,
      `              >`,
      `                <FormControl>`,
      `                  <SelectTrigger className="w-full">`,
      `                    <SelectValue />`,
      `                  </SelectTrigger>`,
      `                </FormControl>`,
      `                <SelectContent>`,
      options,
      `                </SelectContent>`,
      `              </Select>`,
      `              <FormMessage />`,
      `            </FormItem>`,
      `          )}`,
      `        />`,
    ].join('\n');
  }

  if (column.type === 'text') {
    return [
      `        <FormField`,
      `          control={form.control}`,
      `          name="${column.name}"`,
      `          render={({ field }) => (`,
      `            <FormItem>`,
      `              <FormLabel>${label}</FormLabel>`,
      `              <FormControl>`,
      `                <Textarea rows={4} {...field} value={field.value ?? ''} />`,
      `              </FormControl>`,
      `              <FormMessage />`,
      `            </FormItem>`,
      `          )}`,
      `        />`,
    ].join('\n');
  }

  const inputType =
    column.type === 'int' || column.type === 'fk' || column.type === 'decimal'
      ? 'number'
      : column.type === 'date'
        ? 'date'
        : column.type === 'datetime'
          ? 'datetime-local'
          : 'text';

  return [
    `        <FormField`,
    `          control={form.control}`,
    `          name="${column.name}"`,
    `          render={({ field }) => (`,
    `            <FormItem>`,
    `              <FormLabel>${label}</FormLabel>`,
    `              <FormControl>`,
    `                <Input type="${inputType}" {...field} value={field.value ?? ''} />`,
    `              </FormControl>`,
    `              <FormMessage />`,
    `            </FormItem>`,
    `          )}`,
    `        />`,
  ].join('\n');
}

/** Renderização da célula na tabela / do valor no card. */
export function cellExpression(column: ScaffoldColumn, variable: string): string {
  if (column.type === 'boolean') {
    return `${variable}.${column.name} ? t('allOption') : '-'`;
  }

  if (column.type === 'enum') {
    return `${variable}.${column.name} ? t(\`${column.name}_\${${variable}.${column.name}}\` as never) : '-'`;
  }

  return `${variable}.${column.name} ?? '-'`;
}
