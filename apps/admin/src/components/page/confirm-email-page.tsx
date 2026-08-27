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

  const token = searchParams.get('token') || '';
  // Link sem token ja nasce invalido: da para decidir na renderizacao, sem passar
  // pelo "checking" e sem um setState dentro do efeito.
  const [status, setStatus] = useState<Status>(token ? 'checking' : 'invalid');
  const [error, setError] = useState<string | null>(null);

  // O StrictMode monta o efeito duas vezes em dev; a confirmacao e idempotente,
  // mas nao ha motivo para bater duas vezes na API.
  const requestedRef = useRef(false);

  // `getErrorMessage` e recriado a cada render do AppProvider, entao mante-lo no
  // array de dependencias re-executava este efeito a qualquer re-render. Lido por
  // ref, ele sai das dependencias e o efeito so responde ao token.
  const getErrorMessageRef = useRef(getErrorMessage);
  useEffect(() => {
    getErrorMessageRef.current = getErrorMessage;
  }, [getErrorMessage]);

  useEffect(() => {
    if (!token) return;

    if (requestedRef.current) return;
    requestedRef.current = true;

    // Sem flag de cancelamento no cleanup de proposito: o guard acima impede uma
    // segunda requisicao, entao desligar os handlers desta na re-execucao do efeito
    // deixava a unica resposta em voo sem destino e a tela presa em "checking".
    request<ConfirmEmailResponse>({
      method: 'POST',
      url: '/auth/confirm-email',
      data: { token },
      showErrors: false,
    })
      .then(({ data }) => {
        setStatus(data.alreadyConfirmed ? 'alreadyConfirmed' : 'confirmed');
      })
      .catch((err) => {
        setError(getErrorMessageRef.current(err));
        setStatus('invalid');
      });
  }, [token, request]);

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
