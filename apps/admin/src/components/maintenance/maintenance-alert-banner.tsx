'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useApp } from '@hed-hog/next-app-provider';
import { Wrench } from 'lucide-react';

export function MaintenanceAlertBanner() {
  const { getSettingValue, currentLocaleCode } = useApp();

  const isMaintenanceMode =
    getSettingValue('maintenance-mode-enabled') === true;
  if (!isMaintenanceMode) {
    return null;
  }

  const isPt = currentLocaleCode.startsWith('pt');

  return (
    <div className="px-4 py-3 md:px-6">
      <Alert className="border-amber-300/70 bg-amber-50/90 text-amber-950 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
        <Wrench className="h-4 w-4" />
        <AlertTitle>
          {isPt ? 'Sistema em manutenção' : 'System under maintenance'}
        </AlertTitle>
        <AlertDescription className="text-amber-900/80 dark:text-amber-200/90">
          {isPt
            ? 'Alguns recursos podem ficar instáveis enquanto concluímos a manutenção.'
            : 'Some features may be unstable while maintenance is in progress.'}
        </AlertDescription>
      </Alert>
    </div>
  );
}
