'use client';
import { Button } from '@/components/ui/button';
import { useApp } from '@hed-hog/next-app-provider';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LanguageSelector } from '../language-selector';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type Status = 'checking' | 'confirmed' | 'alreadyConfirmed' | 'invalid';

type ConfirmEmailResponse = {
  confirmed: boolean;
  alreadyConfirmed: boolean;
  email: string;
  name: string | null;
};

/**
 * Destino do link de confirmacao de e-mail enviado no cadastro. Nao autentica
 * ninguem: o backend so marca o identificador como verificado, e repetir o
 * clique cai no caminho "ja confirmado" em vez de erro.
 */
export function ConfirmEmailPage() {
  const { request, getErrorMessage } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('core.ConfirmEmailPage');
  const [status, setStatus] = useState<Status>('checking');
  const [error, setError] = useState<string | null>(null);

  const token = searchParams.get('token') || '';
  // O StrictMode monta o efeito duas vezes em dev; a confirmacao e idempotente,
  // mas nao ha motivo para bater duas vezes na API.
  const requestedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    if (requestedRef.current) return;
    requestedRef.current = true;

    let active = true;

    request<ConfirmEmailResponse>({
      method: 'POST',
      url: '/auth/confirm-email',
      data: { token },
      showErrors: false,
    })
      .then(({ data }) => {
        if (!active) return;
        setStatus(data.alreadyConfirmed ? 'alreadyConfirmed' : 'confirmed');
      })
      .catch((err) => {
        if (!active) return;
        setError(getErrorMessage(err));
        setStatus('invalid');
      });

    return () => {
      active = false;
    };
  }, [token, request, getErrorMessage]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background transition-colors">
      <div className="w-full max-w-sm p-8 rounded-lg shadow-lg bg-card">
        <h2 className="text-2xl font-bold mb-6 text-center">{t('title')}</h2>
        <div className="mb-6 flex justify-center">
          <LanguageSelector />
        </div>

        {status === 'checking' && (
          <p className="text-center text-sm text-muted-foreground">
            {t('checking')}
          </p>
        )}

        {status === 'invalid' && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>{t('invalidTitle')}</AlertTitle>
            <AlertDescription>{error || t('invalidDescription')}</AlertDescription>
          </Alert>
        )}

        {(status === 'confirmed' || status === 'alreadyConfirmed') && (
          <Alert className="mb-6">
            <AlertTitle>{t('successTitle')}</AlertTitle>
            <AlertDescription>
              {status === 'alreadyConfirmed'
                ? t('alreadyConfirmedDescription')
                : t('successDescription')}
            </AlertDescription>
          </Alert>
        )}

        {status !== 'checking' && (
          <Button className="w-full" onClick={() => router.replace('/login')}>
            {t('goToLogin')}
          </Button>
        )}
      </div>
    </div>
  );
}
