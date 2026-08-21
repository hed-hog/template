'use client';

import { normalizeIntegrationProvider } from '@/components/ui/integration-logo';
import { useApp } from '@hed-hog/next-app-provider';
import { Loader2 } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef } from 'react';

function DesktopOAuth() {
  const { accessToken, setUrlAfterLogin } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const provider = searchParams.get('provider') ?? '';
  const scheme = searchParams.get('scheme') ?? 'hedhog';
  const redirectedRef = useRef(false);

  useEffect(() => {
    if (redirectedRef.current) return;

    const afterLoginUrl = `/auth/desktop?scheme=${encodeURIComponent(scheme)}`;

    if (accessToken) {
      redirectedRef.current = true;
      router.replace(afterLoginUrl);
      return;
    }

    redirectedRef.current = true;
    setUrlAfterLogin(afterLoginUrl);

    if (provider) {
      const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
      window.location.href = `${apiBase}/oauth/${normalizeIntegrationProvider(provider)}/login`;
    } else {
      router.replace('/login');
    }
  }, [accessToken, provider, scheme, router, setUrlAfterLogin]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function DesktopOAuthPage() {
  return (
    <Suspense fallback={null}>
      <DesktopOAuth />
    </Suspense>
  );
}
