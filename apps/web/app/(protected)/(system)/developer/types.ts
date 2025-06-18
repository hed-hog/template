import { ReactNode } from 'react';

export interface Screen {
  id: string;
  title: string;
  slug: string;
  description: string;
  layout: 'blank' | 'table' | 'list' | 'gridlist' | 'grid';
  roles: string[];
  content: string;
  createdAt: Date;
  updatedAt: Date;
  isPublished: boolean;
  module?: string;
  route: string;
  filePath: string;
}

export interface Module {
  id: string;
  name: string;
  description: string;
  version: string;
  status: 'active' | 'inactive' | 'error';
  screens: number;
  dependencies: string[];
  createdAt: Date;
  updatedAt: Date;
  author: string;
  size: string;
  path: string;
}

export interface TableColumn {
  id: string;
  name: string;
  type: string;
  length?: number;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  autoIncrement: boolean;
  defaultValue?: string;
  comment?: string;
  foreignKey?: {
    table: string;
    column: string;
    onDelete: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  };
}

export interface DatabaseTable {
  id: string;
  name: string;
  schema: string;
  columns: TableColumn[];
  indexes: TableIndex[];
  createdAt: Date;
  updatedAt: Date;
  rowCount: number;
  size: string;
}

export interface TableIndex {
  id: string;
  name: string;
  columns: string[];
  unique: boolean;
  type: 'BTREE' | 'HASH' | 'GIN' | 'GIST';
}

export interface FileTreeItem {
  id: string;
  name: string;
  type: 'file' | 'folder' | 'table' | 'screen' | 'setting' | 'library';
  path: string;
  children?: FileTreeItem[];
  isOpen?: boolean;
  screen?: Screen;
  table?: DatabaseTable;
  module?: string;
  color?: string;
}

export interface Tab {
  id: string;
  title: string;
  type: 'screen' | 'setting' | 'table';
  icon: ReactNode;
  content?: any;
  isDirty?: boolean;
  filePath?: string;
}

export interface SystemStatus {
  database: 'connected' | 'disconnected' | 'error';
  api: 'online' | 'offline' | 'error';
  frontend: 'running' | 'stopped' | 'error';
  migrations: number;
  errors: number;
}

export interface LogEntry {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: Date;
  source: 'nextjs' | 'nestjs' | 'database' | 'system';
  details?: any;
}
