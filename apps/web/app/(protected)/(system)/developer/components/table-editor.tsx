'use client';

import {
  Plus,
  Trash2,
  Save,
  Table2Icon,
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
import type { Tab,  } from '../types';
import { useSystem } from '@/components/provider/system-provider';
import { useQuery } from '@tanstack/react-query';
import type React from 'react';
import { useState, useCallback, useMemo, memo, useEffect } from 'react';
import { FixedSizeList as List } from 'react-window';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { IconColumns,  IconLinkPlus, IconListDetails } from '@tabler/icons-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import DataGridEditor from './data-grid-editor';

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

interface DatabaseColumnForeignKey {
  table: string;
  column: string;
  onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
  onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
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
  locale?: Record<string, string>;
  defaultValue: string;
  references?: DatabaseColumnForeignKey;
  
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
          primaryKey: col.primaryKey ||true,
          autoIncrement: col.autoIncrement || true,
          length: col.length || null,
          unsigned: col.unsigned || true,
          name: col.name || 'id',
        };
      case 'SLUG':
        return {
          ...col,
          length: col.length || 255,
          unique: col.unique || true,
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
          defaultValue: col.defaultValue || '0',
          unsigned: col.unsigned || true,
          name: col.name || 'order',
        };
      case 'LOCALE_VARCHAR':
      case 'LOCALE_TEXT':
        return {
          ...col,
          locale: col.locale || {},
        };
      case 'FK':
        return {
          ...col,
          foreignKey: {
            table: col.references?.table || '',
            column: col.references?.column || '',
            onDelete: col.references?.onDelete || 'NO ACTION',
            onUpdate: col.references?.onUpdate || 'NO ACTION',
          },
        };
      case '':
        return {
          ...col,
          type: 'VARCHAR',
          length: col.length || 255,
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
  const [activeTabId, onTabSelect] = useState<string>('columns');
  const [isLoading, setIsLoading] = useState(false);
  const [tab, setTab] = useState<Tab>(initActiveTab);
  const { request, language } = useSystem();

  const initialData: DatabaseTable = {
    id: tab.id,
    name: tab.title,
    library: tab.library,
    columns: [],
  };

  const { data } =
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
      defaultValue: 'NULL',
      
    };
    setColumns((prevColumns) => [...prevColumns, newColumn]);
  }, [columns.length]);

  // Save function
  const handleSave = useCallback(async () => {
    setIsLoading(true);
    request({
      url: '/developer/table',
      method: 'POST',
      data: {
        tableName: tab.title,
        library: tab.library,
        columns: columns.map((col) => {

          const data: any = {};

          if (col.type) {
            data['type'] = col.type.toUpperCase();
          }

          if (col.name) {
            data['name'] = col.name;
          }

          if (col.length) {
            data['length'] = Number(col.length);
          }

          if (col.nullable !== undefined) {
            data['isNullable'] = !col.nullable;
          }

          if (col.primaryKey) {
            data['isPrimaryKey'] = col.primaryKey;
          }

          if (col.unique) {
            data['isUnique'] = col.unique;
          }

          if (col.unsigned) {
            data['unsigned'] = col.unsigned;
          }

          if (col.defaultValue) {
            data['default'] = col.defaultValue;
          }

          if (col.autoIncrement) {
            data['generationStrategy'] = 'increment';
          }

          if (col.references) {
            data['references'] = {
              table: col.references.table,
              column: col.references.column || '',
              onDelete: col.references.onDelete || 'NO ACTION',
              onUpdate: col.references.onUpdate || 'NO ACTION',
            };
          }

          if (col.locale) {
            data['locale'] = col.locale;
          }

          return data;
        }),
      },
    })
      .then((data) => {
       
        console.log('Table saved successfully:', data);

        onContentChange(false);
      })
      .catch((error) => {
        console.error('Error saving table:', error);
      }).finally(() => {
        setIsLoading(false);
      })

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

  const listheight = document.body.clientHeight - 30 - 36 - 48 - 24 - 4;
    

  useEffect(() => {
    setTab(initActiveTab);
  }, [initActiveTab]);

  useEffect(() => {
    const formattedColumns = formatColumns(table.columns);
    setColumns(formattedColumns);
  }, [table.columns]);

  const renderContentTab = () => {
    switch (activeTabId) {
      case 'columns':
        return (
          <>
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

        <CardContent className={`p-0 border-none`} style={{height: `${listheight}px`}}>
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
                    listheight,
                    columns.length * 50
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
        </CardContent></>
        );
      case 'data':
        return (
          <>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-2">
          <div className="flex items-center gap-2">
            <Table2Icon className="h-4 w-4" />
            <CardTitle className="text-md">Table Data</CardTitle>
            <span className="text-sm text-muted-foreground">
              {columns.length} registers
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

        <CardContent className={`p-0 border-none`} style={{height: `${listheight}px`}}>
          <DataGridEditor/>
        </CardContent>
          </>
        );
      default:
        return <></>;
    }
  }

  return (
    <TooltipProvider>
      <Card className="w-full mx-auto border-none shadow-none">
        {renderContentTab()}
        <CardFooter className="flex justify-start p-0 overflow-auto bg-muted">
          <div className="flex w-fit">
            {[{id:'columns', icon:<Table2Icon className="h-4 w-4"/>, title:'Columns'},{id:'data', icon:<IconListDetails className="h-4 w-4"/>, title:'Data'}].map((tab) => <div
              key={tab.id}
              className={cn(
                'flex items-center h-9 px-4 border-r border-t-2 text-sm cursor-pointer select-none',
                activeTabId === tab.id
                  ? 'border-t-primary bg-background'
                  : 'border-t-transparent hover:bg-accent/50',
              )}
              onClick={() => onTabSelect(tab.id)}
            >
              <span
                className={cn(
                  'mr-1 gap-2 flex items-center',
                )}
              >
                {tab.icon}
                {tab.title}
              </span>
            </div>)}
          </div>
        </CardFooter>
      </Card>
    </TooltipProvider>
  );
}
