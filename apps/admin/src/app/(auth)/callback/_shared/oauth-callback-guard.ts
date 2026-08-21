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

export function getOAuthCallbackErrorMessage(
  error: unknown,
  alreadyProcessedMessage: string,
  fallbackMessage: string,
) {
  const responseMessage = (error as { response?: { data?: { message?: unknown } } })?.response?.data?.message;

  if (typeof responseMessage === 'string') {
    const normalizedMessage = responseMessage.trim().toLowerCase();

    if (normalizedMessage.includes('already processed')) {
      return alreadyProcessedMessage;
    }

    return responseMessage;
  }

  if (Array.isArray(responseMessage) && responseMessage.length > 0) {
    return responseMessage.join(', ');
  }

  return fallbackMessage;
}
