import type { ScaffoldColumn, ScaffoldPlan } from '../types';
import { buildApiRoutes } from './yaml';

const DEFAULT_VARCHAR_LENGTH = 255;
const DEFAULT_DECIMAL_PRECISION = 12;
const DEFAULT_DECIMAL_SCALE = 2;

/** Aspas simples duplicadas: os valores vêm de campos já validados por regex. */
function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

export function enumTypeName(table: string, column: string): string {
  return `${table}_${column}_enum`;
}

function columnSqlType(plan: ScaffoldPlan, column: ScaffoldColumn): string {
  switch (column.type) {
    case 'varchar':
      return `VARCHAR(${column.length ?? DEFAULT_VARCHAR_LENGTH})`;
    case 'slug':
      return 'VARCHAR(255)';
    case 'text':
      return 'TEXT';
    case 'int':
    case 'fk':
      return 'INTEGER';
    case 'decimal':
      return `DECIMAL(${column.precision ?? DEFAULT_DECIMAL_PRECISION}, ${
        column.scale ?? DEFAULT_DECIMAL_SCALE
      })`;
    case 'boolean':
      return 'BOOLEAN';
    case 'date':
      return 'DATE';
    case 'datetime':
      return 'TIMESTAMPTZ';
    case 'jsonb':
      return 'JSONB';
    case 'enum':
      return `"${enumTypeName(plan.entity, column.name)}"`;
    default:
      return 'VARCHAR(255)';
  }
}

function columnDefaultSql(column: ScaffoldColumn): string {
  if (column.defaultValue == null || column.defaultValue === '') {
    return '';
  }

  if (column.type === 'boolean' || column.type === 'int' || column.type === 'decimal') {
    return ` DEFAULT ${column.defaultValue}`;
  }

  return ` DEFAULT ${sqlLiteral(column.defaultValue)}`;
}

/** Colunas traduzíveis não vivem na tabela principal, e sim em `<table>_locale`. */
function isLocaleColumn(column: ScaffoldColumn): boolean {
  return column.type === 'locale_varchar' || column.type === 'locale_text';
}

function tableTriggerSql(table: string): string[] {
  return [
    `DROP TRIGGER IF EXISTS trg_touch_updated_at ON "${table}";`,
    `CREATE TRIGGER trg_touch_updated_at BEFORE UPDATE ON "${table}"`,
    '  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();',
  ];
}

function buildEnums(plan: ScaffoldPlan): string[] {
  const lines: string[] = [];

  plan.columns
    .filter((column) => column.type === 'enum')
    .forEach((column) => {
      const values = (column.enumValues ?? []).map(sqlLiteral).join(', ');

      lines.push('DO $$ BEGIN');
      lines.push(
        `  CREATE TYPE "${enumTypeName(plan.entity, column.name)}" AS ENUM (${values});`
      );
      lines.push('EXCEPTION WHEN duplicate_object THEN NULL;');
      lines.push('END $$;');
      lines.push('');
    });

  return lines;
}

function buildMainTable(plan: ScaffoldPlan): string[] {
  const table = plan.entity;
  const columnDefs: string[] = ['  "id" SERIAL NOT NULL'];
  const constraints: string[] = [`  CONSTRAINT "${table}_pkey" PRIMARY KEY ("id")`];
  const indices: string[] = [];

  plan.columns.filter((column) => !isLocaleColumn(column)).forEach((column) => {
    const nullability = column.nullable ? 'NULL' : 'NOT NULL';

    columnDefs.push(
      `  "${column.name}" ${columnSqlType(plan, column)} ${nullability}${columnDefaultSql(column)}`
    );

    if (column.type === 'fk') {
      constraints.push(
        [
          `  CONSTRAINT "${table}_${column.name}_fkey"`,
          `    FOREIGN KEY ("${column.name}") REFERENCES "${column.referencesTable}"("id")`,
          `    ON DELETE ${column.nullable ? 'SET NULL' : 'CASCADE'} ON UPDATE CASCADE`,
        ].join('\n')
      );

      indices.push(
        `CREATE INDEX IF NOT EXISTS "${table}_${column.name}_idx" ON "${table}" ("${column.name}");`
      );
    }

    if (column.type === 'enum') {
      indices.push(
        `CREATE INDEX IF NOT EXISTS "${table}_${column.name}_idx" ON "${table}" ("${column.name}");`
      );
    }

    if (column.type === 'slug') {
      indices.push(
        `CREATE UNIQUE INDEX IF NOT EXISTS "${table}_${column.name}_key" ON "${table}" ("${column.name}");`
      );
    }
  });

  columnDefs.push(
    '  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()',
    '  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()'
  );

  const lines = [
    `-- CreateTable ${table}`,
    `CREATE TABLE IF NOT EXISTS "${table}" (`,
    [...columnDefs, ...constraints].join(',\n'),
    ');',
    '',
  ];

  if (indices.length > 0) {
    lines.push(...indices, '');
  }

  lines.push(...tableTriggerSql(table), '');

  return lines;
}

