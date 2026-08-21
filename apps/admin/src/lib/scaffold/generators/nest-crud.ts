import { toCamelCase, toKebabCase, toPascalCase } from '../naming';
import type { ScaffoldColumn, ScaffoldPlan } from '../types';

export type NestNames = {
  pascal: string;
  camel: string;
  kebab: string;
  dir: string;
  dtoClass: string;
  serviceClass: string;
  controllerClass: string;
  moduleClass: string;
};

export function nestNames(plan: ScaffoldPlan): NestNames {
  const pascal = toPascalCase(plan.entity);
  const kebab = toKebabCase(plan.entity);

  return {
    pascal,
    camel: toCamelCase(plan.entity),
    kebab,
    dir: `libraries/${plan.library}/src/${kebab}`,
    dtoClass: `${pascal}DTO`,
    serviceClass: `${pascal}Service`,
    controllerClass: `${pascal}Controller`,
    moduleClass: `${pascal}Module`,
  };
}

/** Colunas traduzíveis vivem na tabela `<entity>_locale` e não entram no DTO. */
function isLocaleColumn(column: ScaffoldColumn): boolean {
  return column.type === 'locale_varchar' || column.type === 'locale_text';
}

function scalarColumns(plan: ScaffoldPlan): ScaffoldColumn[] {
  return plan.columns.filter((column) => !isLocaleColumn(column));
}

export function columnTsType(column: ScaffoldColumn, names: NestNames): string {
  switch (column.type) {
    case 'int':
    case 'fk':
    case 'decimal':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'enum':
      return `${names.pascal}${toPascalCase(column.name)}`;
    default:
      return 'string';
  }
}

function enumBlocks(plan: ScaffoldPlan, names: NestNames): string {
  return plan.columns
    .filter((column) => column.type === 'enum')
    .map((column) => {
      const enumName = `${names.pascal}${toPascalCase(column.name)}`;
      const members = (column.enumValues ?? [])
        .map((value) => `  ${value.toUpperCase()} = '${value}',`)
        .join('\n');

      return `export enum ${enumName} {\n${members}\n}`;
    })
    .join('\n\n');
}

function dtoValidators(column: ScaffoldColumn, names: NestNames): string[] {
  const lines: string[] = [];

  switch (column.type) {
    case 'int':
    case 'fk':
      lines.push('  @IsInt()');
      break;
    case 'decimal':
      lines.push('  @IsNumber()');
      break;
    case 'boolean':
      lines.push('  @IsBoolean()');
      break;
    case 'date':
    case 'datetime':
      lines.push('  @IsDateString()');
      break;
    case 'enum':
      lines.push(`  @IsEnum(${names.pascal}${toPascalCase(column.name)})`);
      break;
    case 'jsonb':
      lines.push('  @IsObject()');
      break;
    default:
      lines.push('  @IsString()');
      break;
  }

  if (column.nullable || column.defaultValue) {
    lines.push('  @IsOptional()');
  } else {
    lines.push('  @IsNotEmpty()');
  }

  return lines;
}

export function generateDto(plan: ScaffoldPlan): string {
  const names = nestNames(plan);
  const columns = scalarColumns(plan);

  const validators = new Set<string>();
  columns.forEach((column) => {
    dtoValidators(column, names).forEach((line) => {
      const match = line.match(/@(\w+)/);
      if (match?.[1]) {
        validators.add(match[1]);
      }
    });
  });

  const fields = columns
    .map((column) => {
      const optional = column.nullable || column.defaultValue ? '?' : '';

      return [
        ...dtoValidators(column, names),
        `  ${column.name}${optional}: ${columnTsType(column, names)};`,
      ].join('\n');
    })
    .join('\n\n');

  const enums = enumBlocks(plan, names);

  return [
    `import {\n${[...validators]
      .sort()
      .map((validator) => `  ${validator},`)
      .join('\n')}\n} from 'class-validator';`,
    '',
    ...(enums ? [enums, ''] : []),
    `export class ${names.dtoClass} {`,
    fields,
    '}',
    '',
  ].join('\n');
}

function searchableColumns(plan: ScaffoldPlan): ScaffoldColumn[] {
  return plan.columns.filter(
    (column) =>
      column.type === 'varchar' || column.type === 'text' || column.type === 'slug'
  );
}

function filterableColumns(plan: ScaffoldPlan): ScaffoldColumn[] {
  return plan.columns.filter(
    (column) =>
      column.inFilters &&
      (column.type === 'enum' || column.type === 'boolean' || column.type === 'fk')
  );
}

