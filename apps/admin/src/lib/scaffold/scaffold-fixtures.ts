import type { ScaffoldFs, ScaffoldPlan } from './types';

/** Filesystem em memória para exercitar os geradores sem tocar no repositório. */
export function createMemoryFs(files: Record<string, string>): ScaffoldFs {
  return {
    read: (relativePath) => files[relativePath] ?? null,
    exists: (relativePath) =>
      relativePath in files ||
      Object.keys(files).some((key) => key.startsWith(`${relativePath}/`)),
  };
}

export function createTestPlan(overrides: Partial<ScaffoldPlan> = {}): ScaffoldPlan {
  return {
    library: 'crm',
    entity: 'service_order',
    route: '/crm/service-orders',
    labelEn: 'Service Orders',
    labelPt: 'Ordens de serviço',
    descriptionEn: 'Manage service orders.',
    descriptionPt: 'Gerencie as ordens de serviço.',
    template: 'list-kpi',
    columns: [
      {
        name: 'title',
        type: 'varchar',
        nullable: false,
        length: 180,
        labelEn: 'Title',
        labelPt: 'Título',
        inList: true,
        inFilters: false,
      },
      {
        name: 'status',
        type: 'enum',
        nullable: false,
        defaultValue: 'open',
        enumValues: ['open', 'closed'],
        labelEn: 'Status',
        labelPt: 'Situação',
        inList: true,
        inFilters: true,
      },
      {
        name: 'person_id',
        type: 'fk',
        nullable: true,
        referencesTable: 'person',
        labelEn: 'Person',
        labelPt: 'Pessoa',
        inList: false,
        inFilters: false,
      },
    ],
    apiBasePath: '/service-order',
    endpoints: {
      list: true,
      stats: true,
      get: true,
      create: true,
      update: true,
      remove: true,
    },
    generateBackend: true,
    menu: { parentSlug: '/crm', icon: 'file-text', order: 5 },
    roles: ['admin', 'admin-crm'],
    newRole: null,
    overwrite: false,
    ...overrides,
  };
}