function buildLocaleTable(plan: ScaffoldPlan): string[] {
  const localeColumns = plan.columns.filter(isLocaleColumn);

  if (localeColumns.length === 0) {
    return [];
  }

  const table = `${plan.entity}_locale`;
  const columnDefs = [
    '  "id" SERIAL NOT NULL',
    '  "locale_id" INTEGER NOT NULL',
    `  "${plan.entity}_id" INTEGER NOT NULL`,
  ];

  localeColumns.forEach((column) => {
    const type =
      column.type === 'locale_text'
        ? 'TEXT'
        : `VARCHAR(${column.length ?? DEFAULT_VARCHAR_LENGTH})`;

    columnDefs.push(
      `  "${column.name}" ${type} ${column.nullable ? 'NULL' : 'NOT NULL'}`
    );
  });

  columnDefs.push(
    '  "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()',
    '  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()'
  );

  const constraints = [
    `  CONSTRAINT "${table}_pkey" PRIMARY KEY ("id")`,
    [
      `  CONSTRAINT "${table}_locale_id_fkey"`,
      '    FOREIGN KEY ("locale_id") REFERENCES "locale"("id")',
      '    ON DELETE CASCADE ON UPDATE CASCADE',
    ].join('\n'),
    [
      `  CONSTRAINT "${table}_${plan.entity}_id_fkey"`,
      `    FOREIGN KEY ("${plan.entity}_id") REFERENCES "${plan.entity}"("id")`,
      '    ON DELETE CASCADE ON UPDATE CASCADE',
    ].join('\n'),
  ];

  return [
    `-- CreateTable ${table}`,
    `CREATE TABLE IF NOT EXISTS "${table}" (`,
    [...columnDefs, ...constraints].join(',\n'),
    ');',
    '',
    `CREATE UNIQUE INDEX IF NOT EXISTS "${table}_unique_key"`,
    `  ON "${table}" ("${plan.entity}_id", "locale_id");`,
    '',
    ...tableTriggerSql(table),
    '',
  ];
}

