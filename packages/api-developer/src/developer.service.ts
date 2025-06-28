import { SchemaService } from '@hed-hog/api-prisma';
import { BadRequestException, Injectable } from '@nestjs/common';
import {
  mkdir,
  readdir,
  readFile,
  realpath,
  unlink,
  writeFile,
} from 'fs/promises';
import { parse, stringify } from 'yaml';
import { CreatePackageDto } from './dto/create-package.dto';
import { toKebabCase, toPascalCase } from '@hed-hog/api';
import { SaveTableDTO } from './dto/save-table.dto';
import { createHash } from 'crypto';
import { SaveScreenDTO } from './dto/save-screen.dto';

@Injectable()
export class DeveloperService {
  constructor(private readonly schema: SchemaService) {}

  private async removeYamlFiles(fileBasePath: string): Promise<void> {
    for (const ext of ['.yaml', '.yml']) {
      const filePath = `${fileBasePath}${ext}`;
      if (await this.exists(filePath)) {
        await unlink(filePath);
      }
    }
  }

  private formatPkColumn(column: any) {
    const formattedColumn: any = { type: 'pk' };
    if (column.name !== 'id') formattedColumn.name = column.name;
    if (column.generationStrategy !== 'increment') {
      formattedColumn.generationStrategy = column.generationStrategy;
    }
    return formattedColumn;
  }

  private formatFkColumn(column: any) {
    const formattedColumn: any = {
      name: column.name,
      type: 'fk',
      references: {
        table: column.references?.table,
        column: column.references?.column,
      },
    };
    if (column.references?.onDelete !== 'NO ACTION') {
      formattedColumn.references.onDelete = column.references.onDelete;
    }
    if (column.references?.onUpdate !== 'NO ACTION') {
      formattedColumn.references.onUpdate = column.references.onUpdate;
    }
    return formattedColumn;
  }

  private formatSlugColumn(column: any) {
    const formattedColumn: any = { type: 'slug' };
    if (column.name !== 'slug') formattedColumn.name = column.name;
    if (column.length !== 255) formattedColumn.length = column.length;
    if (!column.isUnique) formattedColumn.isUnique = column.isUnique;
    return formattedColumn;
  }

  private formatOrderColumn(column: any) {
    const formattedColumn: any = { type: 'order' };
    if (column.name !== 'order') formattedColumn.name = column.name;
    if (column.default !== undefined) column.default = Number(column.default);
    if (column.default !== 0) formattedColumn.length = column.length;
    if (!column.unsigned) formattedColumn.unsigned = column.unsigned;
    return formattedColumn;
  }

  private formatCreatedAtColumn(column: any) {
    const formattedColumn: any = { type: 'created_at' };
    if (column.name !== 'created_at') formattedColumn.name = column.name;
    if (column.default !== 'CURRENT_TIMESTAMP') {
      formattedColumn.default = column.default;
    }
    return formattedColumn;
  }

  private formatUpdatedAtColumn(column: any) {
    const formattedColumn: any = { type: 'updated_at' };
    if (column.name !== 'updated_at') formattedColumn.name = column.name;
    if (column.default !== 'CURRENT_TIMESTAMP') {
      formattedColumn.default = column.default;
    }
    return formattedColumn;
  }

  async formatColumns(columns: any[]) {
    return columns.map((column) => {
      column.type = column.type.toLowerCase();
      switch (column.type) {
        case 'pk':
          return this.formatPkColumn(column);
        case 'fk':
          return this.formatFkColumn(column);
        case 'slug':
          return this.formatSlugColumn(column);
        case 'order':
          return this.formatOrderColumn(column);
        case 'varchar':
          delete column.type;
          return column;
        case 'created_at':
          return this.formatCreatedAtColumn(column);
        case 'updated_at':
          return this.formatUpdatedAtColumn(column);
        case 'integer':
          column.type = 'int';
          if (typeof column.default !== 'number') {
            column.default = Number(column.default);
          }
          return column;
        case 'locale_varchar':
        case 'locale_text':
          if (typeof column.locale !== 'object') delete column.locale;
          return column;
        default:
          return column;
      }
    });
  }