function statsBlock(plan: ScaffoldPlan, names: NestNames): string {
  const enumColumn = plan.columns.find((column) => column.type === 'enum');

  if (!enumColumn) {
    return [
      '  async getStats() {',
      `    const total = await this.prisma.${plan.entity}.count();`,
      '',
      '    return { total };',
      '  }',
    ].join('\n');
  }

  const values = enumColumn.enumValues ?? [];
  const counts = values
    .map(
      (value) =>
        `      this.prisma.${plan.entity}.count({ where: { ${enumColumn.name}: '${value}' } }),`
    )
    .join('\n');
  const destructured = ['total', ...values.map((value) => toCamelCase(value))].join(
    ', '
  );
  const returned = ['total', ...values.map((value) => toCamelCase(value))]
    .map((key) => `      ${key},`)
    .join('\n');

  return [
    '  async getStats() {',
    `    const [${destructured}] = await Promise.all([`,
    `      this.prisma.${plan.entity}.count(),`,
    counts,
    '    ]);',
    '',
    '    return {',
    returned,
    '    };',
    '  }',
    `  // ${names.pascal}: contadores por "${enumColumn.name}" alimentam os KPIs da listagem.`,
  ].join('\n');
}

export function generateService(plan: ScaffoldPlan): string {
  const names = nestNames(plan);
  const searchable = searchableColumns(plan);
  const filterable = filterableColumns(plan);

  const searchBlock =
    searchable.length > 0
      ? [
          '    const searchRaw = (paginationParams.search ?? "").toString().trim();',
          '',
          '    if (searchRaw) {',
          '      where.OR = [',
          ...searchable.map(
            (column) =>
              `        { ${column.name}: { contains: searchRaw, mode: 'insensitive' as const } },`
          ),
          '      ];',
          '    }',
          '',
        ]
      : [];

  const filterBlocks = filterable.map((column) =>
    [
      `    if (paginationParams.${column.name} != null && paginationParams.${column.name} !== 'all') {`,
      `      where.${column.name} = paginationParams.${column.name};`,
      '    }',
      '',
    ].join('\n')
  );

  const methods: string[] = [];

  if (plan.endpoints.list) {
    methods.push(
      [
        '  async list(paginationParams) {',
        '    const where: Record<string, unknown> = {};',
        '',
        ...searchBlock,
        ...filterBlocks,
        '    const [data, total] = await Promise.all([',
        `      this.prisma.${plan.entity}.findMany({`,
        '        where,',
        '        skip: paginationParams.skip,',
        '        take: paginationParams.take,',
        "        orderBy: { id: 'desc' },",
        '      }),',
        `      this.prisma.${plan.entity}.count({ where }),`,
        '    ]);',
        '',
        '    const pageSize = paginationParams.take;',
        '    const page = Math.floor(paginationParams.skip / pageSize) + 1;',
        '    const lastPage = Math.max(1, Math.ceil(total / pageSize));',
        '',
        '    return {',
        '      data,',
        '      total,',
        '      page,',
        '      pageSize,',
        '      lastPage,',
        '      prev: page > 1 ? page - 1 : null,',
        '      next: page < lastPage ? page + 1 : null,',
        '    };',
        '  }',
      ].join('\n')
    );
  }

  if (plan.endpoints.stats) {
    methods.push(statsBlock(plan, names));
  }

  if (plan.endpoints.get) {
    methods.push(
      [
        '  async getById(id: number, locale: string) {',
        `    const item = await this.prisma.${plan.entity}.findUnique({ where: { id } });`,
        '',
        '    if (!item) {',
        '      throw new BadRequestException(',
        `        getLocaleText('itemNotFound', locale, '${names.pascal} not found'),`,
        '      );',
        '    }',
        '',
        '    return item;',
        '  }',
      ].join('\n')
    );
  }

  if (plan.endpoints.create) {
    methods.push(
      [
        `  async create(data: ${names.dtoClass}) {`,
        `    return this.prisma.${plan.entity}.create({ data });`,
        '  }',
      ].join('\n')
    );
  }

  if (plan.endpoints.update) {
    methods.push(
      [
        `  async update(id: number, data: Partial<${names.dtoClass}>, locale: string) {`,
        '    await this.getByIdOrFail(id, locale);',
        '',
        `    return this.prisma.${plan.entity}.update({ where: { id }, data });`,
        '  }',
      ].join('\n')
    );
  }

  if (plan.endpoints.remove) {
    methods.push(
      [
        '  async delete(id: number, locale: string) {',
        '    await this.getByIdOrFail(id, locale);',
        '',
        `    return this.prisma.${plan.entity}.delete({ where: { id } });`,
        '  }',
      ].join('\n')
    );
  }

  if (plan.endpoints.update || plan.endpoints.remove) {
    methods.push(
      [
        '  private async getByIdOrFail(id: number, locale: string) {',
        `    const item = await this.prisma.${plan.entity}.findUnique({ where: { id } });`,
        '',
        '    if (!item) {',
        '      throw new BadRequestException(',
        `        getLocaleText('itemNotFound', locale, '${names.pascal} not found'),`,
        '      );',
        '    }',
        '',
        '    return item;',
        '  }',
      ].join('\n')
    );
  }

  const needsLocale =
    plan.endpoints.get || plan.endpoints.update || plan.endpoints.remove;

  const imports = [
    ...(needsLocale ? ["import { getLocaleText } from '@hed-hog/api-locale';"] : []),
    "import { PrismaService } from '@hed-hog/api-prisma';",
    needsLocale
      ? "import { BadRequestException, Injectable } from '@nestjs/common';"
      : "import { Injectable } from '@nestjs/common';",
    ...(plan.endpoints.create || plan.endpoints.update
      ? [`import { ${names.dtoClass} } from './dto/${names.kebab}.dto';`]
      : []),
  ];

  return [
    ...imports,
    '',
    '@Injectable()',
    `export class ${names.serviceClass} {`,
    '  constructor(private readonly prisma: PrismaService) {}',
    '',
    methods.join('\n\n'),
    '}',
    '',
  ].join('\n');
}

