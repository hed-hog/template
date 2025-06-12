import type {
  Screen,
  Module,
  FileTreeItem,
  LogEntry,
  SystemStatus,
  DatabaseTable,
} from './types';

export const MOCK_SCREENS: Screen[] = [
  {
    id: '1',
    title: 'Dashboard Principal',
    slug: 'dashboard',
    description: 'Painel principal com métricas e gráficos do sistema',
    layout: 'grid',
    roles: ['admin', 'manager'],
    content: `import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart, Users, TrendingUp, DollarSign } from 'lucide-react'

export default function Dashboard() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">2,350</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">$45,231.89</div>
            <p className="text-xs text-muted-foreground">+20.1% from last month</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}`,
    createdAt: new Date('2024-01-10T10:00:00'),
    updatedAt: new Date('2024-01-15T14:30:00'),
    isPublished: true,
    module: 'core',
    route: '/dashboard',
    filePath: 'app/dashboard/page.tsx',
  },
  {
    id: '2',
    title: 'Contacts',
    slug: 'contacts',
    description: 'Gerenciamento de contatos',
    layout: 'table',
    roles: ['admin'],
    content: `import React from 'react'
import { ContactsTable } from './components/contacts-table'

export default function ContactsPage() {
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Contatos</h1>
      <ContactsTable />
    </div>
  )
}`,
    createdAt: new Date('2024-01-12T09:15:00'),
    updatedAt: new Date('2024-01-14T16:45:00'),
    isPublished: true,
    module: 'contacts',
    route: '/contacts',
    filePath: 'app/contacts/page.tsx',
  },
];

export const MOCK_MODULES: Module[] = [
  {
    id: 'core',
    name: 'Core System',
    description: 'Módulo principal do sistema',
    version: '1.2.0',
    status: 'active',
    screens: 2,
    dependencies: ['@next/core', 'react', 'typescript'],
    createdAt: new Date('2024-01-01T00:00:00'),
    updatedAt: new Date('2024-01-15T10:00:00'),
    author: 'Sistema',
    size: '2.4 MB',
    path: 'modules/core',
  },
  {
    id: 'contacts',
    name: 'Contacts',
    description: 'Sistema de gerenciamento de contatos',
    version: '1.0.5',
    status: 'active',
    screens: 1,
    dependencies: ['@nestjs/typeorm', '@nestjs/common'],
    createdAt: new Date('2024-01-05T00:00:00'),
    updatedAt: new Date('2024-01-12T14:30:00'),
    author: 'Contacts Team',
    size: '1.2 MB',
    path: 'modules/contacts',
  },
];

export const MOCK_TABLES: DatabaseTable[] = [
  {
    id: 'table-person',
    name: 'person',
    schema: 'public',
    columns: [
      {
        id: 'col-1',
        name: 'id',
        type: 'UUID',
        nullable: false,
        primaryKey: true,
        unique: false,
        autoIncrement: false,
        comment: 'Primary key',
      },
      {
        id: 'col-2',
        name: 'name',
        type: 'VARCHAR',
        length: 255,
        nullable: true,
        primaryKey: false,
        unique: false,
        autoIncrement: false,
        comment: 'Person full name',
      },
      {
        id: 'col-3',
        name: 'email',
        type: 'VARCHAR',
        length: 255,
        nullable: true,
        primaryKey: false,
        unique: true,
        autoIncrement: false,
        comment: 'Email address',
      },
      {
        id: 'col-4',
        name: 'created_at',
        type: 'TIMESTAMP',
        nullable: false,
        primaryKey: false,
        unique: false,
        autoIncrement: false,
        defaultValue: 'CURRENT_TIMESTAMP',
        comment: 'Creation timestamp',
      },
      {
        id: 'col-5',
        name: 'person_type_id',
        type: 'INTEGER',
        nullable: true,
        primaryKey: false,
        unique: false,
        autoIncrement: false,
        foreignKey: {
          table: 'person_type',
          column: 'id',
          onDelete: 'CASCADE',
          onUpdate: 'CASCADE',
        },
        comment: 'Reference to person type',
      },
    ],
    indexes: [
      {
        id: 'idx-1',
        name: 'idx_person_email',
        columns: ['email'],
        unique: true,
        type: 'BTREE',
      },
      {
        id: 'idx-2',
        name: 'idx_person_type',
        columns: ['person_type_id'],
        unique: false,
        type: 'BTREE',
      },
    ],
    createdAt: new Date('2024-01-01T00:00:00'),
    updatedAt: new Date('2024-01-15T10:00:00'),
    rowCount: 1250,
    size: '2.4 MB',
  },
  {
    id: 'table-person-type',
    name: 'person_type',
    schema: 'public',
    columns: [
      {
        id: 'col-6',
        name: 'id',
        type: 'INTEGER',
        nullable: false,
        primaryKey: true,
        unique: false,
        autoIncrement: true,
        comment: 'Primary key',
      },
      {
        id: 'col-7',
        name: 'name',
        type: 'VARCHAR',
        length: 100,
        nullable: false,
        primaryKey: false,
        unique: false,
        autoIncrement: false,
        comment: 'Type name',
      },
      {
        id: 'col-8',
        name: 'description',
        type: 'TEXT',
        nullable: true,
        primaryKey: false,
        unique: false,
        autoIncrement: false,
        comment: 'Type description',
      },
      {
        id: 'col-9',
        name: 'active',
        type: 'BOOLEAN',
        nullable: false,
        primaryKey: false,
        unique: false,
        autoIncrement: false,
        defaultValue: 'true',
        comment: 'Is type active',
      },
    ],
    indexes: [
      {
        id: 'idx-3',
        name: 'idx_person_type_name',
        columns: ['name'],
        unique: true,
        type: 'BTREE',
      },
    ],
    createdAt: new Date('2024-01-01T00:00:00'),
    updatedAt: new Date('2024-01-10T15:30:00'),
    rowCount: 15,
    size: '64 KB',
  },
];

