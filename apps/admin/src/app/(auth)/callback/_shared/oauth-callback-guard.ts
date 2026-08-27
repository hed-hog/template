const OAUTH_CALLBACK_STORAGE_PREFIX = 'oauth-callback';

function getStorageKey(provider: string, flow: 'login' | 'register' | 'connect', code: string) {
  return `${OAUTH_CALLBACK_STORAGE_PREFIX}:${provider}:${flow}:${code}`;
}

export function hasProcessedOAuthCallback(
  provider: string,
  flow: 'login' | 'register' | 'connect',
  code: string,
) {
  if (typeof window === 'undefined' || !code) {
    return false;
  }

  try {
    return window.sessionStorage.getItem(getStorageKey(provider, flow, code)) === 'processed';
  } catch {
    return false;
  }
}

export function markOAuthCallbackAsProcessed(
  provider: string,
  flow: 'login' | 'register' | 'connect',
  code: string,
) {
  if (typeof window === 'undefined' || !code) {
    return;
  }

  try {
    window.sessionStorage.setItem(getStorageKey(provider, flow, code), 'processed');
  } catch {
    // Ignore storage failures and fall back to in-memory protections.
  }
}

/**
 * Motivos que o backend devolve em `oauthReason` para "este código já foi usado".
 * A chave é estável e independe de idioma — antes dela o match era pela substring
 * "already processed", que só existe no texto em inglês e portanto nunca disparava
 * para quem usa o Hub em pt-BR.
 */
const ALREADY_PROCESSED_REASONS = ['already_processed', 'callback_consumed'];

/** Fallback para backend anterior ao `oauthReason`, agora nos dois idiomas. */
const ALREADY_PROCESSED_HINTS = ['already processed', 'já foi processado'];

export function getOAuthCallbackErrorMessage(
  error: unknown,
  alreadyProcessedMessage: string,
  fallbackMessage: string,
) {
  const responseData = (
    error as { response?: { data?: { message?: unknown; oauthReason?: unknown } } }
  )?.response?.data;

  if (
    typeof responseData?.oauthReason === 'string' &&
    ALREADY_PROCESSED_REASONS.includes(responseData.oauthReason)
  ) {
    return alreadyProcessedMessage;
  }

  const responseMessage = responseData?.message;

  if (typeof responseMessage === 'string') {
    const normalizedMessage = responseMessage.trim().toLowerCase();

    if (ALREADY_PROCESSED_HINTS.some((hint) => normalizedMessage.includes(hint))) {
      return alreadyProcessedMessage;
    }

    return responseMessage;
  }

  if (Array.isArray(responseMessage) && responseMessage.length > 0) {
    return responseMessage.join(', ');
  }

  return fallbackMessage;
}
