'use client';

import { createContext, useContext } from 'react';

type DeveloperContextType = {
  nodeVersion: string;
  nextVersion: string;
  branchName: string;
  databaseType: string;
  databaseStatus: boolean;
};

const DeveloperContext = createContext<DeveloperContextType>({
  nodeVersion: '',
  nextVersion: '',
  branchName: '',
  databaseType: '',
  databaseStatus: false,
});

type DeveloperProviderProps = {
  children: React.ReactNode;
  nodeVersion: string;
  nextVersion: string;
  branchName: string;
  databaseType: string;
  databaseStatus: boolean;
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
  return (
    <DeveloperContext.Provider
      value={{
        nodeVersion,
        nextVersion,
        branchName,
        databaseType,
        databaseStatus,
      }}
    >
      {children}
    </DeveloperContext.Provider>
  );
};
