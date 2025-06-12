'use client';

import { useState } from 'react';
import {
  Files,
  Search,
  GitBranch,
  Settings,
  Terminal,
  Database,
  ChevronRight,
  ChevronDown,
  FileText,
  Folder,
  FolderOpen,
  Circle,
  AlertCircle,
  CheckCircle,
  XCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

import type { FileTreeItem, SystemStatus, Tab } from '../types';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  fileTree: FileTreeItem[];
  onFileSelect: (file: FileTreeItem) => void;
  systemStatus: SystemStatus;
  onCreateTab: (tab: Tab) => void;
}

export function Sidebar({
  activeTab,
  onTabChange,
  fileTree,
  onFileSelect,
  systemStatus,
  onCreateTab,
}: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set(['app']),
  );

  const sidebarTabs = [
    { id: 'explorer', icon: Files, label: 'Explorer' },
    { id: 'search', icon: Search, label: 'Search' },
    { id: 'git', icon: GitBranch, label: 'Source Control' },
    { id: 'database', icon: Database, label: 'Database' },
    { id: 'terminal', icon: Terminal, label: 'Terminal' },
    { id: 'settings', icon: Settings, label: 'Settings' },
  ];

  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId);
    } else {
      newExpanded.add(folderId);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFileTree = (items: FileTreeItem[], level = 0) => {
    return items.map((item) => {
      const isExpanded = expandedFolders.has(item.id);
      const hasChildren = item.children && item.children.length > 0;

      return (
        <div key={item.id}>
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 text-sm cursor-pointer hover:bg-accent rounded-sm',
              level > 0 && 'ml-4',
            )}
            onClick={() => {
              if (item.type === 'folder') {
                toggleFolder(item.id);
              } else if (item.screen) {
                onFileSelect(item);
                onCreateTab({
                  id: item.screen.id,
                  title: item.screen.title,
                  type: 'screen',
                  content: item.screen,
                  filePath: item.path,
                });
              }
            }}
          >
            {item.type === 'folder' ? (
              <>
                {hasChildren &&
                  (isExpanded ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronRight className="h-3 w-3" />
                  ))}
                {isExpanded ? (
                  <FolderOpen className="h-4 w-4 text-blue-500" />
                ) : (
                  <Folder className="h-4 w-4 text-blue-500" />
                )}
              </>
            ) : (
              <>
                <div className="w-3" />
                <FileText className="h-4 w-4 text-gray-500" />
              </>
            )}
            <span className="flex-1">{item.name}</span>
            {item.screen && (
              <Circle
                className={cn(
                  'h-2 w-2 fill-current',
                  item.screen.isPublished
                    ? 'text-green-500'
                    : 'text-yellow-500',
                )}
              />
            )}
          </div>
          {item.type === 'folder' && isExpanded && item.children && (
            <div>{renderFileTree(item.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
      case 'online':
      case 'running':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'error':
      case 'offline':
      case 'stopped':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <AlertCircle className="h-3 w-3 text-yellow-500" />;
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'explorer':
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">HEDGEHOG</h3>
              </div>
              <Input
                placeholder="Search files..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-8"
              />
            </div>
            <ScrollArea className="h-[400px]">
              {renderFileTree(fileTree)}
            </ScrollArea>
          </div>
        );

      case 'database':
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">DATABASE STATUS</h3>
            <div className="space-y-2">
              <div className="flex items-center justify-between p-2 bg-accent rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus.database)}
                  <span className="text-sm">PostgreSQL</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {systemStatus.database}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-accent rounded">
                <div className="flex items-center gap-2">
                  {getStatusIcon(systemStatus.api)}
                  <span className="text-sm">NestJS API</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {systemStatus.api}
                </Badge>
              </div>
              <div className="flex items-center justify-between p-2 bg-accent rounded">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-3 w-3 text-yellow-500" />
                  <span className="text-sm">Migrations</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {systemStatus.migrations} pending
                </Badge>
              </div>
            </div>
          </div>
        );

      case 'search':
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">SEARCH</h3>
            <Input placeholder="Search in files..." className="h-8" />
            <div className="text-sm text-muted-foreground">
              No results found
            </div>
          </div>
        );

      case 'git':
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">SOURCE CONTROL</h3>
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full justify-start"
              >
                <GitBranch className="h-4 w-4 mr-2" />
                main
              </Button>
              <div className="text-sm text-muted-foreground">No changes</div>
            </div>
          </div>
        );

      case 'terminal':
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">TERMINAL</h3>
            <div className="bg-black text-green-400 p-2 rounded text-xs font-mono">
              <div>$ npm run dev</div>
              <div>✓ Ready on http://localhost:3000</div>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div className="space-y-4">
            <h3 className="text-sm font-medium">SETTINGS</h3>
            <div className="space-y-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
              >
                User Settings
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
              >
                Workspace Settings
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex h-full">
      {/* Tab Icons */}
      <div className="w-12 bg-accent border-r flex flex-col items-center py-2 space-y-1">
        {sidebarTabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'ghost'}
            size="sm"
            className="w-8 h-8 p-0"
            onClick={() => onTabChange(tab.id)}
            title={tab.label}
          >
            <tab.icon className="h-4 w-4" />
          </Button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 p-3 min-w-0">{renderTabContent()}</div>
    </div>
  );
}
