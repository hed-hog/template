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
import { getHubForwardUrl } from '../../_shared/oauth-hub';

function CallbackOAuthLogin() {
  /* v8 ignore next -- unreachable: Page() only renders CallbackOAuthLogin when providerName (same source) is already truthy, so the ?? '' fallback here is never exercised */
  const providerName = String(useParams().provider ?? '');
  const normalizedProviderName = normalizeOAuthProviderName(providerName);
  const router = useRouter();
  const translationKey = normalizedProviderName || 'github';
  const t = useTranslations(`core.OAuthCallback.${translationKey}`);
  const providerTheme = getOAuthProviderTheme(normalizedProviderName);
  const searchParams = useSearchParams();
  const code = searchParams.get('code') ?? '';
  const state = searchParams.get('state') ?? '';
  const [error, setError] = useState('');
  const processedCodeRef = useRef<string | null>(null);
  const { request, setAccessToken, getUrlAfterLogin, getSettingValue } = useApp();

  useEffect(() => {
    /* v8 ignore next 3 -- unreachable: Page() wrapper already returns null when !providerName */
    if (!providerName) {
      router.replace('/');
    }
  }, [providerName, router]);

  useEffect(() => {
    async function createOAuthLogin() {
      try {
        // Hub forwarding: if this callback belongs to another app, hand the code
        // off to that app and let it complete the login (do not consume it here).
        if (typeof window !== 'undefined') {
          const forwardUrl = getHubForwardUrl({
            appUrls: getSettingValue('app-urls'),
            state,
            provider: normalizedProviderName,
            flow: 'login',
            code,
            currentOrigin: window.location.origin,
          });
          if (forwardUrl) {
            window.location.replace(forwardUrl);
            return;
          }
        }

        if (typeof window !== 'undefined') {
          window.history.replaceState({}, '', window.location.pathname);
        }

        if (hasProcessedOAuthCallback(normalizedProviderName, 'login', code)) {
          setError(t('alreadyProcessed'));
          return;
        }

        markOAuthCallbackAsProcessed(normalizedProviderName, 'login', code);

        const { data } = await request<{ accessToken?: string }>({
          url: `/oauth/${normalizedProviderName}/callback/login?code=${code}`,
        });

        if (data.accessToken) {
          setAccessToken(data.accessToken);
          toast.success(t('loginSuccess'));
          const afterUrl = getUrlAfterLogin();
          router.push(afterUrl && !afterUrl.startsWith('/login') ? afterUrl : '/');
        }
      } catch (error: unknown) {
        setError(getOAuthCallbackErrorMessage(error, t('alreadyProcessed'), t('errorOccurred')));
      }
    }

    if (code && processedCodeRef.current !== code) {
      processedCodeRef.current = code;
      void createOAuthLogin();
    }
  }, [
    code,
    state,
    request,
    normalizedProviderName,
    setAccessToken,
    router,
    getUrlAfterLogin,
    getSettingValue,
    t,
  ]);

  /* v8 ignore next 3 -- unreachable: Page() wrapper already returns null when !providerName */
  if (!providerName) {
    return null;
  }

  const handleRetry = () => {
    router.push('/login');
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
                    {t('loginTitle')}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {t('loginDescription')}
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
              {/* v8 ignore next 5 -- unreachable: error is always truthy here since !error was false */}
              </>
            ) : (
              null
            )}
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
      <CallbackOAuthLogin />
    </Suspense>
  );
}
