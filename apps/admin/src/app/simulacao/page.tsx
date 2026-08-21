'use client';

import { ImpersonationRedeem } from '@hed-hog/next-app-provider';
import { useTranslations } from 'next-intl';

/**
 * Resgate da simulação de acesso.
 *
 * Fica FORA do grupo de rotas `(app)` de propósito: o `GuardPage` daquele layout
 * exige papel `admin*`, e quem chega aqui ainda não tem sessão nenhuma. O
 * `layout.tsx` raiz já envolve tudo no `AppProvider`, então o provider está
 * disponível sem o guard.
 */
export default function ImpersonationRedeemPage() {
  const t = useTranslations('core.AccessSimulation');

  return (
    <ImpersonationRedeem
      labels={{
        loading: t('redeemLoading'),
        invalidTitle: t('redeemInvalidTitle'),
        invalidDescription: t('redeemInvalidDescription'),
        missingCode: t('redeemMissingCode'),
      }}
    />
  );
}
