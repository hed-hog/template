'use client';

import { useApp } from '@hed-hog/next-app-provider';
import { useParams } from 'next/navigation';
import { useEffect } from 'react';
import { normalizeOAuthProviderName } from '../_shared/provider-theme';
import { parseHubState, resolveAppOrigin } from '../_shared/oauth-hub';

/**
 * Single OAuth callback per provider. Providers are configured with just
 * `${admin}/callback/<provider>`; the flow (login/register/connect) and the
 * initiating app travel in the signed `state`. This dispatcher reads the state
 * and forwards the browser to the correct app + flow page:
 *   ${appOrigin}/callback/<provider>/<flow>
 * When the state points to this hub (app "self") or an unknown app, it forwards
 * to the local flow page.
 */
export default function OAuthCallbackDispatcher() {
  const provider = normalizeOAuthProviderName(String(useParams().provider ?? ''));
  const { getSettingValue } = useApp();

  useEffect(() => {
    if (typeof window === 'undefined' || !provider) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const parsed = parseHubState(params.get('state'));
    const flow = parsed?.flow ?? 'login';

    let targetOrigin = window.location.origin;
    if (parsed) {
      const resolved = resolveAppOrigin(getSettingValue('app-urls'), parsed.app);
      if (resolved) {
        try {
          targetOrigin = new URL(resolved).origin;
        } catch {
          targetOrigin = window.location.origin;
        }
      }
    }

    // Preserve the original OAuth query (code/state, or error/error_description).
    const target = `${targetOrigin}/callback/${provider}/${flow}${window.location.search}`;
    window.location.replace(target);
  }, [provider, getSettingValue]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-muted border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">Redirecionando…</p>
      </div>
    </main>
  );
}
