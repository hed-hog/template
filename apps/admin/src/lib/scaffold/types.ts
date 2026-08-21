export const SCAFFOLD_TEMPLATES = [
  'list-kpi',
  'list-simple',
  'detail-form',
  'dashboard',
] as const;

export type ScaffoldTemplate = (typeof SCAFFOLD_TEMPLATES)[number];

export const SCAFFOLD_COLUMN_TYPES = [
  'varchar',
  'text',
  'int',
  'decimal',
  'boolean',
  'date',
  'datetime',
  'jsonb',
  'enum',
  'fk',
  'slug',
  'locale_varchar',
  'locale_text',
] as const;

export type ScaffoldColumnType = (typeof SCAFFOLD_COLUMN_TYPES)[number];

export type ScaffoldColumn = {
  name: string;
  type: ScaffoldColumnType;
  nullable: boolean;
  length?: number;
  precision?: number;
  scale?: number;
  defaultValue?: string;
  enumValues?: string[];
  referencesTable?: string;
  labelEn: string;
  labelPt: string;
  /** Vira coluna da tabela / campo do card na listagem. */
  inList: boolean;
  /** Vira select de filtro na SearchBar (só faz sentido para enum/boolean/fk). */
  inFilters: boolean;
};

export type ScaffoldEndpoints = {
  list: boolean;
  stats: boolean;
  get: boolean;
  create: boolean;
  update: boolean;
  remove: boolean;
};

export type ScaffoldRoleDefinition = {
  slug: string;
  nameEn: string;
  namePt: string;
  descriptionEn: string;
  descriptionPt: string;
};

export type ScaffoldPlan = {
  library: string;
  /** snake_case singular; também é o nome da tabela. */
  entity: string;
  /** Rota do admin, sempre iniciando por `/<library>`. */
  route: string;
  labelEn: string;
  labelPt: string;
  descriptionEn: string;
  descriptionPt: string;
  template: ScaffoldTemplate;
  columns: ScaffoldColumn[];
  /** Prefixo do controller NestJS, ex.: `/contract`. */
  apiBasePath: string;
  endpoints: ScaffoldEndpoints;
  generateBackend: boolean;
  menu: {
    parentSlug: string | null;
    icon: string;
    order: number;
  };
  /** Slugs de cargos existentes; `admin` é sempre incluído. */
  roles: string[];
  newRole: ScaffoldRoleDefinition | null;
  /** Sobrescreve arquivos existentes em vez de recusar a escrita. */
  overwrite: boolean;
};

export type ScaffoldFileAction = 'create' | 'merge' | 'patch' | 'manual';

export type ScaffoldFile = {
  /** Caminho relativo à raiz do monorepo, com separadores `/`. */
  path: string;
  action: ScaffoldFileAction;
  /** Conteúdo final do arquivo. Vazio quando `action === 'manual'`. */
  contents: string;
  /** Trecho apresentado no preview: arquivo inteiro em `create`, adição em `merge`/`patch`. */
  preview: string;
  exists: boolean;
  /** Preenchido quando `action === 'manual'`: o que o desenvolvedor precisa fazer à mão. */
  instruction?: string;
};

/** Acesso somente-leitura ao repositório, injetado para manter os geradores testáveis. */
export type ScaffoldFs = {
  read: (relativePath: string) => string | null;
  exists: (relativePath: string) => boolean;
};

export type ScaffoldContext = {
  libraries: string[];
  entitiesByLibrary: Record<string, string[]>;
  existingRoutes: string[];
};
