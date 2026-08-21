'use client';

import { ImpersonationBanner } from '@hed-hog/next-app-provider';
import { useTranslations } from 'next-intl';

/**
 * O banner mora no @hed-hog/next-app-provider (estilo inline, porque Tailwind
 * não é gerado para o pacote) e recebe os textos por prop — o pacote não tem
 * next-intl. Este wrapper só liga um ao outro.
 */
export function AppImpersonationBanner() {
  const t = useTranslations('core.AccessSimulation');

  return (
    <ImpersonationBanner
      labels={{
        viewingAs: t('bannerViewingAs'),
        operator: t('bannerOperator'),
        expiresIn: t('bannerExpiresIn'),
        stop: t('bannerStop'),
        stopping: t('bannerStopping'),
      }}
    />
  );
}
