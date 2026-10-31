'use client';

import { Input } from '@/components/ui/input';
import { useApp } from '@hed-hog/next-app-provider';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Field } from './report-bug-sheet';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Vazio é válido (sem aviso); preenchido, precisa ser um e-mail. */
export function isInvalidNotifyEmail(value: string) {
  const email = value.trim();
  return Boolean(email) && !EMAIL.test(email);
}

/**
 * E-mail que a Fábrica avisa quando o pedido é aceito, entregue ou cancelado.
 * Já nasce com o e-mail de quem está logado; apagar o campo é não querer aviso.
 */
export function useNotifyEmail() {
  const { userEmail } = useApp();
  return useState(() => userEmail ?? '');
}

export function NotifyEmailField({
  value,
  onChange,
  showError,
}: {
  value: string;
  onChange: (value: string) => void;
  showError: boolean;
}) {
  const t = useTranslations('core.Support');
  const invalid = showError && isInvalidNotifyEmail(value);
  return (
    <Field
      label={t('notifyEmail')}
      optional={t('optional')}
      error={invalid ? t('errNotifyEmail') : null}
    >
      <Input
        type="email"
        inputMode="email"
        autoComplete="email"
        maxLength={254}
        placeholder={t('notifyEmailPlaceholder')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
      />
      <p className="text-xs text-muted-foreground">{t('notifyEmailHint')}</p>
    </Field>
  );
}
