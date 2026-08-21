/**
 * Estado da sessao simulada, no escopo da ABA.
 *
 * POR QUE sessionStorage E NAO localStorage
 *
 * Se o app de destino for o mesmo em que o operador esta logado (simular um
 * outro administrador dentro do proprio painel), a aba nova compartilha origem
 * — e portanto `localStorage` — com a aba do operador. Gravar em
 * `LocalStorageKeys.AccessToken` sobrescreveria o token do operador em TODAS as
 * abas dele. `sessionStorage` e por aba, entao as duas identidades convivem.
 *
 * A aba nova e aberta com `window.open(url, '_blank', 'noopener')`: `noopener`
 * cria um contexto de navegacao novo, e sessionStorage NAO e clonada do
 * abridor — sem isso a aba nasceria com uma copia do estado da aba de origem.
 *
 * Este arquivo e so funcao pura sobre storage, sem React, para poder ser testado
 * direto.
 */

export const IMPERSONATION_SESSION_KEY = 'hedhog-impersonation';

export type ImpersonationParticipant = {
  id: number;
  name: string;
};

export type ImpersonationState = {
  accessToken: string;
  /** ISO. Fim da janela; nao ha renovacao. */
  expiresAt: string;
  operator: ImpersonationParticipant;
  target: ImpersonationParticipant;
  app: string;
  sessionId?: number;
};

export function isImpersonationExpired(state: ImpersonationState | null): boolean {
  if (!state?.expiresAt) return true;

  const expiresAt = new Date(state.expiresAt).getTime();
  return Number.isNaN(expiresAt) || expiresAt <= Date.now();
}

export function readImpersonation(): ImpersonationState | null {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.sessionStorage.getItem(IMPERSONATION_SESSION_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as ImpersonationState;
    if (!parsed?.accessToken) return null;

    // Uma janela vencida nao vale como sessao: o backend ja rejeitaria o token,
    // mas assim a UI nao pisca com a identidade errada antes do primeiro 401.
    if (isImpersonationExpired(parsed)) {
      clearImpersonation();
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeImpersonation(state: ImpersonationState): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.setItem(IMPERSONATION_SESSION_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage failures.
  }
}

export function clearImpersonation(): void {
  if (typeof window === 'undefined') return;

  try {
    window.sessionStorage.removeItem(IMPERSONATION_SESSION_KEY);
  } catch {
    // Ignore storage failures.
  }
}

/**
 * Le o codigo do fragment (`#code=...`). Fragment, e nao query string: ele nunca
 * e enviado ao servidor, entao o codigo nao entra em log de acesso nem em
 * `Referer`. Quem chama deve apaga-lo com `history.replaceState` logo apos ler.
 */
export function parseCodeFromHash(hash: string): string | null {
  const raw = (hash || '').replace(/^#/, '');
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const code = params.get('code');

  return code && code.trim() ? code.trim() : null;
}

export function remainingMs(state: ImpersonationState | null): number {
  if (!state?.expiresAt) return 0;

  const expiresAt = new Date(state.expiresAt).getTime();
  if (Number.isNaN(expiresAt)) return 0;

  return Math.max(0, expiresAt - Date.now());
}

/** `mm:ss` para a contagem regressiva do banner. */
export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