export function generateController(plan: ScaffoldPlan): string {
  const names = nestNames(plan);
  const controllerPath = plan.apiBasePath.replace(/^\//, '');
  const methods: string[] = [];
  const nestImports = new Set(['Controller']);

  if (plan.endpoints.list) {
    nestImports.add('Get');
    methods.push(
      [
        '  @Get()',
        '  async list(@Pagination() paginationParams) {',
        `    return this.${names.camel}Service.list(paginationParams);`,
        '  }',
      ].join('\n')
    );
  }

  if (plan.endpoints.stats) {
    nestImports.add('Get');
    methods.push(
      [
        "  @Get('stats')",
        '  async stats() {',
        `    return this.${names.camel}Service.getStats();`,
        '  }',
      ].join('\n')
    );
  }

  if (plan.endpoints.get) {
    nestImports.add('Get');
    nestImports.add('Param');
    nestImports.add('ParseIntPipe');
    methods.push(
      [
        "  @Get(':id')",
        '  async getById(',
        "    @Param('id', ParseIntPipe) id: number,",
        '    @Locale() locale: string,',
        '  ) {',
        `    return this.${names.camel}Service.getById(id, locale);`,
        '  }',
      ].join('\n')
    );
  }

  if (plan.endpoints.create) {
    nestImports.add('Post');
    nestImports.add('Body');
    methods.push(
      [
        '  @Post()',
        `  async create(@Body() data: ${names.dtoClass}) {`,
        `    return this.${names.camel}Service.create(data);`,
        '  }',
      ].join('\n')
    );
  }

  if (plan.endpoints.update) {
    nestImports.add('Patch');
    nestImports.add('Body');
    nestImports.add('Param');
    nestImports.add('ParseIntPipe');
    methods.push(
      [
        "  @Patch(':id')",
        '  async update(',
        "    @Param('id', ParseIntPipe) id: number,",
        `    @Body() data: Partial<${names.dtoClass}>,`,
        '    @Locale() locale: string,',
        '  ) {',
        `    return this.${names.camel}Service.update(id, data, locale);`,
        '  }',
      ].join('\n')
    );
  }

  if (plan.endpoints.remove) {
    nestImports.add('Delete');
    nestImports.add('Param');
    nestImports.add('ParseIntPipe');
    methods.push(
      [
        "  @Delete(':id')",
        '  async delete(',
        "    @Param('id', ParseIntPipe) id: number,",
        '    @Locale() locale: string,',
        '  ) {',
        `    return this.${names.camel}Service.delete(id, locale);`,
        '  }',
      ].join('\n')
    );
  }

  const usesLocale = methods.some((method) => method.includes('@Locale()'));
  const usesDto = plan.endpoints.create || plan.endpoints.update;

  return [
    "import { Role } from '@hed-hog/api';",
    ...(usesLocale ? ["import { Locale } from '@hed-hog/api-locale';"] : []),
    ...(plan.endpoints.list
      ? ["import { Pagination } from '@hed-hog/api-pagination';"]
      : []),
    `import {\n${[...nestImports]
      .sort()
      .map((name) => `  ${name},`)
      .join('\n')}\n} from '@nestjs/common';`,
    ...(usesDto
      ? [`import { ${names.dtoClass} } from './dto/${names.kebab}.dto';`]
      : []),
    `import { ${names.serviceClass} } from './${names.kebab}.service';`,
    '',
    '@Role()',
    `@Controller('${controllerPath}')`,
    `export class ${names.controllerClass} {`,
    `  constructor(private readonly ${names.camel}Service: ${names.serviceClass}) {}`,
    '',
    methods.join('\n\n'),
    '}',
    '',
  ].join('\n');
}

export function generateModule(plan: ScaffoldPlan): string {
  const names = nestNames(plan);

  return [
    "import { PaginationModule } from '@hed-hog/api-pagination';",
    "import { PrismaModule } from '@hed-hog/api-prisma';",
    "import { forwardRef, Module } from '@nestjs/common';",
    `import { ${names.controllerClass} } from './${names.kebab}.controller';`,
    `import { ${names.serviceClass} } from './${names.kebab}.service';`,
    '',
    '@Module({',
    '  imports: [forwardRef(() => PrismaModule), forwardRef(() => PaginationModule)],',
    `  controllers: [${names.controllerClass}],`,
    `  providers: [${names.serviceClass}],`,
    `  exports: [${names.serviceClass}],`,
    '})',
    `export class ${names.moduleClass} {}`,
    '',
  ].join('\n');
}
