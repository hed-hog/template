import { useEffect } from 'react';

import { useApp } from '@hed-hog/next-app-provider';

export function useDocumentTitle(entityName: string | undefined) {
  const { getSettingValue } = useApp();
  const systemName = getSettingValue('system-name') || 'HedHog Admin';

  useEffect(() => {
    if (!entityName) return;
    document.title = `${entityName} | ${systemName}`;
    return () => {
      document.title = systemName;
    };
  }, [entityName, systemName]);
}
