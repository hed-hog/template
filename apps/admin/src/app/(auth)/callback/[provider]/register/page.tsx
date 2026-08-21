'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useApp } from '@hed-hog/next-app-provider';
import { useTranslations } from 'next-intl';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  getOAuthProviderTheme,
  normalizeOAuthProviderName,
} from '../../_shared/provider-theme';
import {
  getOAuthCallbackErrorMessage,
  hasProcessedOAuthCallback,
  markOAuthCallbackAsProcessed,
} from '../../_shared/oauth-callback-guard';

function CallbackOAuthRegister() {
  const providerName = String(useParams().provider ?? '');
  const normalizedProviderName = normalizeOAuthProviderName(providerName);
  const router = useRouter();
  const translationKey = normalizedProviderName || 'github';
  const t = useTranslations(`core.OAuthCallback.${translationKey}`);
  const providerTheme = getOAuthProviderTheme(normalizedProviderName);
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? '';
  // Microsoft Entra ID exchanges its large code server-side and forwards only a
  // short single-use `ref`; other providers still forward the raw `code`.
  const ref = searchParams.get('ref') ?? '';
  const [error, setError] = useState('');
  const processedKeyRef = useRef<string | null>(null);
  const { request, setAccessToken, getUrlAfterLogin } = useApp();

  useEffect(() => {
    if (!providerName) {
      router.replace('/');
    }
  }, [providerName, router]);

  useEffect(() => {
    async function createOAuthRegister() {
      try {
        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', window.location.pathname);
        }

        const processedKey = ref || code;
        if (hasProcessedOAuthCallback(normalizedProviderName, 'register', processedKey)) {
          setError(t('alreadyProcessed'));
          return;
        }

        markOAuthCallbackAsProcessed(normalizedProviderName, 'register', processedKey);

        const { data } = await request<{ accessToken?: string }>({
          url: ref
            ? `/oauth/${normalizedProviderName}/redeem?ref=${encodeURIComponent(ref)}`
            : `/oauth/${normalizedProviderName}/callback/register?code=${code}`,
        });

        if (data.accessToken) {
          setAccessToken(data.accessToken);
          toast.success(t('registerSuccess'));
          router.push(getUrlAfterLogin());
        }
      } catch (error: unknown) {
        setError(getOAuthCallbackErrorMessage(error, t('alreadyProcessed'), t('errorOccurred')));
      }
    }

    const key = ref || code;
    if (key && processedKeyRef.current !== key) {
      processedKeyRef.current = key;
      void createOAuthRegister();
    }
  }, [
    code,
    ref,
    request,
    normalizedProviderName,
    setAccessToken,
    router,
    getUrlAfterLogin,
    t,
  ]);

  if (!providerName) {
    return null;
  }

  const handleRetry = () => {
    router.push('/register');
  };

  return (
    <main className="w-full overflow-y-auto scrollbar-hide bg-white">
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className={`w-full max-w-md ${providerTheme.cardClassName}`}>
          <CardContent className="flex flex-col items-center justify-center p-8 space-y-6">
            <div
              className={`w-12 h-12 rounded-full shadow-md flex items-center justify-center ${providerTheme.iconContainerClassName}`}
            >
              {providerTheme.icon}
            </div>

            {!error ? (
              <>
                <div
                  className={`w-8 h-8 border-4 border-muted rounded-full animate-spin ${providerTheme.spinnerTopClassName}`}
                />

                <div className="text-center space-y-2">
                  <h2
                    className={`text-xl font-semibold ${providerTheme.titleClassName}`}
                  >
                    {t('registerTitle')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('registerDescription')}
                  </p>
                </div>

                <div className="flex space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse ${providerTheme.dotClassName}`}
                  />
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse delay-75 ${providerTheme.dotClassName}`}
                  />
                  <div
                    className={`w-2 h-2 rounded-full animate-pulse delay-150 ${providerTheme.dotClassName}`}
                  />
                </div>
              </>
            ) : error ? (
              <>
                <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-red-600"
                  >
                    <path
                      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <div className="text-center space-y-2">
                  <h2
                    className={`text-xl font-semibold ${providerTheme.titleClassName}`}
                  >
                    {t('errorTitle')}
                  </h2>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>

                <Button
                  onClick={handleRetry}
                  className={`w-full ${providerTheme.buttonClassName}`}
                >
                  {t('buttonRetry')}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function Page() {
  const providerName = String(useParams().provider ?? '');
  const translationKey = normalizeOAuthProviderName(providerName) || 'github';
  const t = useTranslations(`core.OAuthCallback.${translationKey}`);

  if (!providerName) {
    return null;
  }
  return (
    <Suspense fallback={<p>{t('loading')}</p>}>
      <CallbackOAuthRegister />
    </Suspense>
  );
}
