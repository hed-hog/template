'use client';

import {
  Plus,
  Trash2,
  Save,
  Table2Icon,
  Locate,
  Languages,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Tab } from '../types';
import { useSystem } from '@/components/provider/system-provider';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IconLinkPlus } from '@tabler/icons-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface TableEditorProps {
  activeTab: Tab;
  onSave: (table: Tab) => void;
  onContentChange: (hasChanges: boolean) => void;
}

const DATA_TYPES = [
  'LOCALE_VARCHAR',
  'LOCALE_TEXT',
  'PK',
  'FK',
  'SLUG',
  'ORDER',
  'CREATED_AT',
  'UPDATED_AT',

  'VARCHAR',
  'TEXT',
  'INTEGER',
  'BIGINT',
  'DECIMAL',
  'FLOAT',
  'BOOLEAN',
  'DATE',
  'TIMESTAMP',
  'UUID',
  'JSON',
  'BYTEA',
];

interface DatabaseTable {
  id: string;
  name: string;
  library: string;
  columns: DatabaseColumn[];
}

interface DatabaseColumn {
  id: string;
  name: string;
  type: string;
  length: number | null;
  nullable: boolean;
  primaryKey: boolean;
  unique: boolean;
  unsigned: boolean;
  autoIncrement: boolean;
  locale: boolean;
  defaultValue: string;
  foreignKey: string;
}

const columnsWith = {
  name: 'flex-1',
  type: 'w-32',
  lengthCol: 'w-20',
  nullable: 'w-12',
  primaryKey: 'w-12',
  unique: 'w-12',
  unsigned: 'w-12',
  autoIncrement: 'w-12',
  locale: 'w-16',
  defaultValue: 'w-40',
  foreignKey: 'w-24',
  actions: 'w-24',
};

const isColumnDisabled = (type: string): boolean => {
  return [
    'PK',
    'SLUG',
    'FK',
    'ORDER',
    'LOCALE_VARCHAR',
    'LOCALE_TEXT',
    'CREATED_AT',
    'UPDATED_AT',
  ].includes(type);
};

const formatColumns = (columns: DatabaseColumn[]): DatabaseColumn[] => {
  return ((columns || []) as DatabaseColumn[]).map((col, id) => {
    col.id = col.id || `col-${id}`;
    col.type = (col.type ?? '').toUpperCase();
    switch (col.type) {
      case 'PK':
        return {
          ...col,
          primaryKey: true,
          autoIncrement: true,
          length: null,
          unsigned: true,
          name: col.name || 'id',
        };
      case 'SLUG':
        return {
          ...col,
          length: 255,
          unique: true,
          name: col.name || 'slug',
        };
      case 'INT':
        return {
          ...col,
          type: 'INTEGER',
        };
      case 'CREATED_AT':
        return {
          ...col,
          defaultValue: 'CURRENT_TIMESTAMP',
          name: col.name || 'created_at',
        };
      case 'UPDATED_AT':
        return {
          ...col,
          defaultValue: 'CURRENT_TIMESTAMP',
          name: col.name || 'updated_at',
        };
      case 'ORDER':
        return {
          ...col,
          type: 'INTEGER',
          defaultValue: '0',
          unsigned: true,
          name: col.name || 'order',
        };
      case 'LOCALE_VARCHAR':
      case 'LOCALE_TEXT':
        return {
          ...col,
          locale: true,
        };
      case '':
        return {
          ...col,
          type: 'VARCHAR',
          length: 255,
        };
    }
    return col;
  });
};

