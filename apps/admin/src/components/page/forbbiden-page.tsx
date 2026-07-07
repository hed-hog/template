import { Button } from '@/components/ui/button';
import { useApp } from '@hed-hog/next-app-provider';
import { useTranslations } from 'next-intl';
import React from 'react';

export const ForbiddenPage: React.FC = () => {
  const t = useTranslations('core.ForbiddenPage');
  const { logout } = useApp();

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-100">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-primary">403</h1>
        <p className="mt-4 text-xl text-gray-700">{t('message')}</p>
        <Button onClick={() => logout()} className="mt-6">
          {t('goToLogin')}
        </Button>
      </div>
    </div>
  );
};