export const MOCK_FILE_TREE: FileTreeItem[] = [
  {
    id: '1',
    name: 'admin',
    type: 'library',
    children: [
      {
        id: 'tables',
        name: 'Tables',
        type: 'folder',
        path: 'tables',
        isOpen: false,
        color: '#3b82f6', // blue-500
        children: [
          {
            id: 'table-person',
            name: 'person',
            type: 'table',
            path: 'tables/person',
            table: MOCK_TABLES[0],
          },
          {
            id: 'table-person-type',
            name: 'person_type',
            type: 'table',
            path: 'tables/person_type',
            table: MOCK_TABLES[1],
          },
        ],
      },
      {
        id: 'screens',
        name: 'Screens',
        type: 'folder',
        path: 'screens',
        isOpen: false,
        color: '#10b981', // emerald-500
        children: [
          {
            id: 'screen-contacts',
            name: 'Contacts',
            type: 'screen',
            path: 'screens/contacts',
            screen: MOCK_SCREENS[1],
          },
        ],
      },
      {
        id: 'menus',
        name: 'Menus',
        type: 'folder',
        path: 'menus',
        isOpen: false,
        color: '#f59e0b', // amber-500
        children: [
          {
            id: 'menu-contacts',
            name: 'Contacts',
            type: 'menu',
            path: 'menus/contacts',
          },
        ],
      },
      {
        id: 'settings',
        name: 'Settings',
        type: 'folder',
        path: 'settings',
        isOpen: false,
        color: '#8b5cf6', // violet-500
        children: [
          {
            id: 'settings-contacts',
            name: 'Contacts',
            type: 'folder',
            path: 'settings/contacts',
            isOpen: false,
            children: [
              {
                id: 'settings-contacts-types',
                name: 'Types',
                type: 'setting',
                path: 'settings/contacts/types',
              },
              {
                id: 'settings-contacts-documents',
                name: 'Documents',
                type: 'setting',
                path: 'settings/contacts/documents',
              },
              {
                id: 'settings-contacts-contacts',
                name: 'Contacts',
                type: 'setting',
                path: 'settings/contacts/contacts',
              },
              {
                id: 'settings-contacts-addresses',
                name: 'Addresses',
                type: 'setting',
                path: 'settings/contacts/addresses',
              },
            ],
          },
        ],
      },
    ],
  },
];

export const MOCK_LOGS: LogEntry[] = [
  {
    id: '1',
    level: 'info',
    message: 'Application started successfully',
    timestamp: new Date(Date.now() - 3600000),
    source: 'nextjs',
  },
  {
    id: '2',
    level: 'error',
    message: 'Failed to connect to database',
    timestamp: new Date(Date.now() - 1800000),
    source: 'database',
  },
  {
    id: '3',
    level: 'warn',
    message: 'Deprecated API endpoint used',
    timestamp: new Date(Date.now() - 900000),
    source: 'nestjs',
  },
];

export const MOCK_SYSTEM_STATUS: SystemStatus = {
  database: 'connected',
  api: 'online',
  frontend: 'running',
  migrations: 2,
  errors: 1,
};