// Memoized row component for performance
const ColumnRow = memo(
  ({
    index,
    style,
    data,
  }: {
    index: number;
    style: React.CSSProperties;
    data: {
      columns: DatabaseColumn[];
      onUpdateColumn: (
        id: string,
        field: keyof DatabaseColumn,
        value: any,
      ) => void;
      onDeleteColumn: (id: string) => void;
    };
  }) => {
    const { columns, onUpdateColumn, onDeleteColumn } = data;
    const column = columns[index];

    const handleFieldChange = useCallback(
      (field: keyof DatabaseColumn, value: any) => {
        onUpdateColumn(column.id, field, value);
      },
      [column.id, onUpdateColumn],
    );

    return (
      <div
        style={style}
        className="flex items-center gap-1 px-2 py-1 border-b hover:bg-gray-50"
      >
        {/* Name */}
        <div className={columnsWith.name}>
          <Input
            value={column.name}
            onChange={(e) => handleFieldChange('name', e.target.value)}
            className="h-6 text-sm border-none bg-transparent rounded-none p-1"
            placeholder="Column name"
          />
        </div>

        {/* Type */}
        <div className={columnsWith.type}>
          <Select
            value={column.type}
            onValueChange={(value) => handleFieldChange('type', value)}
          >
            <SelectTrigger className="h-6 text-sm border-none bg-transparent rounded-none p-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATA_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Length */}
        <div className={columnsWith.lengthCol}>
          <Input
            type="number"
            value={column.length || ''}
            onChange={(e) =>
              handleFieldChange(
                'length',
                e.target.value ? Number.parseInt(e.target.value) : null,
              )
            }
            className="h-6 text-sm border-none bg-transparent rounded-none p-1 disabled:text-gray-500"
            disabled={isColumnDisabled(column.type)}
            placeholder="Length"
          />
        </div>

        {/* Null */}
        <div className={cn(columnsWith.nullable, 'flex justify-center')}>
          <Checkbox
            checked={!column.nullable}
            onCheckedChange={(checked) =>
              handleFieldChange('nullable', checked)
            }
            disabled={isColumnDisabled(column.type)}
          />
        </div>

        {/* PK */}
        <div className={cn(columnsWith.primaryKey, 'flex justify-center')}>
          <Checkbox
            checked={column.primaryKey}
            onCheckedChange={(checked) =>
              handleFieldChange('primaryKey', checked)
            }
            disabled={isColumnDisabled(column.type)}
          />
        </div>

        {/* UQ */}
        <div className={cn(columnsWith.unique, 'flex justify-center')}>
          <Checkbox
            checked={column.unique}
            onCheckedChange={(checked) => handleFieldChange('unique', checked)}
            disabled={isColumnDisabled(column.type)}
          />
        </div>
        {/* UN */}
        <div className={cn(columnsWith.unsigned, 'flex justify-center')}>
          <Checkbox
            checked={column.unsigned}
            onCheckedChange={(checked) =>
              handleFieldChange('unsigned', checked)
            }
            disabled={isColumnDisabled(column.type)}
          />
        </div>

        {/* AI */}
        <div className={cn(columnsWith.autoIncrement, 'flex justify-center')}>
          <Checkbox
            checked={column.autoIncrement}
            onCheckedChange={(checked) =>
              handleFieldChange('autoIncrement', checked)
            }
            disabled={isColumnDisabled(column.type)}
          />
        </div>

        {/* Default */}
        <div className={columnsWith.defaultValue}>
          <Input
            value={column.defaultValue}
            onChange={(e) => handleFieldChange('defaultValue', e.target.value)}
            className="h-6 text-sm border-none bg-transparent rounded-none p-1 disabled:text-gray-500"
            disabled={isColumnDisabled(column.type)}
            placeholder="Default value"
          />
        </div>

        {/* FK */}
        <div className={columnsWith.foreignKey}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 p-0 disabled:bg-gray-200 disabled:text-gray-500"
                disabled={!(
                  column.type === 'PK' ||
                    (column.type === 'INTEGER' && column.unsigned),
                )}
              >
                <IconLinkPlus className="h-4 w-4" />
                <span className="sr-only">Add FK</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Connect to table</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Actions */}
        <div className={cn(columnsWith.actions, 'flex justify-end gap-1')}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 p-0 text-blue-500 hover:text-white hover:bg-blue-500 disabled:bg-gray-200 disabled:text-gray-500"
                disabled={!column.locale}
              >
                <Languages className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Translations</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDeleteColumn(column.id)}
                className="h-8 w-8 p-0 text-red-500 hover:text-white hover:bg-red-500"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left">
              <p>Remove column</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  },
);

ColumnRow.displayName = 'ColumnRow';

