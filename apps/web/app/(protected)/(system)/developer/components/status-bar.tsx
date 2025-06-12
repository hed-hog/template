'use client';

import { useState } from 'react';
import { Database, GitBranch, RefreshCw, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SystemStatus } from '../types';
import { useDeveloper } from './developer-provider';

interface StatusBarProps {
  systemStatus: SystemStatus;
  onBottomPanelToggle: () => void;
}

export function StatusBar({
  systemStatus,
  onBottomPanelToggle,
}: StatusBarProps) {
  const { nodeVersion, nextVersion, branchName, databaseType, databaseStatus } =
    useDeveloper();

  const [isRunningMigrations, setIsRunningMigrations] = useState(false);
  const [migrationsCompleted, setMigrationsCompleted] = useState(false);

  const getStatusColor = (status: boolean) => {
    if (typeof status !== 'boolean') {
      return 'text-gray-600';
    } else if (status) {
      return 'text-green-600';
    } else {
      return 'text-red-600';
    }
  };

  const handleRunMigrations = async () => {
    setIsRunningMigrations(true);

    // Simular execução de migrations
    await new Promise((resolve) => setTimeout(resolve, 3000));

    setIsRunningMigrations(false);
    setMigrationsCompleted(true);

    // Reset status após 3 segundos
    setTimeout(() => {
      setMigrationsCompleted(false);
    }, 3000);
  };

  const renderMigrationStatus = () => {
    if (migrationsCompleted) {
      return (
        <div className="flex items-center gap-1 text-green-500">
          <CheckCircle className="h-3.5 w-3.5" />
          <span>Migrations completed</span>
        </div>
      );
    }

    if (systemStatus.migrations > 0) {
      return (
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            'h-5 px-1.5 text-xs text-yellow-500 hover:text-yellow-400 hover:bg-yellow-500/10',
            isRunningMigrations && 'cursor-not-allowed',
          )}
          onClick={handleRunMigrations}
          disabled={isRunningMigrations}
        >
          {isRunningMigrations ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 mr-1 animate-spin" />
              Running migrations...
            </>
          ) : (
            <>{systemStatus.migrations} migrations pending</>
          )}
        </Button>
      );
    }

    return null;
  };

  return (
    <div className="h-6 bg-accent text-xs flex items-center px-2 border-t">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <GitBranch className="h-3.5 w-3.5" />
          <span>{branchName}</span>
        </div>

        <div
          className={cn(
            'flex items-center gap-1',
            getStatusColor(databaseStatus),
          )}
        >
          <Database className="h-3.5 w-3.5" />
          <span>{databaseType}</span>
        </div>

        {renderMigrationStatus()}
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div>Node v{nodeVersion}</div>
        <div>Next.js {nextVersion}</div>
      </div>
    </div>
  );
}
