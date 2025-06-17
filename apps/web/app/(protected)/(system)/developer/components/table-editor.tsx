'use client';

import { useState } from 'react';
import { Plus, Trash2, Link, Save, Code, Key, Database } from 'lucide-react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import type { DatabaseTable, TableColumn } from '../types';

interface TableEditorProps {
  table: DatabaseTable;
  onSave: (table: DatabaseTable) => void;
  onContentChange: (hasChanges: boolean) => void;
}

const DATA_TYPES = [
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

export function TableEditor({
  table,
  onSave,
  onContentChange,
}: TableEditorProps) {
  const [editedTable, setEditedTable] = useState<DatabaseTable>(table);
  const [activeTab, setActiveTab] = useState('columns');

  const handleSave = () => {
    onSave(editedTable);
    onContentChange(false);
  };

  const addColumn = () => {
    const newColumn: TableColumn = {
      id: `col_${Date.now()}`,
      name: 'new_column',
      type: 'VARCHAR',
      length: 255,
      nullable: true,
      primaryKey: false,
      unique: false,
      autoIncrement: false,
    };

    setEditedTable((prev) => ({
      ...prev,
      columns: [...prev.columns, newColumn],
    }));
    onContentChange(true);
  };

  const updateColumn = (columnId: string, updates: Partial<TableColumn>) => {
    setEditedTable((prev) => ({
      ...prev,
      columns: prev.columns.map((col) =>
        col.id === columnId ? { ...col, ...updates } : col,
      ),
    }));
    onContentChange(true);
  };

  const removeColumn = (columnId: string) => {
    setEditedTable((prev) => ({
      ...prev,
      columns: prev.columns.filter((col) => col.id !== columnId),
    }));
    onContentChange(true);
  };

  const generateSQL = () => {
    const columns = editedTable.columns
      .map((col) => {
        let sql = `  ${col.name} ${col.type}`;
        if (col.length && ['VARCHAR', 'CHAR'].includes(col.type)) {
          sql += `(${col.length})`;
        }
        if (!col.nullable) sql += ' NOT NULL';
        if (col.unique) sql += ' UNIQUE';
        if (col.autoIncrement) sql += ' AUTO_INCREMENT';
        if (col.defaultValue) sql += ` DEFAULT ${col.defaultValue}`;
        return sql;
      })
      .join(',\n');

    const primaryKeys = editedTable.columns
      .filter((col) => col.primaryKey)
      .map((col) => col.name);
    const primaryKeySQL =
      primaryKeys.length > 0
        ? `,\n  PRIMARY KEY (${primaryKeys.join(', ')})`
        : '';

    const foreignKeys = editedTable.columns
      .filter((col) => col.foreignKey)
      .map((col) => {
        const fk = col.foreignKey!;
        return `  FOREIGN KEY (${col.name}) REFERENCES ${fk.table}(${fk.column}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`;
      })
      .join(',\n');

    const foreignKeySQL = foreignKeys ? `,\n${foreignKeys}` : '';

    return `CREATE TABLE ${editedTable.name} (\n${columns}${primaryKeySQL}${foreignKeySQL}\n);`;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/30 text-sm">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-blue-500" />
          <span className="font-medium">{editedTable.name}</span>
          <Badge variant="outline" className="text-xs px-1.5 py-0">
            Table
          </Badge>
          <span className="text-xs text-muted-foreground">
            {editedTable.columns.length} cols
          </span>
        </div>
        <Button onClick={handleSave} size="sm" className="h-7 px-2 text-xs">
          <Save className="h-3 w-3 mr-1" />
          Save
        </Button>
      </div>

      {/* Compact Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="h-full flex flex-col"
      >
        <TabsList className="h-8 p-0 bg-muted/50">
          <TabsTrigger value="columns" className="text-xs h-7 px-3">
            Columns
          </TabsTrigger>
          <TabsTrigger value="indexes" className="text-xs h-7 px-3">
            Indexes
          </TabsTrigger>
          <TabsTrigger value="sql" className="text-xs h-7 px-3">
            SQL
          </TabsTrigger>
        </TabsList>

        <TabsContent value="columns" className="flex-1 p-0 m-0">
          {/* Compact Toolbar */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground">
              Column Definition
            </span>
            <Button
              onClick={addColumn}
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add
            </Button>
          </div>

          {/* Compact Table */}
          <ScrollArea className="flex-1">
            <Table className="text-xs">
              <TableHeader className="bg-muted/30">
                <TableRow className="h-8">
                  <TableHead className="h-8 px-2 text-xs font-medium">
                    Name
                  </TableHead>
                  <TableHead className="h-8 px-2 text-xs font-medium">
                    Type
                  </TableHead>
                  <TableHead className="h-8 px-2 text-xs font-medium w-16">
                    Len
                  </TableHead>
                  <TableHead className="h-8 px-2 text-xs font-medium w-12">
                    Null
                  </TableHead>
                  <TableHead className="h-8 px-2 text-xs font-medium w-12">
                    PK
                  </TableHead>
                  <TableHead className="h-8 px-2 text-xs font-medium w-12">
                    UQ
                  </TableHead>
                  <TableHead className="h-8 px-2 text-xs font-medium w-12">
                    AI
                  </TableHead>
                  <TableHead className="h-8 px-2 text-xs font-medium">
                    Default
                  </TableHead>
                  <TableHead className="h-8 px-2 text-xs font-medium">
                    FK
                  </TableHead>
                  <TableHead className="h-8 px-2 text-xs font-medium w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {editedTable.columns.map((column) => (
                  <TableRow key={column.id} className="h-8 hover:bg-muted/50">
                    <TableCell className="h-8 px-2 py-1">
                      <div className="flex items-center gap-1">
                        {column.primaryKey && (
                          <Key className="h-3 w-3 text-yellow-500" />
                        )}
                        <Input
                          value={column.name}
                          onChange={(e) =>
                            updateColumn(column.id, { name: e.target.value })
                          }
                          className="h-6 px-2 text-xs border-0 bg-transparent focus:bg-background focus:border"
                        />
                      </div>
                    </TableCell>
                    <TableCell className="h-8 px-2 py-1">
                      <Select
                        value={column.type}
                        onValueChange={(value) =>
                          updateColumn(column.id, { type: value })
                        }
                      >
                        <SelectTrigger className="h-6 px-2 text-xs border-0 bg-transparent focus:bg-background focus:border">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DATA_TYPES.map((type) => (
                            <SelectItem
                              key={type}
                              value={type}
                              className="text-xs"
                            >
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="h-8 px-2 py-1">
                      <Input
                        type="number"
                        value={column.length || ''}
                        onChange={(e) =>
                          updateColumn(column.id, {
                            length:
                              Number.parseInt(e.target.value) || undefined,
                          })
                        }
                        className="h-6 px-2 text-xs border-0 bg-transparent focus:bg-background focus:border"
                        disabled={
                          !['VARCHAR', 'CHAR', 'DECIMAL'].includes(column.type)
                        }
                      />
                    </TableCell>
                    <TableCell className="h-8 px-2 py-1 text-center">
                      <Checkbox
                        checked={column.nullable}
                        onCheckedChange={(checked) =>
                          updateColumn(column.id, { nullable: !!checked })
                        }
                        className="h-3 w-3"
                      />
                    </TableCell>
                    <TableCell className="h-8 px-2 py-1 text-center">
                      <Checkbox
                        checked={column.primaryKey}
                        onCheckedChange={(checked) =>
                          updateColumn(column.id, { primaryKey: !!checked })
                        }
                        className="h-3 w-3"
                      />
                    </TableCell>
                    <TableCell className="h-8 px-2 py-1 text-center">
                      <Checkbox
                        checked={column.unique}
                        onCheckedChange={(checked) =>
                          updateColumn(column.id, { unique: !!checked })
                        }
                        className="h-3 w-3"
                      />
                    </TableCell>
                    <TableCell className="h-8 px-2 py-1 text-center">
                      <Checkbox
                        checked={column.autoIncrement}
                        onCheckedChange={(checked) =>
                          updateColumn(column.id, { autoIncrement: !!checked })
                        }
                        disabled={!['INTEGER', 'BIGINT'].includes(column.type)}
                        className="h-3 w-3"
                      />
                    </TableCell>
                    <TableCell className="h-8 px-2 py-1">
                      <Input
                        value={column.defaultValue || ''}
                        onChange={(e) =>
                          updateColumn(column.id, {
                            defaultValue: e.target.value || undefined,
                          })
                        }
                        className="h-6 px-2 text-xs border-0 bg-transparent focus:bg-background focus:border"
                        placeholder="NULL"
                      />
                    </TableCell>
                    <TableCell className="h-8 px-2 py-1">
                      {column.foreignKey ? (
                        <Badge
                          variant="outline"
                          className="text-xs px-1 py-0 h-5"
                        >
                          <Link className="h-2.5 w-2.5 mr-1" />
                          {column.foreignKey.table}
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0"
                          onClick={() => {
                            updateColumn(column.id, {
                              foreignKey: {
                                table: 'person_type',
                                column: 'id',
                                onDelete: 'CASCADE',
                                onUpdate: 'CASCADE',
                              },
                            });
                          }}
                        >
                          <Link className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      )}
                    </TableCell>
                    <TableCell className="h-8 px-2 py-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 w-5 p-0"
                        onClick={() => removeColumn(column.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>

        <TabsContent value="indexes" className="flex-1 p-3 m-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Table Indexes
              </span>
              <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Add Index
              </Button>
            </div>
            <div className="space-y-1">
              {editedTable.indexes.map((index) => (
                <div
                  key={index.id}
                  className="flex items-center justify-between p-2 border rounded text-xs bg-muted/20"
                >
                  <div>
                    <div className="font-medium">{index.name}</div>
                    <div className="text-muted-foreground">
                      {index.columns.join(', ')} • {index.type}
                      {index.unique && ' • Unique'}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sql" className="flex-1 p-3 m-0">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              <span className="text-xs font-medium">
                Generated CREATE TABLE
              </span>
            </div>
            <Textarea
              value={generateSQL()}
              readOnly
              className="font-mono text-xs h-[calc(100vh-200px)] resize-none bg-muted/20 border-muted"
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
