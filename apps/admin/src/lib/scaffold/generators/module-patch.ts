export type ModulePatchResult =
  | { ok: true; contents: string; addition: string }
  | { ok: false; reason: string };

function ensureForwardRefImport(source: string): string {
  const nestImportPattern = /import\s*\{([^}]*)\}\s*from\s*'@nestjs\/common';/;
  const match = source.match(nestImportPattern);
  const importedNames = match?.[1];

  if (!importedNames || importedNames.includes('forwardRef')) {
    return source;
  }

  const names = importedNames
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);

  names.push('forwardRef');
  names.sort((left, right) => left.localeCompare(right));

  return source.replace(
    nestImportPattern,
    `import { ${names.join(', ')} } from '@nestjs/common';`
  );
}

function insertImportStatement(source: string, statement: string): string {
  const importPattern = /^import .*;$/gm;
  let lastImportEnd = -1;
  let match: RegExpExecArray | null;

  while ((match = importPattern.exec(source)) !== null) {
    lastImportEnd = match.index + match[0].length;
  }

  if (lastImportEnd === -1) {
    return `${statement}\n${source}`;
  }

  return `${source.slice(0, lastImportEnd)}\n${statement}${source.slice(lastImportEnd)}`;
}

/**
 * Registra o módulo da nova entidade no módulo raiz da library: adiciona o
 * import e insere `forwardRef(() => XModule)` no array `imports` do `@Module`.
 *
 * Retorna `ok: false` quando o arquivo foge do formato esperado — nesse caso o
 * wizard mostra a instrução manual em vez de reescrever o arquivo às cegas.
 */
export function patchLibraryModule(
  source: string,
  moduleClass: string,
  importPath: string
): ModulePatchResult {
  if (source.includes(`${moduleClass}`)) {
    return { ok: false, reason: `${moduleClass} já está referenciado no módulo.` };
  }

  const moduleDecoratorIndex = source.indexOf('@Module({');

  if (moduleDecoratorIndex === -1) {
    return { ok: false, reason: 'Decorator @Module({ não encontrado.' };
  }

  const importsIndex = source.indexOf('imports:', moduleDecoratorIndex);

  if (importsIndex === -1) {
    return { ok: false, reason: 'Array `imports` não encontrado no @Module.' };
  }

  const bracketIndex = source.indexOf('[', importsIndex);

  if (bracketIndex === -1) {
    return { ok: false, reason: 'Array `imports` não encontrado no @Module.' };
  }

  const entry = `\n    forwardRef(() => ${moduleClass}),`;
  const withEntry =
    source.slice(0, bracketIndex + 1) + entry + source.slice(bracketIndex + 1);

  const importStatement = `import { ${moduleClass} } from '${importPath}';`;
  const withImport = insertImportStatement(withEntry, importStatement);

  return {
    ok: true,
    contents: ensureForwardRefImport(withImport),
    addition: `${importStatement}\n${entry.trim()}`,
  };
}
