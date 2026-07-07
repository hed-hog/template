'use client';

import { Button } from '@/components/ui/button';
import { useApp } from '@hed-hog/next-app-provider';
import { CheckCircle2, Loader2, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

function extractEmailFromJwt(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    return typeof payload.email === 'string' ? payload.email : '';
  } catch {
    return '';
  }
}

function DesktopAuth() {
  const { accessToken, request, setUrlAfterLogin } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const provider = searchParams.get('provider');
  const scheme = searchParams.get('scheme') ?? 'hedhog';
  const redirectedRef = useRef(false);
  const t = useTranslations('DesktopAuth');

  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userEmail = accessToken ? extractEmailFromJwt(accessToken) : '';

  useEffect(() => {
    if (redirectedRef.current) return;
    if (accessToken) return;

    redirectedRef.current = true;
    setUrlAfterLogin(`/auth/desktop?scheme=${encodeURIComponent(scheme)}`);

    if (provider) {
      window.location.href = `/api/oauth/${encodeURIComponent(provider)}/login`;
    } else {
      router.replace('/login');
    }
  }, [accessToken, provider, scheme, router, setUrlAfterLogin]);

  async function handleAuthorize() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await request<{ accessToken: string; refreshToken: string }>({
        url: '/auth/desktop-token',
      });
      const params = new URLSearchParams({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      });
      setAuthorized(true);
      window.location.href = `${scheme}://auth-callback?${params.toString()}`;
    } catch {
      setError(t('error'));
      setLoading(false);
    }
  }

  if (!accessToken) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-sm p-8 flex flex-col items-center gap-6">
        {authorized ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="size-7 text-green-500" strokeWidth={1.5} />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground">{t('successTitle')}</h1>
              <p className="text-sm text-muted-foreground mt-1.5">{t('successMessage')}</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Monitor className="size-7 text-primary" strokeWidth={1.5} />
            </div>

            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
              <p className="text-sm text-muted-foreground mt-1.5">{t('subtitle')}</p>
              {userEmail && (
                <p className="text-xs text-muted-foreground mt-1 bg-muted rounded-full px-3 py-1 inline-block">
                  {userEmail}
                </p>
              )}
            </div>

            {error && (
              <p className="text-xs text-destructive text-center">{error}</p>
            )}

            <div className="flex flex-col gap-2 w-full">
              <Button className="w-full gap-2" onClick={handleAuthorize} disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {t('authorize')}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => router.replace('/')}
                disabled={loading}
              >
                {t('cancel')}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function DesktopAuthPage() {
  return (
    <Suspense fallback={null}>
      <DesktopAuth />
    </Suspense>
  );
}
