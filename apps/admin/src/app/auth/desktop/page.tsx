'use client';

import { useApp } from '@hed-hog/next-app-provider';
import { Loader2, Monitor } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AppConnectConsent } from '../_components/app-connect-consent';

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
    <AppConnectConsent
      appName={t('appName')}
      appLogoUrl="/app-logos/hedhog-desktop.png"
      appIcon={Monitor}
      title={t('title')}
      subtitle={t('subtitle')}
      connectingAsLabel={t('connectingAs')}
      authorizeLabel={t('authorize')}
      cancelLabel={t('cancel')}
      successTitle={t('successTitle')}
      successMessage={t('successMessage')}
      authorized={authorized}
      loading={loading}
      error={error}
      onAuthorize={handleAuthorize}
      onCancel={() => router.replace('/')}
    />
  );
}

export default function DesktopAuthPage() {
  return (
    <Suspense fallback={null}>
      <DesktopAuth />
    </Suspense>
  );
}
