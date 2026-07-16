'use client';

import { Button } from '@/components/ui/button';
import { useApp } from '@hed-hog/next-app-provider';
import { CheckCircle2, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Tela de consent do fluxo Authorization Code + PKCE.
 *
 * Diferenças deliberadas em relação a /auth/desktop, que tem os dois problemas
 * que este fluxo existe para não repetir:
 *  - lá o destino vem de `?scheme=` sem allowlist (open redirect); aqui o
 *    redirect_uri é validado no servidor, antes de renderizar e de novo ao emitir;
 *  - lá os tokens vão na URL; aqui vai um code de 60s, single-use e inútil sem o
 *    code_verifier, que nunca sai da extensão.
 */

type AuthorizeInfo = { clientName: string; scopes: string[] };

/**
 * Rótulo humano por escopo. Lookup explícito em vez de `t(\`scope.${s}\`)`
 * porque o next-intl lança quando a chave não existe — um escopo novo no
 * servidor quebraria a tela em vez de degradar.
 */
const SCOPE_LABEL_KEYS: Record<string, string> = {
  vaults: 'scope.vaults',
};

type VerifyResponse = {
  user_identifier?: { type: string; value: string; enabled: boolean }[];
};

function AuthorizeApp() {
  const { accessToken, request, setUrlAfterLogin } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedRef = useRef(false);
  const t = useTranslations('AuthorizeApp');

  const clientId = searchParams.get('client_id') ?? '';
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const state = searchParams.get('state') ?? '';
  const scope = searchParams.get('scope') ?? '';
  const codeChallenge = searchParams.get('code_challenge') ?? '';
  const codeChallengeMethod = searchParams.get('code_challenge_method') ?? '';

  const [info, setInfo] = useState<AuthorizeInfo | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState('');

  /**
   * Numa tela de consent, mostrar em qual conta se está autorizando não é
   * decoração. O email vem de /auth/verify: o JWT carrega só sub/sessionId, e
   * o `user_identifier[]` é onde o endereço vive.
   */
  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    void (async () => {
      try {
        const { data } = await request<VerifyResponse>({ url: '/auth/verify' });
        const email = data.user_identifier?.find((i) => i.type === 'email' && i.enabled)?.value;
        if (active && email) setUserEmail(email);
      } catch {
        // Sem o email a tela ainda funciona; não vale bloquear o consent por isso.
      }
    })();
    return () => {
      active = false;
    };
  }, [accessToken, request]);

  // Valida os parâmetros no servidor ANTES de qualquer coisa. Se não passar,
  // a tela morre aqui — nunca navegamos para um redirect_uri não validado.
  const loadInfo = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
      });
      const { data } = await request<AuthorizeInfo>({
        url: `/auth/authorize/info?${params.toString()}`,
      });
      setInfo(data);
    } catch {
      setInvalid(true);
    }
  }, [clientId, redirectUri, scope, codeChallenge, codeChallengeMethod, request]);

  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    if (redirectedRef.current) return;
    if (accessToken) return;
    if (invalid) return;

    redirectedRef.current = true;
    setUrlAfterLogin(`/auth/authorize?${searchParams.toString()}`);
    router.replace('/login');
  }, [accessToken, invalid, router, searchParams, setUrlAfterLogin]);

  async function handleAuthorize() {
    setLoading(true);
    setError(null);
    try {
      const { data } = await request<{ code: string }>({
        url: '/auth/authorize/consent',
        method: 'POST',
        data: {
          client_id: clientId,
          redirect_uri: redirectUri,
          scope,
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
        },
      });

      setAuthorized(true);

      const target = new URL(redirectUri);
      target.searchParams.set('code', data.code);
      if (state) target.searchParams.set('state', state);
      window.location.href = target.toString();
    } catch {
      setError(t('error'));
      setLoading(false);
    }
  }

  function handleCancel() {
    if (!redirectUri) {
      router.replace('/');
      return;
    }
    // Devolve o erro ao app, em vez de deixá-lo esperando para sempre.
    const target = new URL(redirectUri);
    target.searchParams.set('error', 'access_denied');
    if (state) target.searchParams.set('state', state);
    window.location.href = target.toString();
  }

  if (invalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm bg-card border border-border rounded-2xl shadow-sm p-8 flex flex-col items-center gap-6">
          <div className="w-14 h-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
            <TriangleAlert className="size-7 text-destructive" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">{t('invalidTitle')}</h1>
            <p className="text-sm text-muted-foreground mt-1.5">{t('invalidMessage')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!accessToken || !info) {
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
              <ShieldCheck className="size-7 text-primary" strokeWidth={1.5} />
            </div>

            <div className="text-center">
              <h1 className="text-xl font-semibold text-foreground">
                {t('title', { app: info.clientName })}
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                {t('subtitle', { app: info.clientName })}
              </p>
              {userEmail && (
                <p className="text-xs text-muted-foreground mt-1 bg-muted rounded-full px-3 py-1 inline-block">
                  {userEmail}
                </p>
              )}
            </div>

            <div className="w-full rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium text-foreground mb-1.5">{t('permissions')}</p>
              <ul className="flex flex-col gap-1">
                {info.scopes.map((s) => (
                  <li key={s} className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="size-3 shrink-0" />
                    {SCOPE_LABEL_KEYS[s] ? t(SCOPE_LABEL_KEYS[s]) : s}
                  </li>
                ))}
              </ul>
            </div>

            {error && <p className="text-xs text-destructive text-center">{error}</p>}

            <div className="flex flex-col gap-2 w-full">
              <Button className="w-full gap-2" onClick={handleAuthorize} disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {t('authorize')}
              </Button>
              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={handleCancel}
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

export default function AuthorizeAppPage() {
  return (
    <Suspense fallback={null}>
      <AuthorizeApp />
    </Suspense>
  );
}
