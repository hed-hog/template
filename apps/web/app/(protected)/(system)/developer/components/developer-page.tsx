'use client';

import { useState } from 'react';
import { PanelGroup, Panel, PanelResizeHandle } from 'react-resizable-panels';
import { TreeView } from './tree-view';
import { EditorTabs } from './editor-tabs';
import { CodeEditor } from './code-editor';
import { TableEditor } from './table-editor';
import { BottomPanel } from './bottom-panel';
import { StatusBar } from './status-bar';
import {
  MOCK_SCREENS,
  MOCK_TABLES,
  MOCK_LOGS,
  MOCK_SYSTEM_STATUS,
} from './../data';
import type { FileTreeItem, Screen, DatabaseTable } from './../types';
import { useQuery } from '@tanstack/react-query';
import { useSystem } from '@/components/provider/system-provider';
import { IconReload } from '@tabler/icons-react';
import { useDeveloper } from './developer-provider';
import ScreenEditor from './screen-editor';

export default function DeveloperPage() {
  const { request, token } = useSystem();
  const {
    tabs,
    setTabs,
    handleCreateTab,
    handleTabClose,
    activeTabId,
    setActiveTabId,
  } = useDeveloper();

  const [bottomPanelOpen, setBottomPanelOpen] = useState(false);
  const [screens, setScreens] = useState(MOCK_SCREENS);
  const [tables, setTables] = useState(MOCK_TABLES);

  const { data: tree } = useQuery<FileTreeItem[]>({
    queryKey: ['developer-tree'],
    queryFn: () =>
      request({
        url: `/developer/tree`,
      }),
    enabled: token !== null,
  });

  const handleFileSelect = (file: FileTreeItem) => {
    // File selection logic handled in onCreateTab
  };

  const handleTableSave = (updatedTable: DatabaseTable) => {
    setTables((prev) =>
      prev.map((table) =>
        table.id === updatedTable.id ? updatedTable : table,
      ),
    );
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === updatedTable.id
          ? { ...tab, content: updatedTable, isDirty: false }
          : tab,
      ),
    );
  };

  const handleContentChange = (hasChanges: boolean) => {
    if (activeTabId) {
      setTabs((prev) =>
        prev.map((tab) =>
          tab.id === activeTabId ? { ...tab, isDirty: hasChanges } : tab,
        ),
      );
    }
  };

  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const renderEditor = () => {
    if (!activeTab) {
      return (
        <div className="h-full flex items-center justify-center text-muted-foreground">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">
              Welcome to HedHog Developer
            </h3>
            <p>Select a file from the explorer to start editing</p>
          </div>
        </div>
      );
    }

    switch (activeTab.type) {
      case 'screen':
        return <ScreenEditor activeTab={activeTab} />;
      case 'table':
        return (
          <TableEditor
            activeTab={activeTab}
            onSave={() => {}}
            onContentChange={handleContentChange}
          />
        );
      default:
        return (
          <div className="h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <h3 className="text-lg font-medium mb-2">
                Unsupported file type
              </h3>
              <p>This file type is not yet supported for editing</p>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      <PanelGroup direction="horizontal">
        {/* TreeView */}
        <Panel defaultSize={25} minSize={20} maxSize={40}>
          {tree && (
            <TreeView
              fileTree={tree}
              onFileSelect={handleFileSelect}
              onCreateTab={handleCreateTab}
            />
          )}
          {!tree && (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <IconReload className="animate-spin mb-2" size={16} />
              <p>Loading file tree...</p>
            </div>
          )}
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-accent active:bg-primary transition-colors" />

        {/* Main Content */}
        <Panel defaultSize={80}>
          <PanelGroup direction="vertical">
            {/* Editor Area */}
            <Panel defaultSize={bottomPanelOpen ? 70 : 100} minSize={30}>
              <div className="h-full flex flex-col">
                {/* Editor Tabs */}
                <EditorTabs
                  tabs={tabs}
                  activeTabId={activeTabId}
                  onTabSelect={(tabId) => {
                    if (typeof setActiveTabId === 'function') {
                      setActiveTabId(tabId);
                    }
                  }}
                  onTabClose={handleTabClose}
                />

                {/* Editor Content */}
                <div className="flex-1">{renderEditor()}</div>
              </div>
            </Panel>

            {/* Bottom Panel */}
            {bottomPanelOpen && (
              <>
                <PanelResizeHandle className="h-1 bg-border hover:bg-accent transition-colors" />
                <Panel defaultSize={30} minSize={20} maxSize={50}>
                  <BottomPanel
                    isOpen={bottomPanelOpen}
                    onToggle={() => setBottomPanelOpen(!bottomPanelOpen)}
                    logs={MOCK_LOGS}
                  />
                </Panel>
              </>
            )}
          </PanelGroup>
        </Panel>
      </PanelGroup>

      {/* Status Bar */}
      <StatusBar
        systemStatus={MOCK_SYSTEM_STATUS}
        onBottomPanelToggle={() => setBottomPanelOpen(!bottomPanelOpen)}
      />
    </div>
  );
}
