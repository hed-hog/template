'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Tab } from '../types';

type DeveloperContextType = {
  nodeVersion: string;
  nextVersion: string;
  branchName: string;
  databaseType: string;
  databaseStatus: boolean;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  handleCreateTab: (tab: Tab) => void;
  handleTabClose: (tabId: string) => void;
  activeTabId?: string | null;
  setActiveTabId?: (tabId: string) => void;
};

const DeveloperContext = createContext<DeveloperContextType>({
  nodeVersion: '',
  nextVersion: '',
  branchName: '',
  databaseType: '',
  databaseStatus: false,
  tabs: [],
  setTabs: () => {},
  handleCreateTab: (tab: Tab) => {},
  handleTabClose: () => {},
  activeTabId: null,
  setActiveTabId: () => {},
});

type DeveloperProviderProps = {
  children: React.ReactNode;
  nodeVersion: string;
  nextVersion: string;
  branchName: string;
  databaseType: string;
  databaseStatus: boolean;
  handleCreateTab?: (tab: Tab) => void;
  handleTabClose?: (tabId: string) => void;
};

export const useDeveloper = () => {
  const context = useContext(DeveloperContext);
  if (!context) {
    throw new Error('useDeveloper must be used within a DeveloperProvider');
  }
  return context;
};

export const DeveloperProvider = ({
  children,
  nodeVersion,
  nextVersion,
  branchName,
  databaseType,
  databaseStatus,
}: DeveloperProviderProps) => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const handleCreateTab = (tab: Tab) => {
    console.log('Creating tab:', tab);

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

  useEffect(() => {
    console.log('Active tab changed:', activeTabId);
  }, [activeTabId]);

  return (
    <DeveloperContext.Provider
      value={{
        nodeVersion,
        nextVersion,
        branchName,
        databaseType,
        databaseStatus,
        tabs,
        setTabs,
        handleCreateTab,
        handleTabClose,
        activeTabId,
        setActiveTabId,
      }}
    >
      {children}
    </DeveloperContext.Provider>
  );
};
