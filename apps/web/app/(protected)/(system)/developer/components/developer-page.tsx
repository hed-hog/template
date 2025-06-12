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
import type { Tab, FileTreeItem, Screen, DatabaseTable } from './../types';
import { useQuery } from '@tanstack/react-query';
import { useSystem } from '@/components/provider/system-provider';
import { IconReload } from '@tabler/icons-react';

export default function DeveloperPage() {
  const { request, token } = useSystem();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
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

  const handleCreateTab = (tab: Tab) => {
    const existingTab = tabs.find((t) => t.id === tab.id);
    if (!existingTab) {
      setTabs((prev) => [...prev, tab]);
    }
    setActiveTabId(tab.id);
  };

  const handleTabClose = (tabId: string) => {
    setTabs((prev) => prev.filter((tab) => tab.id !== tabId));
    if (activeTabId === tabId) {
      const remainingTabs = tabs.filter((tab) => tab.id !== tabId);
      setActiveTabId(
        remainingTabs.length > 0
          ? remainingTabs[remainingTabs.length - 1].id
          : null,
      );
    }
  };

  const handleScreenSave = (updatedScreen: Screen) => {
    setScreens((prev) =>
      prev.map((screen) =>
        screen.id === updatedScreen.id ? updatedScreen : screen,
      ),
    );
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === updatedScreen.id
          ? { ...tab, content: updatedScreen, isDirty: false }
          : tab,
      ),
    );
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
        return (
          <CodeEditor
            screen={activeTab.content}
            onSave={handleScreenSave}
            onContentChange={(content) => handleContentChange(true)}
          />
        );
      case 'table':
        return (
          <TableEditor
            table={activeTab.content}
            onSave={handleTableSave}
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
        <Panel defaultSize={20} minSize={15} maxSize={40}>
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

        <PanelResizeHandle className="w-1 bg-border hover:bg-accent transition-colors" />

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
                  onTabSelect={setActiveTabId}
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