  async saveScreen({
    library,
    name,
    description,
    icon,
    menu,
    roles,
    routes,
    slug,
    title,
  }: SaveScreenDTO) {
    const rootPath = await realpath(`${process.cwd()}/../../`);
    const screenBasePath = `${rootPath}/libraries/${library}/hedhog/screen/${title}`;
    await this.removeYamlFiles(screenBasePath);
    await writeFile(
      `${screenBasePath}.yaml`,
      stringify({
        slug,
        icon,
        name,
        description,
        routes,
        roles,
        menu: { icon, name },
      }),
      { encoding: 'utf8' },
    );
    return { success: true };
  }

  async saveTable({ columns, library, tableName }: SaveTableDTO) {
    const rootPath = await realpath(`${process.cwd()}/../../`);
    const tablePathBase = `${rootPath}/libraries/${library}/hedhog/table/${tableName}`;
    await this.removeYamlFiles(tablePathBase);
    columns = await this.formatColumns(columns);
    await writeFile(`${tablePathBase}.yaml`, stringify({ columns }), {
      encoding: 'utf8',
    });
    return { success: true };
  }

  async table(library: string, tableName: string) {
    const rootPath = await realpath(`${process.cwd()}/../../`);
    let tablePath = `${rootPath}/libraries/${library}/hedhog/table/${tableName}.yaml`;
    if (!(await this.exists(tablePath))) {
      tablePath = `${rootPath}/libraries/${library}/hedhog/table/${tableName}.yml`;
    }
    if (!(await this.exists(tablePath))) {
      throw new BadRequestException(`Table ${tableName} does not exist`);
    }
    try {
      const yamlData = parse(await readFile(tablePath, 'utf8'));
      return {
        id: `${library}-${tableName}`,
        name: tableName,
        library,
        columns: yamlData.columns || [],
      };
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to parse table YAML: ${error.message}`,
      );
    }
  }

  async exists(path: string): Promise<boolean> {
    try {
      await realpath(path);
      return true;
    } catch {
      return false;
    }
  }

  private async writeFileUtf8(path: string, data: string) {
    await writeFile(path, data, { encoding: 'utf8' });
  }

  private getEslintConfig(): string {
    return `/** @type {import("eslint").Linter.Config} */
module.exports = {
    extends: ['@hed-hog/eslint-config/nest.js'],
    parserOptions: {
        project: 'tsconfig.json',
        tsconfigRootDir: __dirname,
        sourceType: 'module',
    },
};`;
  }

  private getTsconfig(): string {
    return `{
    "extends": "@hed-hog/typescript-config/nestjs-library.json",
    "include": ["src"],
    "compilerOptions": {
        "composite": true,
        "declaration": true,
        "declarationMap": true,
        "outDir": "dist",
        "rootDir": "src"
    }
}`;
  }

  private getPrettierConfig(): string {
    return `/** @type {import("prettier").Config} */
module.exports = {
    ...require('@hed-hog/eslint-config/prettier-base'),
};
`;
  }

  private getPackageJson(name: string): string {
    const kebabName = toKebabCase(name);
    return JSON.stringify(
      {
        name: `@hed-hog/${kebabName}`,
        version: '0.0.1',
        main: 'dist/index.js',
        types: 'dist/index.d.ts',
        scripts: {
          predev: 'npm run prisma:update',
          _dev: 'pnpm build --watch',
          build: 'tsc -b -v',
          lint: 'eslint "{src,apps,libs,test}/**/*.ts"',
          prebuild: 'npm run prisma:update',
          'prisma:update':
            'prisma generate --schema=./../../apps/api/prisma/schema.prisma',
        },
        dependencies: {
          '@loancrate/prisma-schema-parser': '^3.0.0',
          '@nestjs/common': '*',
          '@prisma/client': '^6.9.0',
        },
        devDependencies: {
          prisma: '^6.9.0',
        },
        exports: {
          '.': { import: './dist/index.js', require: './dist/index.js' },
          './package.json': './package.json',
        },
      },
      null,
      2,
    );
  }

  private getModuleFile(name: string): string {
    const kebab = toKebabCase(name);
    const pascal = toPascalCase(name);
    return `import { Module } from '@nestjs/common';
import { ${pascal}Controller } from './${kebab}.controller';
import { ${pascal}Service } from './${kebab}.service';

@Module({
    imports: [],
    controllers: [${pascal}Controller],
    providers: [${pascal}Service],
})
export class ${pascal}Module {}
`;
  }

  private getControllerFile(name: string): string {
    const kebab = toKebabCase(name);
    const pascal = toPascalCase(name);
    return `import { Controller, Get } from '@nestjs/common';
import { ${pascal}Service } from './${kebab}.service';

@Controller('${kebab}')
export class ${pascal}Controller {
    constructor(private readonly service: ${pascal}Service) {}

    @Get()
    async index() {
        return 'Hello from ${name}!';
    }
}
`;
  }

  private getServiceFile(name: string): string {
    const pascal = toPascalCase(name);
    return `import { Injectable } from '@nestjs/common';

@Injectable()
export class ${pascal}Service {

}
`;
  }

  private getIndexFile(name: string): string {
    return `export * from './${toKebabCase(name)}.module';`;
  }

  async createPackage({ name }: CreatePackageDto) {
    const kebabName = toKebabCase(name);
    const rootPath = await realpath(`${process.cwd()}/../../`);
    const packagesPath = `${rootPath}/libraries/${kebabName}`;
    if (await this.exists(packagesPath)) {
      throw new BadRequestException('Package already exists');
    }
    await mkdir(`${packagesPath}/src`, { recursive: true });
    await Promise.all([
      this.writeFileUtf8(
        `${packagesPath}/.eslintrc.js`,
        this.getEslintConfig(),
      ),
      this.writeFileUtf8(`${packagesPath}/tsconfig.json`, this.getTsconfig()),
      this.writeFileUtf8(
        `${packagesPath}/.prettierrc.js`,
        this.getPrettierConfig(),
      ),
      this.writeFileUtf8(
        `${packagesPath}/package.json`,
        this.getPackageJson(name),
      ),
      this.writeFileUtf8(
        `${packagesPath}/src/${kebabName}.module.ts`,
        this.getModuleFile(name),
      ),
      this.writeFileUtf8(
        `${packagesPath}/src/${kebabName}.controller.ts`,
        this.getControllerFile(name),
      ),
      this.writeFileUtf8(
        `${packagesPath}/src/${kebabName}.service.ts`,
        this.getServiceFile(name),
      ),
      this.writeFileUtf8(
        `${packagesPath}/src/index.ts`,
        this.getIndexFile(name),
      ),
    ]);
    await this.updateTsConfigApi(name);
    await this.updateTsConfigLibrary(name);
  }

  async updateTsConfigLibrary(name: string) {
    try {
      const kebabName = toKebabCase(name);
      const rootPath = await realpath(
        `${process.cwd()}/../../libraries/typescript-config`,
      );
      const tsConfigPath = `${rootPath}/nestjs-library.json`;
      if (!(await this.exists(tsConfigPath))) {
        const packages = await this.getPackagesFromDirectory();
        const paths = {
          '@prisma/client': ['../api-prisma/node_modules/.prisma/client'],
          '@prisma/client/*': ['../api-prisma/node_modules/.prisma/client/*'],
        };
        for (const dir of packages) {
          if (!dir.isDirectory()) continue;
          const kebab = toKebabCase(dir.name);
          paths[`@hed-hog/${kebab}`] = [`../${kebab}/src`];
          paths[`@hed-hog/${kebab}/*`] = [`../${kebab}/src/*`];
        }
        await this.writeFileUtf8(
          tsConfigPath,
          JSON.stringify(
            {
              $schema: 'https://json.schemastore.org/tsconfig',
              extends: './base.json',
              compilerOptions: {
                composite: true,
                allowSyntheticDefaultImports: true,
                emitDecoratorMetadata: true,
                experimentalDecorators: true,
                forceConsistentCasingInFileNames: false,
                incremental: true,
                module: 'commonjs',
                moduleResolution: 'Node10',
                noFallthroughCasesInSwitch: false,
                noImplicitAny: false,
                removeComments: true,
                skipLibCheck: true,
                sourceMap: true,
                strictNullChecks: false,
                strictBindCallApply: false,
                baseUrl: '.',
                paths,
              },
            },
            null,
            2,
          ),
        );
      }
      const tsConfigData = JSON.parse(
        await readFile(tsConfigPath, { encoding: 'utf8' }),
      );
      tsConfigData.compilerOptions = tsConfigData.compilerOptions || {};
      tsConfigData.compilerOptions.paths =
        tsConfigData.compilerOptions.paths || {};
      tsConfigData.compilerOptions.paths[`@hed-hog/${kebabName}`] = [
        `../${kebabName}/src`,
      ];
      tsConfigData.compilerOptions.paths[`@hed-hog/${kebabName}/*`] = [
        `../${kebabName}/src/*`,
      ];
      await this.writeFileUtf8(
        tsConfigPath,
        JSON.stringify(tsConfigData, null, 2),
      );
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to update tsconfig for library: ${error.message}`,
      );
    }
  }

  async updateTsConfigApi(name: string) {
    try {
      const kebabName = toKebabCase(name);
      const rootPath = await realpath(`${process.cwd()}/../../apps/api`);
      const tsConfigPath = `${rootPath}/tsconfig.json`;
      if (!(await this.exists(tsConfigPath))) {
        const libraries = await this.getPackagesFromDirectory();
        const paths = {
          '@prisma/client': [
            '../../packages/api-prisma/node_modules/.prisma/client',
          ],
          '@prisma/client/*': [
            '../../packages/api-prisma/node_modules/.prisma/client/*',
          ],
        };
        for (const dir of libraries) {
          if (!dir.isDirectory()) continue;
          const kebab = toKebabCase(dir.name);
          paths[`@hed-hog/${kebab}`] = [`../../libraries/${kebab}/src`];
          paths[`@hed-hog/${kebab}/*`] = [`../../libraries/${kebab}/src/*`];
        }
        await this.writeFileUtf8(
          tsConfigPath,
          JSON.stringify(
            {
              $schema: 'https://json.schemastore.org/tsconfig',
              include: ['src/**/*.ts', '../../packages/api-prisma/src/**/*.ts'],
              exclude: ['node_modules', 'dist'],
              compilerOptions: {
                rootDir: '../../',
                baseUrl: './',
                module: 'commonjs',
                declaration: true,
                removeComments: true,
                emitDecoratorMetadata: true,
                experimentalDecorators: true,
                allowSyntheticDefaultImports: true,
                target: 'ES2022',
                sourceMap: true,
                allowJs: true,
                incremental: true,
                skipLibCheck: true,
                strict: true,
                strictNullChecks: false,
                noImplicitAny: false,
                strictBindCallApply: false,
                forceConsistentCasingInFileNames: false,
                noFallthroughCasesInSwitch: false,
                moduleResolution: 'node',
                outDir: './dist',
                paths,
              },
            },
            null,
            2,
          ),
        );
      }
      const tsConfigData = JSON.parse(
        await readFile(tsConfigPath, { encoding: 'utf8' }),
      );
      tsConfigData.compilerOptions = tsConfigData.compilerOptions || {};
      tsConfigData.compilerOptions.paths =
        tsConfigData.compilerOptions.paths || {};
      tsConfigData.compilerOptions.paths[`@hed-hog/${kebabName}`] = [
        `../../packages/${kebabName}/src`,
      ];
      tsConfigData.compilerOptions.paths[`@hed-hog/${kebabName}/*`] = [
        `../../packages/${kebabName}/src/*`,
      ];
      await this.writeFileUtf8(
        tsConfigPath,
        JSON.stringify(tsConfigData, null, 2),
      );
    } catch (error: any) {
      throw new BadRequestException(
        `Failed to update tsconfig for API: ${error.message}`,
      );
    }
  }

  async getPackagesFromDirectory() {
    const rootPath = await realpath(`${process.cwd()}/../../`);
    const packagesPath = `${rootPath}/libraries`;
    return (await readdir(packagesPath, { withFileTypes: true })).filter(
      (item) => item.isDirectory(),
    );
  }

  async getDataFromYaml(path: string) {
    const rootPath = await realpath(`${process.cwd()}/../../`);
    const basePath = `${rootPath}/${path}`;
    const resolvedPath = await this.resolveYamlPath(basePath);
    if (!resolvedPath) {
      throw new BadRequestException(`Data file for ${path} does not exist`);
    }
    return parse(await readFile(resolvedPath, 'utf8'));
  }

  private async resolveYamlPath(basePath: string): Promise<string | null> {
    for (const ext of ['.yaml', '.yml']) {
      const candidate = `${basePath}${ext}`;
      if (await this.exists(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  async data(library: string, tableName: string) {
    try {
      const [data, table] = await Promise.all([
        this.getDataFromYaml(`libraries/${library}/hedhog/data/${tableName}`),
        this.getDataFromYaml(`libraries/${library}/hedhog/table/${tableName}`),
      ]);
      return { data, table };
    } catch {
      return [];
    }
  }

  async tree(): Promise<any> {
    const rootPath = await realpath(`${process.cwd()}/../../`);
    const packagesPath = `${rootPath}/libraries`;
    const tree = [];
    for (const dir of await this.getPackagesFromDirectory()) {
      if (!dir.isDirectory()) continue;
      const tables = [];
      const tablesPath = `${packagesPath}/${dir.name}/hedhog/table`;
      if (await this.exists(tablesPath)) {
        for (const table of await readdir(tablesPath, {
          withFileTypes: true,
        })) {
          if (!table.isFile() || !table.name.match(/\.ya?ml$/)) continue;
          let columns = [];
          try {
            const yamlData = parse(
              await readFile(`${tablesPath}/${table.name}`, 'utf8'),
            );
            columns = yamlData.columns || [];
          } catch {}
          tables.push({
            name: table.name.replace(/\.ya?ml$/, ''),
            columns,
          });
        }
      }
      const screens = [];
      const screensPath = `${packagesPath}/${dir.name}/hedhog/screen`;
      if (await this.exists(screensPath)) {
        for (const screen of await readdir(screensPath, {
          withFileTypes: true,
        })) {
          if (!screen.isFile()) continue;
          screens.push({
            name: screen.name.replace(/\.ya?ml$/, ''),
          });
        }
      }
      const hash = await this.hashLibrary(dir.name);
      tree.push({
        id: toKebabCase(dir.name),
        name: dir.name,
        type: 'library',
        hash,
        children: [
          {
            id: `${toKebabCase(dir.name)}-table`,
            name: `Tables`,
            type: 'folder',
            color: '#3b82f6',
            children: tables.map((table) => ({
              id: `${toKebabCase(dir.name)}-${toKebabCase(table.name)}`,
              name: table.name,
              type: 'table',
              library: toKebabCase(dir.name),
            })),
          },
          {
            id: `${toKebabCase(dir.name)}-screen`,
            name: 'Screens',
            type: 'folder',
            path: 'screens',
            isOpen: false,
            color: '#10b981',
            children: screens.map((screen) => ({
              id: `${toKebabCase(dir.name)}-${toKebabCase(screen.name)}`,
              name: screen.name,
              type: 'screen',
              library: toKebabCase(dir.name),
            })),
          },
          {
            id: 'settings',
            name: 'Settings',
            type: 'folder',
            path: 'settings',
            isOpen: false,
            color: '#8b5cf6',
          },
        ],
      });
    }
    return tree;
  }

  async hashLibrary(library: string) {
    const rootPath = await realpath(`${process.cwd()}/../../`);
    const libraryPath = `${rootPath}/libraries/${library}`;
    const hedhogPath = `${rootPath}/hedhog.json`;
    const sum = createHash('sha256');
    let currentHash = '';
    if (await this.exists(hedhogPath)) {
      const hedhog = require(hedhogPath);
      if (hedhog && hedhog.libraries && hedhog.libraries[library]) {
        currentHash = hedhog.libraries[library] || '';
      }
    }
    let paths: Array<{ path: string; content: string }> = [];
    async function scanDirectory(dir: string): Promise<void> {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules') continue;
        const path = `${dir}/${entry.name}`;
        if (entry.isDirectory()) {
          await scanDirectory(path);
        } else {
          const fileContent = await readFile(path, 'utf8');
          paths.push({ path, content: fileContent });
        }
      }
    }
    await scanDirectory(libraryPath);
    const hash = sum.update(JSON.stringify(paths)).digest('hex');
    return { hash, currentHash, isUpToDate: hash === currentHash };
  }
}
