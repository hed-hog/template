'use client';

import { useState, useCallback, memo } from 'react';
import { FixedSizeList, type ListChildComponentProps } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Save, Trash2, TableIcon, Columns } from 'lucide-react';
import {
  type ColumnMeta,
  type RowData,
  sampleColumnMetas,
  sampleInitialRows,
  createNewRowData,
} from './grid-types';
import { EditableCell } from './editable-cell';
import { useQuery } from '@tanstack/react-query';
import { useSystem } from '@/components/provider/system-provider';

const ROW_HEIGHT = 48; // Adjust based on cell content and padding

interface GridRowProps extends ListChildComponentProps {
  data: {
    rows: RowData[];
    columns: ColumnMeta[];
    updateCell: (rowIndex: number, columnKey: string, value: any) => void;
    deleteRow: (rowIndex: number) => void;
    totalColumnsWidth: number;
  };
}

const GridRow = memo(({ index, style, data }: GridRowProps) => {
  const { rows, columns, updateCell, deleteRow, totalColumnsWidth } = data;
  const row = rows[index];

  if (!row) return null;

  return (
    <div
      style={style}
      className="flex items-stretch border-b dark:border-neutral-700 hover:bg-muted/30"
    >
      <div className="flex items-center sticky left-0 z-[1] bg-inherit hover:bg-inherit">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => deleteRow(index)}
          className="text-destructive hover:bg-destructive/10 w-10 h-full rounded-none border-r dark:border-neutral-700"
          title="Delete row"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <ScrollArea
        className="flex-grow whitespace-nowrap"
        orientation="horizontal"
      >
        <div
          className="flex items-stretch"
          style={{ width: `${totalColumnsWidth}px` }}
        >
          {columns.map((col) => (
            <div
              key={col.key}
              className="border-r dark:border-neutral-700 flex-shrink-0"
              style={{ width: `${col.width || 150}px` }}
            >
              <EditableCell
                value={row[col.key]}
                column={col}
                onSave={(newValue) => updateCell(index, col.key, newValue)}
              />
            </div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
});
GridRow.displayName = 'GridRow';

const getDataTypeFromType = (type: string) => {
  switch (type) {
    case 'pk':
    case 'fk':
    case 'int':
    case 'decimal':
    case 'order':
      return 'number';
    case 'slug':
      return 'string';
    case 'bit':
    case 'boolean':
      return 'boolean';
    case 'date':
    case 'datetime':
    case 'timestamp':
    case 'created_at':
    case 'updated_at':
      return 'date';
    default:
      return 'string';
  }
};

type DataGridEditorProps = {
  library: string;
  table: string;
};

export default function DataGridEditor({
  library,
  table,
}: DataGridEditorProps) {
  const { request, language } = useSystem();

  const { data } = useQuery<any>({
    queryKey: [library, table, language],
    queryFn: () =>
      request({
        url: `/developer/data/${library}/${table}`,
      }),
    initialData: {
      data: [],
      table: {
        columns: [],
      },
    },
  });

  const [columnMetas] = useState<ColumnMeta[]>(
    data.table.columns
      .filter((col: any) => !['pk'].includes(col.type))
      .map((col: any) => ({
        key: col.name,
        label: col.name,
        dataType: getDataTypeFromType(col.type),
        width: col.width || 150,
        defaultValue: col.default || '',
      })),
  );
  const [rowsData, setRowsData] = useState<RowData[]>(
    data.data.map((row: any) => ({
      ...row,
      id: row.id || crypto.randomUUID(),
    })),
  );
  const { toast } = useToast();

  const totalColumnsWidth = columnMetas.reduce(
    (acc, col) => acc + (col.width || 100),
    0,
  );

  const addRow = useCallback(() => {
    setRowsData((prev) => [createNewRowData(columnMetas), ...prev]); // Add to top
    toast({
      title: 'Row Added',
      description: 'A new row has been added to the top.',
    });
  }, [columnMetas, toast]);

  const deleteRow = useCallback(
    (rowIndex: number) => {
      setRowsData((prev) => prev.filter((_, i) => i !== rowIndex));
      toast({ title: 'Row Deleted', variant: 'destructive' });
    },
    [toast],
  );

  const updateCell = useCallback(
    (rowIndex: number, columnKey: string, value: any) => {
      setRowsData((prev) =>
        prev.map((row, i) =>
          i === rowIndex ? { ...row, [columnKey]: value } : row,
        ),
      );
    },
    [],
  );

  const handleSaveChanges = () => {
    console.log('Saving data:', rowsData);
    toast({
      title: 'Data Saved (Simulated)',
      description: 'Current data logged to console.',
    });
  };

  const itemData = {
    rows: rowsData,
    columns: columnMetas,
    updateCell,
    deleteRow,
    totalColumnsWidth,
  };

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] bg-card dark:bg-neutral-800 shadow-md rounded-lg overflow-hidden">
      {/* Header */}
      <div className="p-3 border-b dark:border-neutral-700 flex items-center justify-between space-x-4">
        <div className="flex items-center space-x-2">
          <TableIcon className="w-5 h-5 text-primary" />
          <span className="text-lg font-semibold">Data Editor</span>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            onClick={addRow}
            variant="outline"
            size="sm"
            className="bg-secondary text-secondary-foreground hover:bg-secondary/90"
          >
            <PlusCircle className="w-4 h-4 mr-2" /> Add Row
          </Button>
          <Button
            onClick={handleSaveChanges}
            size="sm"
            className="bg-green-600 text-white hover:bg-green-700"
          >
            <Save className="w-4 h-4 mr-2" /> Save Data
          </Button>
        </div>
      </div>

      {/* Column Headers (Static) */}
      <div className="flex items-center border-b dark:border-neutral-700 bg-muted/50 dark:bg-neutral-700/50 sticky top-0 z-10">
        <div className="w-10 border-r dark:border-neutral-700 sticky left-0 z-[1] bg-inherit flex items-center justify-center">
          <Columns size={16} className="text-muted-foreground" />
        </div>
        <ScrollArea
          className="flex-grow whitespace-nowrap"
          orientation="horizontal"
        >
          <div
            className="flex items-center h-[36px]"
            style={{ width: `${totalColumnsWidth}px` }}
          >
            {columnMetas.map((col) => (
              <div
                key={col.key}
                className="px-2 py-1 text-xs font-xs text-muted-foreground border-r dark:border-neutral-700 flex-shrink-0 flex items-center"
                style={{ width: `${col.width || 150}px` }}
              >
                {col.label}
              </div>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Virtualized Rows */}
      <div className="flex-grow relative">
        <AutoSizer>
          {({ height, width }) => (
            <FixedSizeList
              height={height}
              width={width}
              itemCount={rowsData.length}
              itemSize={ROW_HEIGHT}
              itemData={itemData}
              className="overscroll-contain"
            >
              {GridRow}
            </FixedSizeList>
          )}
        </AutoSizer>
      </div>
    </div>
  );
}
