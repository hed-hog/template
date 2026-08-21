'use client';

import { Button } from '@/components/ui/button';
import { useApp } from '@hed-hog/next-app-provider';
import { VenetianMask } from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * O usuário simulado não tem papel `admin*`, então o painel não tem nada a
 * mostrar para ele. Sem esta tela o operador cairia no `ForbiddenPage` genérico,
 * cujo único botão é "ir para o login" — que numa aba simulada não faz sentido.
 */
export function ImpersonationNoAccessPage() {
  const t = useTranslations('core.AccessSimulation');
  const { impersonation, stopImpersonation } = useApp();

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-muted/40 p-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <VenetianMask className="h-6 w-6" />
        </div>
        <h1 className="text-xl font-semibold">{t('noAdminAccessTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t('noAdminAccessDescription', {
            name: impersonation?.target?.name ?? '',
          })}
        </p>
        <Button onClick={() => stopImpersonation()} className="mt-6">
          {t('bannerStop')}
        </Button>
      </div>
    </div>
  );
}