function buildRoleSeed(plan: ScaffoldPlan): string[] {
  if (!plan.newRole) {
    return [];
  }

  const role = plan.newRole;

  return [
    '-- Novo cargo (espelha role.yaml)',
    'DO $$',
    'DECLARE',
    '  v_role_id   INT;',
    '  v_locale_id INT;',
    'BEGIN',
    `  IF NOT EXISTS (SELECT 1 FROM "role" WHERE slug = ${sqlLiteral(role.slug)}) THEN`,
    `    INSERT INTO "role" ("slug", "created_at", "updated_at")`,
    `    VALUES (${sqlLiteral(role.slug)}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    '  END IF;',
    '',
    `  SELECT id INTO v_role_id FROM "role" WHERE slug = ${sqlLiteral(role.slug)} LIMIT 1;`,
    '',
    `  SELECT id INTO v_locale_id FROM "locale" WHERE code = 'en' LIMIT 1;`,
    '  IF v_role_id IS NOT NULL AND v_locale_id IS NOT NULL AND NOT EXISTS (',
    '    SELECT 1 FROM "role_locale" WHERE role_id = v_role_id AND locale_id = v_locale_id',
    '  ) THEN',
    '    INSERT INTO "role_locale" (role_id, locale_id, name, description, created_at, updated_at)',
    `    VALUES (v_role_id, v_locale_id, ${sqlLiteral(role.nameEn)}, ${sqlLiteral(
      role.descriptionEn
    )}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    '  END IF;',
    '',
    `  SELECT id INTO v_locale_id FROM "locale" WHERE code = 'pt' LIMIT 1;`,
    '  IF v_role_id IS NOT NULL AND v_locale_id IS NOT NULL AND NOT EXISTS (',
    '    SELECT 1 FROM "role_locale" WHERE role_id = v_role_id AND locale_id = v_locale_id',
    '  ) THEN',
    '    INSERT INTO "role_locale" (role_id, locale_id, name, description, created_at, updated_at)',
    `    VALUES (v_role_id, v_locale_id, ${sqlLiteral(role.namePt)}, ${sqlLiteral(
      role.descriptionPt
    )}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    '  END IF;',
    'END $$;',
    '',
  ];
}

function buildMenuSeed(plan: ScaffoldPlan): string[] {
  const roleArray = plan.roles.map(sqlLiteral).join(', ');
  const parentLookup = plan.menu.parentSlug
    ? `  SELECT id INTO v_parent_id FROM "menu" WHERE slug = ${sqlLiteral(
        plan.menu.parentSlug
      )} LIMIT 1;`
    : '  v_parent_id := NULL;';

  return [
    '-- Menu (espelha menu.yaml)',
    'DO $$',
    'DECLARE',
    '  v_parent_id INT;',
    '  v_menu_id   INT;',
    '  v_role_id   INT;',
    '  v_locale_id INT;',
    '  v_role_slug TEXT;',
    'BEGIN',
    parentLookup,
    '',
    `  IF NOT EXISTS (SELECT 1 FROM "menu" WHERE slug = ${sqlLiteral(plan.route)}) THEN`,
    '    INSERT INTO "menu" ("menu_id", "url", "icon", "slug", "order", "created_at", "updated_at")',
    `    VALUES (v_parent_id, ${sqlLiteral(plan.route)}, ${sqlLiteral(
      plan.menu.icon
    )}, ${sqlLiteral(plan.route)}, ${plan.menu.order}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    '  END IF;',
    '',
    `  SELECT id INTO v_menu_id FROM "menu" WHERE slug = ${sqlLiteral(plan.route)} LIMIT 1;`,
    '',
    '  IF v_menu_id IS NOT NULL THEN',
    `    FOREACH v_role_slug IN ARRAY ARRAY[${roleArray}]`,
    '    LOOP',
    '      SELECT id INTO v_role_id FROM "role" WHERE slug = v_role_slug LIMIT 1;',
    '      IF v_role_id IS NOT NULL THEN',
    '        INSERT INTO "role_menu" ("role_id", "menu_id")',
    '        SELECT v_role_id, v_menu_id',
    '        WHERE NOT EXISTS (',
    '          SELECT 1 FROM "role_menu" WHERE "role_id" = v_role_id AND "menu_id" = v_menu_id',
    '        );',
    '      END IF;',
    '    END LOOP;',
    '',
    `    SELECT id INTO v_locale_id FROM "locale" WHERE code = 'en' LIMIT 1;`,
    '    IF v_locale_id IS NOT NULL AND NOT EXISTS (',
    '      SELECT 1 FROM "menu_locale" WHERE menu_id = v_menu_id AND locale_id = v_locale_id',
    '    ) THEN',
    '      INSERT INTO "menu_locale" (menu_id, locale_id, name, created_at, updated_at)',
    `      VALUES (v_menu_id, v_locale_id, ${sqlLiteral(
      plan.labelEn
    )}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    '    END IF;',
    '',
    `    SELECT id INTO v_locale_id FROM "locale" WHERE code = 'pt' LIMIT 1;`,
    '    IF v_locale_id IS NOT NULL AND NOT EXISTS (',
    '      SELECT 1 FROM "menu_locale" WHERE menu_id = v_menu_id AND locale_id = v_locale_id',
    '    ) THEN',
    '      INSERT INTO "menu_locale" (menu_id, locale_id, name, created_at, updated_at)',
    `      VALUES (v_menu_id, v_locale_id, ${sqlLiteral(
      plan.labelPt
    )}, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);`,
    '    END IF;',
    '  END IF;',
    'END $$;',
    '',
  ];
}

function buildRouteSeed(plan: ScaffoldPlan): string[] {
  const routes = buildApiRoutes(plan);

  if (routes.length === 0) {
    return [];
  }

  const routeJson = routes
    .map(
      (route) =>
        `    {"url":"${route.url}","method":"${route.method}","roles":[${plan.roles
          .map((role) => `"${role}"`)
          .join(',')}]}`
    )
    .join(',\n');

  return [
    '-- Rotas da API (espelha route.yaml)',
    'DO $$',
    'DECLARE',
    '  v_method_enum_type TEXT;',
    '  v_route_id INTEGER;',
    '  route_item JSONB;',
    "  route_data JSONB := '[",
    routeJson,
    "  ]'::JSONB;",
    'BEGIN',
    '  SELECT a.atttypid::regtype::text',
    '    INTO v_method_enum_type',
    '  FROM pg_attribute a',
    '  JOIN pg_class c ON c.oid = a.attrelid',
    '  JOIN pg_namespace n ON n.oid = c.relnamespace',
    "  WHERE c.relname = 'route'",
    '    AND n.nspname = current_schema()',
    "    AND a.attname = 'method'",
    '    AND a.attnum > 0',
    '    AND NOT a.attisdropped',
    '  LIMIT 1;',
    '',
    '  IF v_method_enum_type IS NULL THEN',
    "    RAISE EXCEPTION 'Could not resolve enum type for route.method';",
    '  END IF;',
    '',
    '  FOR route_item IN SELECT * FROM jsonb_array_elements(route_data) LOOP',
    '    SELECT MIN(id) INTO v_route_id',
    '      FROM "route"',
    "     WHERE url = (route_item->>'url')",
    "       AND method::text = (route_item->>'method');",
    '',
    '    IF v_route_id IS NULL THEN',
    '      EXECUTE format(',
    `        'INSERT INTO "route" ("url", "method") VALUES ($1, $2::%s) RETURNING id',`,
    '        v_method_enum_type',
    '      )',
    '      INTO v_route_id',
    "      USING route_item->>'url', route_item->>'method';",
    '    END IF;',
    '',
    '    INSERT INTO "role_route" ("role_id", "route_id")',
    '    SELECT r.id, v_route_id',
    '      FROM "role" r',
    "     WHERE r.slug IN (SELECT jsonb_array_elements_text(route_item->'roles'))",
    '    ON CONFLICT ("role_id", "route_id") DO NOTHING;',
    '  END LOOP;',
    'END $$;',
    '',
  ];
}

export function migrationFolderName(plan: ScaffoldPlan, timestamp: string): string {
  return `${timestamp}_${plan.library}_${plan.entity}_page`;
}

export function generateMigrationSql(plan: ScaffoldPlan): string {
  const header = [
    `-- ${plan.library}: página ${plan.route} (${plan.labelPt}).`,
    '--',
    '-- Gerado pelo wizard de páginas (/core/pages). Espelha:',
    ...(plan.generateBackend
      ? [`--   libraries/${plan.library}/hedhog/table/${plan.entity}.yaml`]
      : []),
    `--   libraries/${plan.library}/hedhog/data/menu.yaml`,
    ...(plan.generateBackend
      ? [`--   libraries/${plan.library}/hedhog/data/route.yaml`]
      : []),
    ...(plan.newRole
      ? [`--   libraries/${plan.library}/hedhog/data/role.yaml`]
      : []),
    '--',
    '-- Idempotente: seguro rodar múltiplas vezes. Revise antes de aplicar com',
    '-- `pnpm prisma:deploy` a partir de apps/api.',
    '',
  ];

  const body = [
    ...(plan.generateBackend
      ? [...buildEnums(plan), ...buildMainTable(plan), ...buildLocaleTable(plan)]
      : []),
    ...buildRoleSeed(plan),
    ...buildMenuSeed(plan),
    ...(plan.generateBackend ? buildRouteSeed(plan) : []),
  ];

  return `${[...header, ...body].join('\n').replace(/\n{3,}/g, '\n\n')}`;
}
