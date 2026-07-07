import { existsSync, readFileSync } from 'fs';
import { mkdir, readdir, unlink, writeFile } from 'fs/promises';
import { join, sep } from 'path';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type DatabaseType = 'postgres' | 'mysql';

interface DatabaseConfig {
  type: DatabaseType;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

interface TableColumn {
  name: string;
  nullable: boolean;
  type: string;
  pk: boolean;
  fk: string | false;
  default: boolean;
  enum?: any[];
}

interface TypeFile {
  fields: string[];
  fks: Array<{ table: string; name: string; inverted: string }>;
  imports: string[];
  props: Array<{ name: string; optional: boolean; type: string; exists?: boolean }>;
  tableName: string;
  columns: TableColumn[];
}

// ============================================================================
// CONSTANTS
// ============================================================================

const TYPE_MAPPINGS: Record<string, string> = {
  int: 'number',
  int4: 'number',
  int8: 'number',
  integer: 'number',
  smallint: 'number',
  text: 'string',
  varchar: 'string',
  char: 'string',
  timestamp: 'string',
  bpchar: 'string',
  date: 'string',
  time: 'string',
  timetz: 'string',
  timestamptz: 'string',
  bool: 'boolean',
  boolean: 'boolean',
  bit: 'boolean',
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

const snakeCaseToPascalCase = (str: string): string =>
  str.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('');

const removeQuotes = (value: string): string =>
  (value.startsWith('"') || value.startsWith("'")) &&
    (value.endsWith('"') || value.endsWith("'"))
    ? value.slice(1, -1)
    : value;

const isEnumType = (type: string): boolean =>
  type.split('_').pop() === 'enum';

const isOptionalColumn = (column: TableColumn): boolean =>
  column.nullable || column.pk || column.default;

function databaseTypeToJavascriptType(dbType: string): string | { enum: string } {
  if (TYPE_MAPPINGS[dbType]) return TYPE_MAPPINGS[dbType];
  if (isEnumType(dbType)) return { enum: dbType };
  return 'any';
}

function parseEnv(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) {
    throw new Error(`Arquivo .env não encontrado: ${filePath}`);
  }

  const envContent = readFileSync(filePath, 'utf-8');
  const envVariables: Record<string, string> = {};

  const expandValue = (value: string): string =>
    value.replace(/\${(.*?)}/g, (_, varName) =>
      envVariables[varName] || process.env[varName] || ''
    );

  envContent.split('\n').forEach((line) => {
    const [key, value] = line.split('=');
    if (key?.trim() && value?.trim()) {
      envVariables[key.trim()] = removeQuotes(expandValue(value.trim()));
    }
  });

  return envVariables;
}

async function createDirectoryRecursive(dirPath: string): Promise<void> {
  const directories = dirPath.split(sep).filter(Boolean);
  let currentPath = directories[0] || '';

  for (let i = 1; i < directories.length; i++) {
    const dir = directories[i];
    if (dir) {
      currentPath = join(currentPath, dir);
      if (!existsSync(currentPath)) {
        await mkdir(currentPath);
      }
    }
  }
}

// ============================================================================
// DATABASE FUNCTIONS
// ============================================================================

async function executeQuery(
  config: DatabaseConfig,
  query: string,
): Promise<any[]> {
  try {
    if (config.type === 'postgres') {
      const { Client } = await import('pg');
      const client = new Client(config);
      await client.connect();
      const result = await client.query(query);
      await client.end();
      return result.rows;
    } else {
      const mysql = await import('mysql2/promise');
      const connection = await mysql.createConnection(config);
      const [rows] = await connection.query(query);
      await connection.end();
      return rows as any[];
    }
  } catch (error) {
    console.error('Database query error:', error);
    return [];
  }
}

async function getDatabaseConfig(): Promise<DatabaseConfig> {
  const envPath = join(process.cwd(), 'apps', 'api', '.env');
  const env = parseEnv(envPath);
  const dbUrl = env.DATABASE_URL || '';
  
  // Parse DATABASE_URL format: protocol://user:password@host:port/database
  const urlMatch = dbUrl.match(/^(\w+):\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  
  if (!urlMatch) {
    throw new Error(`Invalid DATABASE_URL format: ${dbUrl}`);
  }
  
  const [, rawType, user, password, host, port, database] = urlMatch;
  const type = (rawType === 'postgresql' || rawType === 'postgres') ? 'postgres' : rawType as DatabaseType;

  return {
    type,
    host: (env.DB_HOST || host) as string,
    port: Number(env.DB_PORT || port),
    user: (env.DB_USERNAME || user) as string,
    password: (env.DB_PASSWORD || password) as string,
    database: (env.DB_DATABASE || database) as string,
  };
}

async function getTables(config: DatabaseConfig): Promise<string[]> {
  const query = config.type === 'mysql'
    ? `SELECT table_name FROM information_schema.tables WHERE table_schema = '${config.database}'`
    : `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`;

  const rows = await executeQuery(config, query);
  return rows.map((row: any) => row.table_name);
}

async function getTableColumns(tableName: string, config: DatabaseConfig): Promise<TableColumn[]> {
  return config.type === 'mysql'
    ? getMysqlTableColumns(tableName, config)
    : getPostgresTableColumns(tableName, config);
}

async function getMysqlTableColumns(tableName: string, config: DatabaseConfig): Promise<TableColumn[]> {
  const [columns, constraints] = await Promise.all([
    executeQuery(
      config,
      `SELECT column_name, is_nullable, data_type, column_default AS \`default\`, column_type 
       FROM information_schema.columns 
       WHERE table_name = '${tableName}' AND table_schema = '${config.database}'`
    ),
    executeQuery(
      config,
      `SELECT kcu.column_name, kcu.table_name, tc.constraint_type
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
       WHERE tc.table_name = '${tableName}' AND tc.table_schema = '${config.database}'`
    ),
  ]);

  return columns.map((row: any) => {
    const enumMatch = row.column_type?.match(/enum\((.*?)\)/);
    const enumValues = enumMatch?.[1]?.split(',').map((e: string) => ({ value: e.replace(/'/g, '') })) || [];

    return {
      name: row.column_name,
      nullable: row.is_nullable === 'YES',
      type: row.data_type,
      pk: constraints.some((c: any) => c.column_name === row.column_name && c.constraint_type === 'PRIMARY KEY'),
      fk: constraints.find((c: any) => c.column_name === row.column_name && c.constraint_type === 'FOREIGN KEY')?.table_name || false,
      default: row.default != null,
      enum: enumValues.length > 0 ? enumValues : undefined,
    };
  });
}

async function getPostgresTableColumns(tableName: string, config: DatabaseConfig): Promise<TableColumn[]> {
  const [columns, constraints] = await Promise.all([
    executeQuery(
      config,
      `SELECT column_name, is_nullable, udt_name AS type, column_default AS "default", data_type 
       FROM information_schema.columns 
       WHERE table_name = '${tableName}' AND table_schema = 'public'`
    ),
    executeQuery(
      config,
      `SELECT kcu.column_name, ccu.table_name, tc.constraint_type
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
       WHERE tc.table_name = '${tableName}'`
    ),
  ]);

  // Fetch enum values for USER-DEFINED types
  for (const col of columns) {
    if (col.data_type === 'USER-DEFINED' && isEnumType(col.type)) {
      col.enum = await executeQuery(
        config,
        `SELECT enumlabel AS value FROM pg_enum WHERE enumtypid = '${col.type}'::regtype`
      );
    }
  }

  return columns.map((row: any) => ({
    name: row.column_name,
    nullable: row.is_nullable === 'YES',
    type: row.type.replace('int4', 'int'),
    pk: constraints.some((c: any) => c.column_name === row.column_name && c.constraint_type === 'PRIMARY KEY'),
    fk: constraints.find((c: any) => c.column_name === row.column_name && c.constraint_type === 'FOREIGN KEY')?.table_name || false,
    default: row.default != null,
    enum: row.enum,
  }));
}

// ============================================================================
// TYPE GENERATION FUNCTIONS
// ============================================================================

const typeFiles: Record<string, TypeFile> = {};

async function emptyDirectory(path: string): Promise<void> {
  try {
    const files = await readdir(path);
    await Promise.all(files.map(file => unlink(join(path, file))));
  } catch (error) {
    // Directory doesn't exist, ignore
  }
}

async function createEnumFiles(path: string, columns: TableColumn[]): Promise<void> {
  const enumColumns = columns.filter(col => col.enum && col.enum.length > 0);

  // Helper to convert enum value to valid TypeScript identifier
  const toEnumIdentifier = (value: string) =>
    value
      .replace(/[^a-zA-Z0-9]/g, '_') // Replace non-alphanumeric with _
      .replace(/^(\d)/, '_$1')       // Prefix leading digit with _
      .replace(/_{2,}/g, '_')        // Collapse multiple underscores
      .replace(/(^_|_$)/g, '')       // Remove leading/trailing underscores
      .toUpperCase();

  await Promise.all(enumColumns.map(async (col) => {
    const enumName = snakeCaseToPascalCase(col.type);
    const enumValues = col.enum!
      .map(e => `  ${toEnumIdentifier(e.value)} = '${e.value}'`)
      .join(',\n');
    const content = `export enum ${enumName} {\n${enumValues}\n}`;

    await writeFile(join(path, `${enumName}.ts`), content, 'utf-8');
  }));
}

function buildTypeFile(tableName: string, columns: TableColumn[]): TypeFile {
  const typeName = snakeCaseToPascalCase(tableName);
  const fields: string[] = [];
  const fks: TypeFile['fks'] = [];
  const imports: string[] = [];
  const props: TypeFile['props'] = [];

  // Process regular columns
  for (const column of columns) {
    let type = databaseTypeToJavascriptType(column.type);

    if (typeof type === 'object' && type.enum) {
      const enumType = snakeCaseToPascalCase(column.type);
      type = enumType;
      imports.push(enumType);
    }

    props.push({
      name: column.name,
      optional: isOptionalColumn(column),
      type: type as string,
    });
    fields.push(column.name);
  }

  // Process foreign keys
  for (const column of columns) {
    if (column.fk) {
      const fkType = snakeCaseToPascalCase(column.fk as string);
      fields.push(column.fk);

      if (typeName !== fkType) {
        imports.push(fkType);
      }

      let name = column.fk as string;
      let inverted = column.fk as string;
      let exists = false;

      if (props.some(p => p.name === name)) {
        const originalName = name;
        name = `${originalName}_${tableName}_${column.name}To${originalName}`;
        inverted = `${tableName}_${tableName}_${column.name}To${originalName}`;
        exists = true;
      }

      props.push({
        name,
        optional: true,
        type: fkType,
        exists,
      });

      fks.push({ table: column.fk as string, name, inverted });
    }
  }

  return { fields, fks, imports, props, tableName, columns };
}

function addReverseRelations(typeName: string): void {
  const typeFile = typeFiles[snakeCaseToPascalCase(typeName)];
  if (!typeFile) return;

  for (const fk of typeFile.fks) {
    const fkTypeName = snakeCaseToPascalCase(fk.table);
    const targetFile = typeFiles[fkTypeName];
    if (!targetFile) continue;

    let relationName = typeName;

    // Check if relation name already exists
    if (typeFiles[snakeCaseToPascalCase(fk.name)] &&
      targetFile.props.some(p => p.name === typeName)) {
      relationName = `other_${typeName}`;
    } else if (!typeFiles[snakeCaseToPascalCase(fk.name)]) {
      relationName = fk.inverted;
    }

    targetFile.props.push({
      name: relationName,
      optional: true,
      type: `${snakeCaseToPascalCase(typeName)}[]`,
    });

    if (fk.table !== typeName) {
      targetFile.imports.push(snakeCaseToPascalCase(typeName));
    }
  }
}

function addLocaleFields(): void {
  const localeFiles = Object.values(typeFiles)
    .filter(file => file.tableName.endsWith('_locale'));

  for (const localeFile of localeFiles) {
    for (const column of localeFile.columns) {
      if (column.pk || column.fk || column.default) continue;
      if (databaseTypeToJavascriptType(column.type) !== 'string') continue;

      const baseTableName = localeFile.tableName.replace(/_locale$/, '');
      const baseTypeName = snakeCaseToPascalCase(baseTableName);
      const baseFile = typeFiles[baseTypeName];

      if (baseFile) {
        baseFile.props.push({
          name: column.name,
          optional: true,
          type: 'string',
        });
      }
    }
  }
}

async function writeTypeFiles(path: string): Promise<void> {
  const writePromises = Object.entries(typeFiles).map(async ([typeName, file]) => {
    const lines: string[] = [];

    // Add imports
    const uniqueImports = [...new Set(file.imports)];
    uniqueImports.forEach(imp => {
      lines.push(`import { ${imp} } from './${imp}';`);
    });

    if (uniqueImports.length > 0) lines.push('');

    // Add type definition
    lines.push(`export type ${typeName} = {`);

    const uniqueProps = Array.from(
      new Map(file.props.map(p => [p.name, p])).values()
    );

    uniqueProps.forEach(prop => {
      lines.push(`  ${prop.name}${prop.optional ? '?' : ''}: ${prop.type};`);
    });

    lines.push('}');

    await writeFile(join(path, `${typeName}.ts`), lines.join('\n'), 'utf-8');
  });

  await Promise.all(writePromises);
}

async function createIndexFile(path: string): Promise<void> {
  const typeExports = Object.keys(typeFiles)
    .map(typeName => `export * from './${typeName}';`)
    .join('\n');

  // Export all enums
  const enumFiles = await readdir(path);
  const enumExports = enumFiles
    .filter(f => f.endsWith('.ts') && !typeFiles[f.replace(/\.ts$/, '')])
    .filter(f => f !== 'index.ts')
    .map(f => `export * from './${f.replace(/\.ts$/, '')}';`)
    .join('\n');

  const exports = [typeExports, enumExports].filter(Boolean).join('\n');

  await writeFile(join(path, 'index.ts'), exports, 'utf-8');
}

async function createTypes(): Promise<void> {
  const config = await getDatabaseConfig();
  const tables = await getTables(config);

  console.log('Processing tables:', tables);

  // Process all tables and build type files
  await Promise.all(tables.map(async (table) => {
    const columns = await getTableColumns(table, config);
    const typeName = snakeCaseToPascalCase(table);
    typeFiles[typeName] = buildTypeFile(table, columns);
  }));

  // Add reverse relations for all tables
  tables.forEach(table => addReverseRelations(table));
}


// ============================================================================
// MAIN EXECUTION
// ============================================================================

async function main(): Promise<void> {
  console.info('Creating types...');

  const pathAdmin = join(process.cwd(), 'packages/types/src');

  // Ensure ../packages/types exists and has package.json
  const typesRoot = join(process.cwd(), 'packages/types');
  let shouldRunPnpmInstall = false;

  if (!existsSync(typesRoot)) {
    await mkdir(typesRoot, { recursive: true });
  }
  const pkgJsonPath = join(typesRoot, 'package.json');
  if (!existsSync(pkgJsonPath)) {
    await writeFile(
      pkgJsonPath,
      JSON.stringify({
        name: "@hed-hog/api-types",
        version: "0.0.1",
        private: true,
        license: "MIT",
        types: "dist/index.d.ts",
        scripts: {
          build: "tsc --project tsconfig.json",
          dev: "tsc --project tsconfig.json --watch",
          clean: "rimraf dist"
        },
        devDependencies: {
          "@types/node": "^24.9.1",
          "typescript": "^5.9.3"
        }
      }, null, 2),
      'utf-8'
    );
    shouldRunPnpmInstall = true;
  }

  // Ensure ../packages/types/tsconfig.json exists
  const tsconfigPath = join(typesRoot, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    await writeFile(
      tsconfigPath,
      JSON.stringify({
        extends: "@hed-hog/typescript-config/react-library.json",
        compilerOptions: {
          outDir: "dist"
        },
        include: ["src"],
        exclude: ["node_modules", "dist"]
      }, null, 2),
      'utf-8'
    );
  }

  // Run pnpm install at project root if package.json was created
  if (shouldRunPnpmInstall) {
    const { execSync } = await import('child_process');
    try {
      execSync('pnpm install', { stdio: 'inherit', cwd: join(process.cwd()) });
    } catch (err) {
      console.error('Failed to run pnpm install:', err);
      process.exit(1);
    }
  }

  try {
    await createDirectoryRecursive(pathAdmin);
    await emptyDirectory(pathAdmin);

    // Create all types
    await createTypes();

    // Get all columns for enum creation
    const config = await getDatabaseConfig();
    const tables = await getTables(config);
    const allColumns = (await Promise.all(
      tables.map(table => getTableColumns(table, config))
    )).flat();

    await createEnumFiles(pathAdmin, allColumns);
    addLocaleFields();
    await writeTypeFiles(pathAdmin);
    await createIndexFile(pathAdmin);

    console.info('✅ Types created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating types:', error);
    process.exit(1);
  }
}

if (!process.env.HEDHOG_SKIP_TYPES) {
  main().catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
} else {
  console.info('Skipping types creation...');
}
