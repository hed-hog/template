'use client';

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Database,
  Monitor,
  Menu,
  Settings,
  FileText,
  Table,
  LayoutGrid,
  FileCode,
  Cog,
  Type,
} from 'lucide-react';

import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

import type { FileTreeItem, Tab } from '../types';
import { IconPackage } from '@tabler/icons-react';

interface TreeViewProps {
  fileTree: FileTreeItem[];
  onFileSelect: (file: FileTreeItem) => void;
  onCreateTab: (tab: Tab) => void;
}

export function TreeView({
  fileTree,
  onFileSelect,
  onCreateTab,
}: TreeViewProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(),
  );

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const getItemIcon = (item: FileTreeItem) => {
    switch (item.type) {
      case 'folder':
        if (item.name === 'Tables')
          return <Database className="h-4 w-4" style={{ color: item.color }} />;
        if (item.name === 'Screens')
          return <Monitor className="h-4 w-4" style={{ color: item.color }} />;
        if (item.name === 'Menus')
          return <Menu className="h-4 w-4" style={{ color: item.color }} />;
        if (item.name === 'Settings')
          return <Settings className="h-4 w-4" style={{ color: item.color }} />;
        return <FileText className="h-4 w-4" />;
      case 'table':
        return <Table className="h-4 w-4 text-blue-500" />;
      case 'screen':
        return <LayoutGrid className="h-4 w-4 text-emerald-500" />;
      case 'setting':
        return <Cog className="h-4 w-4 text-violet-500" />;
      case 'library':
        return <IconPackage className="h-4 w-4 text-orange-500" />;
      case 'file':
      default:
        return <FileCode className="h-4 w-4 text-gray-500" />;
    }
  };

  const renderTreeItems = (items: FileTreeItem[], level = 0) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.id);
      const hasChildren = item.children && item.children.length > 0;

      return (
        <div key={item.id}>
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 text-sm cursor-pointer hover:bg-accent rounded-sm',
              level > 0 && 'ml-4',
            )}
            onClick={() => {
              if (hasChildren) {
                toggleFolder(item.id);
              } else {
                onFileSelect(item);
                if (item.type === 'table' || item.type === 'screen') {
                  onCreateTab({
                    id: item.id,
                    title: item.name,
                    type: item.type,
                    content: item.screen,
                    filePath: item.path,
                    icon: getItemIcon(item),
                    library: item.library,
                  });
                }
              }
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )
            ) : (
              <div className="w-3.5" />
            )}
            {getItemIcon(item)}
            <span className="flex-1 ml-1">{item.name}</span>
          </div>
          {hasChildren && isExpanded && (
            <div>{renderTreeItems(item.children!, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 text-sm font-medium">RESOURCES</div>
      <ScrollArea className="flex-1 px-1">
        {renderTreeItems(fileTree)}
      </ScrollArea>
    </div>
  );
}
