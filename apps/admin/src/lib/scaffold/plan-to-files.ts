import {
  buildPageMessages,
  mergeMessages,
  pageNamespace,
} from './generators/i18n-merge';
import {
  generateMigrationSql,
  migrationFolderName,
} from './generators/migration-sql';
import { patchLibraryModule } from './generators/module-patch';
import { nestNames } from './generators/nest-crud';
import {
  generateController,
  generateDto,
  generateModule,
  generateService,
} from './generators/nest-crud';
import {
  generateMenuYamlEntry,
  generateRoleYamlEntry,
  generateRouteYamlEntries,
  generateTableYaml,
} from './generators/yaml';
import { renderTemplate } from './templates';
import type { ScaffoldFile, ScaffoldFs, ScaffoldPlan } from './types';

const PAGES_ROOT = 'apps/admin/src/app/(app)/(libraries)';

function pageDirectory(plan: ScaffoldPlan): string {
  // A rota já começa por `/<library>`, então vira o caminho direto sob (libraries).
  return `${PAGES_ROOT}${plan.route}`;
}

function createFile(
  fs: ScaffoldFs,
  path: string,
  contents: string
): ScaffoldFile {
  return {
    path,
    action: 'create',
    contents,
    preview: contents,
    exists: fs.exists(path),
  };
}

/** Anexa o bloco ao fim do arquivo, criando-o quando ainda não existe. */
function appendToFile(
  fs: ScaffoldFs,
  path: string,
  addition: string
): ScaffoldFile {
  const current = fs.read(path);
  const exists = current != null;

  if (!exists) {
    return {
      path,
      action: 'create',
      contents: addition,
      preview: addition,
      exists: false,
    };
  }

  const separator = current.endsWith('\n') ? '' : '\n';
  const spacer = current.trim() === '' ? '' : '\n';

  return {
    path,
    action: 'merge',
    contents: `${current}${separator}${spacer}${addition}`,
    preview: addition,
    exists: true,
  };
}

function messagesFile(
  fs: ScaffoldFs,
  plan: ScaffoldPlan,
  locale: 'en' | 'pt'
): ScaffoldFile {
  const path = `apps/admin/messages/${plan.library}/${locale}.json`;
  const current = fs.read(path);
  const namespace = pageNamespace(plan);
  const messages = buildPageMessages(plan, locale);
  const { contents, addedKeys } = mergeMessages(current, namespace, messages);

  return {
    path,
    action: current == null ? 'create' : 'merge',
    contents,
    preview: JSON.stringify(
      {
        [namespace]: Object.fromEntries(
          addedKeys.map((key) => [key, messages[key]])
        ),
      },
      null,
      2
    ),
    exists: current != null,
  };
}

function libraryModuleFile(
  fs: ScaffoldFs,
  plan: ScaffoldPlan
): ScaffoldFile | null {
  const names = nestNames(plan);
  const path = `libraries/${plan.library}/src/${plan.library}.module.ts`;
  const current = fs.read(path);

  if (current == null) {
    return {
      path,
      action: 'manual',
      contents: '',
      preview: '',
      exists: false,
      instruction: `Registre ${names.moduleClass} no módulo raiz da biblioteca (arquivo não encontrado).`,
    };
  }

  const result = patchLibraryModule(
    current,
    names.moduleClass,
    `./${names.kebab}/${names.kebab}.module`
  );

  if (!result.ok) {
    return {
      path,
      action: 'manual',
      contents: '',
      preview: '',
      exists: true,
      instruction: `${result.reason} Adicione manualmente: import { ${names.moduleClass} } from './${names.kebab}/${names.kebab}.module'; e inclua forwardRef(() => ${names.moduleClass}) em imports.`,
    };
  }

  return {
    path,
    action: 'patch',
    contents: result.contents,
    preview: result.addition,
    exists: true,
  };
}

export type BuildScaffoldFilesOptions = {
  /** Timestamp `YYYYMMDDHHmmss` usado no nome da pasta da migration. */
  timestamp: string;
};

export function buildScaffoldFiles(
  plan: ScaffoldPlan,
  fs: ScaffoldFs,
  { timestamp }: BuildScaffoldFilesOptions
): ScaffoldFile[] {
  const files: ScaffoldFile[] = [];
  const directory = pageDirectory(plan);
  const template = renderTemplate(plan);

  files.push(createFile(fs, `${directory}/page.tsx`, template.page));

  template.components.forEach((component) => {
    files.push(
      createFile(fs, `${directory}/${component.relativePath}`, component.contents)
    );
  });

  files.push(messagesFile(fs, plan, 'en'));
  files.push(messagesFile(fs, plan, 'pt'));

  files.push(
    appendToFile(
      fs,
      `libraries/${plan.library}/hedhog/data/menu.yaml`,
      generateMenuYamlEntry(plan)
    )
  );

  if (plan.newRole) {
    files.push(
      appendToFile(
        fs,
        `libraries/${plan.library}/hedhog/data/role.yaml`,
        generateRoleYamlEntry(plan)
      )
    );
  }

  if (plan.generateBackend) {
    const names = nestNames(plan);

    files.push(
      createFile(
        fs,
        `libraries/${plan.library}/hedhog/table/${plan.entity}.yaml`,
        generateTableYaml(plan)
      )
    );

    const routeEntries = generateRouteYamlEntries(plan);

    if (routeEntries) {
      files.push(
        appendToFile(
          fs,
          `libraries/${plan.library}/hedhog/data/route.yaml`,
          routeEntries
        )
      );
    }

    files.push(
      createFile(fs, `${names.dir}/${names.kebab}.service.ts`, generateService(plan))
    );
    files.push(
      createFile(
        fs,
        `${names.dir}/${names.kebab}.controller.ts`,
        generateController(plan)
      )
    );
    files.push(
      createFile(fs, `${names.dir}/${names.kebab}.module.ts`, generateModule(plan))
    );
    files.push(
      createFile(fs, `${names.dir}/dto/${names.kebab}.dto.ts`, generateDto(plan))
    );

    const moduleFile = libraryModuleFile(fs, plan);

    if (moduleFile) {
      files.push(moduleFile);
    }
  }

  files.push(
    createFile(
      fs,
      `apps/api/prisma/migrations/${migrationFolderName(plan, timestamp)}/migration.sql`,
      generateMigrationSql(plan)
    )
  );

  return files;
}

/** Passos manuais obrigatórios após a geração (nenhum é executado pelo wizard). */
export function buildFollowUpSteps(plan: ScaffoldPlan): string[] {
  const steps: string[] = [];

  if (plan.generateBackend) {
    steps.push('cd apps/api && pnpm prisma:deploy');
    steps.push('cd apps/api && pnpm prisma:update');
  } else {
    steps.push('cd apps/api && pnpm prisma:deploy');
  }

  steps.push(`hedhog dev assets-to-library ${plan.library}`);
  steps.push('pnpm --filter admin pages-manifest');

  return steps;
}
