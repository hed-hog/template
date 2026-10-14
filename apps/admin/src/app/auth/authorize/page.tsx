'use client';

import { useApp } from '@hed-hog/next-app-provider';
import { CheckCircle2, Loader2, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AppConnectConsent } from '../_components/app-connect-consent';

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

type AuthorizeInfo = {
  clientName: string;
  logoUrl?: string | null;
  scopes: string[];
  issuer: string;
};

/**
 * Erro que o servidor marca como `redirectable`: os parâmetros que não podem ser
 * validados sem redirect_uri (client, redirect) já foram aprovados, então devolver
 * o erro ao cliente é seguro — e é o que um cliente OAuth espera. O dead-end fica
 * só para o que não é redirecionável.
 */
type OAuthErrorBody = {
  error?: string;
  error_description?: string;
  redirectable?: boolean;
  /** O servidor manda junto do erro redirecionável, para o `iss` do RFC 9207. */
  issuer?: string;
};

/**
 * Rótulo humano por escopo. Lookup explícito em vez de `t(\`scope.${s}\`)`
 * porque o next-intl lança quando a chave não existe — um escopo novo no
 * servidor quebraria a tela em vez de degradar.
 */
const SCOPE_LABEL_KEYS: Record<string, string> = {
  vaults: 'scope.vaults',
  mcp: 'scope.mcp',
  profile: 'scope.profile',
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
  // Opcionais: os clientes anteriores a este fluxo não os mandam, e a tela tem
  // que funcionar igual sem eles.
  const responseType = searchParams.get('response_type') ?? '';
  const resource = searchParams.get('resource') ?? '';
  const prompt = searchParams.get('prompt') ?? '';
  // Optional hint (e.g. from a mobile app): pre-select a social provider so the
  // login page starts it automatically. The consent step doesn't use it.
  const providerHint = searchParams.get('provider') ?? '';

  const [info, setInfo] = useState<AuthorizeInfo | null>(null);
  /**
   * Ref, e não state: o issuer não muda o que é renderizado, e como state ele
   * fechava um ciclo — `setIssuer` recriava `redirectToClient`, que recriava
   * `loadInfo`, que reexecutava o efeito e refazia o GET /auth/authorize/info.
   * Dois disparos por carregamento contra um endpoint com throttle de 30/min por
   * IP (atrás de NAT corporativo isso custa caro).
   */
  const issuerRef = useRef('');
  const [invalid, setInvalid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Devolve o resultado ao cliente. Sempre com `iss` (RFC 9207): os metadados do
   * servidor anunciam `authorization_response_iss_parameter_supported`, e um
   * cliente que valide isso rejeita a resposta inteira se o parâmetro faltar —
   * inclusive nas respostas de erro.
   */
  const redirectToClient = useCallback(
    (params: Record<string, string | undefined>) => {
      const target = new URL(redirectUri);
      for (const [key, value] of Object.entries(params)) {
        if (value) target.searchParams.set(key, value);
      }
      if (state) target.searchParams.set('state', state);
      if (issuerRef.current) target.searchParams.set('iss', issuerRef.current);
      window.location.href = target.toString();
    },
    [redirectUri, state],
  );

  // Valida os parâmetros no servidor ANTES de qualquer coisa. Se não passar,
  // a tela morre aqui — nunca navegamos para um redirect_uri não validado.
  const loadInfo = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: codeChallengeMethod,
      });
      // Só entram quando existem: `scope` vazio faz o servidor assumir os escopos
      // registrados do client, e mandar a chave vazia atrapalharia isso.
      if (scope) params.set('scope', scope);
      if (responseType) params.set('response_type', responseType);
      if (resource) params.set('resource', resource);

      const { data } = await request<AuthorizeInfo>({
        url: `/auth/authorize/info?${params.toString()}`,
      });
      issuerRef.current = data.issuer ?? '';
      setInfo(data);
    } catch (err) {
      const body = (err as { response?: { data?: OAuthErrorBody } })?.response?.data;
      // Erro que o servidor marcou como redirecionável volta para o cliente, em
      // vez de virar uma tela morta que o app do outro lado nunca vê.
      if (body?.redirectable && body.error && redirectUri) {
        // Sem isto o `iss` sairia vazio: o ref só é preenchido no caminho de
        // sucesso, que é justamente o que não aconteceu aqui.
        if (body.issuer) issuerRef.current = body.issuer;
        redirectToClient({
          error: body.error,
          error_description: body.error_description,
        });
        return;
      }
      setInvalid(true);
    }
  }, [
    clientId,
    redirectUri,
    scope,
    responseType,
    resource,
    codeChallenge,
    codeChallengeMethod,
    request,
    redirectToClient,
  ]);


  useEffect(() => {
    void loadInfo();
  }, [loadInfo]);

  useEffect(() => {
    if (redirectedRef.current) return;
    if (accessToken) return;
    if (invalid) return;

    /**
     * `prompt=none` quer dizer "não interaja com o usuário": em vez de mandar
     * para o login, devolvemos `login_required` e o cliente decide.
     *
     * Mas só DEPOIS que o servidor validou o pedido. `info` preenchido é a prova
     * de que /auth/authorize/info aprovou o `client_id` e o `redirect_uri` contra
     * a allowlist de `oauth_app_client`. Sem essa condição, este efeito rodava no
     * primeiro render — quando `loadInfo` ainda nem respondeu e `invalid` é false
     * — e navegava para um `redirect_uri` arbitrário: qualquer pessoa deslogada
     * transformava esta tela em open redirect com a marca do Hub, que é
     * exatamente o que o comentário do topo deste arquivo diz não poder acontecer.
     */
    if (prompt === 'none') {
      if (!info) return;
      redirectedRef.current = true;
      redirectToClient({
        error: 'login_required',
        error_description: 'Authentication is required and prompt=none was requested.',
      });
      return;
    }

    redirectedRef.current = true;
    setUrlAfterLogin(`/auth/authorize?${searchParams.toString()}`);
    router.replace(providerHint ? `/login?provider=${encodeURIComponent(providerHint)}` : '/login');
  }, [
    accessToken,
    info,
    invalid,
    prompt,
    providerHint,
    redirectToClient,
    router,
    searchParams,
    setUrlAfterLogin,
  ]);

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
          code_challenge: codeChallenge,
          code_challenge_method: codeChallengeMethod,
          ...(scope ? { scope } : {}),
          ...(responseType ? { response_type: responseType } : {}),
          ...(resource ? { resource } : {}),
        },
      });

      setAuthorized(true);
      redirectToClient({ code: data.code });
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
    redirectToClient({
      error: 'access_denied',
      error_description: 'The user denied the authorization request.',
    });
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
    <AppConnectConsent
      appName={info.clientName}
      appLogoUrl={info.logoUrl}
      title={t('title', { app: info.clientName })}
      subtitle={t('subtitle', { app: info.clientName })}
      connectingAsLabel={t('connectingAs')}
      authorizeLabel={t('authorize')}
      cancelLabel={t('cancel')}
      successTitle={t('successTitle')}
      successMessage={t('successMessage')}
      authorized={authorized}
      loading={loading}
      error={error}
      onAuthorize={handleAuthorize}
      onCancel={handleCancel}
    >
      <div className="rounded-2xl border border-border p-3">
        <p className="mb-2 px-1 text-xs font-medium text-foreground">{t('permissions')}</p>
        <ul className="flex flex-col gap-1.5">
          {info.scopes.map((s) => (
            <li key={s} className="flex items-start gap-2 px-1 text-xs text-muted-foreground">
              <CheckCircle2 className="mt-px size-3.5 shrink-0 text-primary" />
              {SCOPE_LABEL_KEYS[s] ? t(SCOPE_LABEL_KEYS[s]) : s}
            </li>
          ))}
        </ul>
      </div>
    </AppConnectConsent>
  );
}

export default function AuthorizeAppPage() {
  return (
    <Suspense fallback={null}>
      <AuthorizeApp />
    </Suspense>
  );
}