export function TableEditor({
  activeTab: initActiveTab,
  onSave,
  onContentChange,
}: TableEditorProps) {
  const [tab, setTab] = useState<Tab>(initActiveTab);
  const { request, language } = useSystem();

  const initialData: DatabaseTable = {
    id: tab.id,
    name: tab.title,
    library: tab.library,
    columns: [],
  };

  const { data, isLoading, isFetching, isPending, isRefetching } =
    useQuery<DatabaseTable>({
      queryKey: [tab.id, language],
      queryFn: () =>
        request({
          url: `/developer/table/${tab.library}/${tab.title}`,
        }),
      initialData,
    });

  let table: DatabaseTable = {
    ...initialData,
    ...data,
  };

  const [columns, setColumns] = useState<DatabaseColumn[]>([]);

  // Optimized update function using useCallback
  const handleUpdateColumn = useCallback(
    (id: string, field: keyof DatabaseColumn, value: any) => {
      setColumns((prevColumns) =>
        prevColumns.map((col) =>
          col.id === id ? { ...col, [field]: value } : col,
        ),
      );
    },
    [],
  );

  // Optimized delete function
  const handleDeleteColumn = useCallback((id: string) => {
    setColumns((prevColumns) => prevColumns.filter((col) => col.id !== id));
  }, []);

  // Add new column
  const handleAddColumn = useCallback(() => {
    const newColumn: DatabaseColumn = {
      id: `col-${Date.now()}`,
      name: `new_column_${columns.length + 1}`,
      type: 'VARCHAR',
      length: 255,
      nullable: true,
      primaryKey: false,
      unique: false,
      unsigned: false,
      autoIncrement: false,
      locale: false,
      defaultValue: 'NULL',
      foreignKey: '',
    };
    setColumns((prevColumns) => [...prevColumns, newColumn]);
  }, [columns.length]);

  // Save function
  const handleSave = useCallback(async () => {
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000));

    console.log('Saved columns:', columns);
  }, [columns]);

  // Memoized data for virtual list
  const listData = useMemo(
    () => ({
      columns,
      onUpdateColumn: handleUpdateColumn,
      onDeleteColumn: handleDeleteColumn,
    }),
    [columns, handleUpdateColumn, handleDeleteColumn],
  );

  useEffect(() => {
    setTab(initActiveTab);
  }, [initActiveTab]);

  useEffect(() => {
    const formattedColumns = formatColumns(table.columns);
    setColumns(formattedColumns);
  }, [table.columns]);

  return (
    <TooltipProvider>
      <Card className="w-full max-w-7xl mx-auto border-none shadow-none">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
          <div className="flex items-center gap-2">
            <Table2Icon className="h-4 w-4" />
            <CardTitle className="text-md">Table Editor</CardTitle>
            <span className="text-sm text-muted-foreground">
              {columns.length} columns
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleAddColumn}
              size="sm"
              className="h-8 px-2"
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-1" />
              Column
            </Button>
            <Button
              onClick={handleSave}
              size="sm"
              disabled={isLoading}
              className="h-8 px-2"
            >
              <Save className="h-4 w-4 mr-1" />
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0 border-none">
          {columns.length > 0 ? (
            <>
              {/* Header */}
              <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-t font-medium text-sm sticky top-0 z-10 dark:bg-gray-800">
                <div className={columnsWith.name}>Name</div>
                <div className={columnsWith.type}>Type</div>
                <div className={columnsWith.lengthCol}>Length</div>
                <div className={cn(columnsWith.nullable, 'text-center')}>
                  NN
                </div>
                <div className={cn(columnsWith.primaryKey, 'text-center')}>
                  PK
                </div>
                <div className={cn(columnsWith.unique, 'text-center')}>UQ</div>
                <div className={cn(columnsWith.unsigned, 'text-center')}>
                  UN
                </div>
                <div className={cn(columnsWith.autoIncrement, 'text-center')}>
                  AI
                </div>
                <div className={columnsWith.defaultValue}>Default</div>
                <div className={columnsWith.foreignKey}>FK</div>
                <div className={columnsWith.actions}> </div>
              </div>

              {/* Virtualized List */}
              <div className="border-b">
                {' '}
                {/* This container might need specific height if List height is percentage */}
                <List
                  height={Math.min(
                    document.body.clientHeight - 30 - 36 - 48 - 24,
                    columns.length * 50,
                  )} // Max height 600px, or total height if less
                  itemCount={columns.length}
                  itemSize={50} // Each row is 50px tall
                  itemData={listData}
                  overscanCount={5} // Render 5 items above and below the visible area
                >
                  {ColumnRow}
                </List>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-gray-500">
              No columns to display. Click "Add Column" to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </TooltipProvider>
  );
}
