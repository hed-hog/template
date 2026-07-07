// Helpers for the OAuth hub-forwarding pattern.
//
// This app (admin) is the default OAuth callback destination (the `url` setting).
// When another app (e.g. training) starts the flow, the backend signs a state
// `hhweb.<app>.<flow>.<sig>` into the provider auth URL. The provider redirects
// back here; if the `state` points to a different app, this hub forwards the
// browser to that app's callback so it can complete the login itself.
//
// Security: the target origin is resolved from the server-provided `app-urls`
// allowlist (never from a raw URL in the state), so a tampered state can only ever
// forward to a configured app origin. The backend additionally binds the code
// exchange to the initiating origin.

type OAuthCallbackFlow = 'login' | 'register' | 'connect';

/** Parses a signed web-hub state into its app key and flow, or null when invalid. */
export function parseHubState(
  state: string | null | undefined,
): { app: string; flow: OAuthCallbackFlow } | null {
  if (!state || !state.startsWith('hhweb.')) {
    return null;
  }
  const parts = state.split('.');
  if (parts.length !== 4) {
    return null;
  }
  const app = parts[1]?.trim().toLowerCase();
  const flow = parts[2]?.trim().toLowerCase();
  if (!app || !/^[a-z0-9][a-z0-9_-]{0,63}$/.test(app)) {
    return null;
  }
  if (flow !== 'login' && flow !== 'register' && flow !== 'connect') {
    return null;
  }
  return { app, flow };
}

/** Extracts the app key from a signed web-hub state, or null when absent/invalid. */
export function parseHubStateApp(state: string | null | undefined): string | null {
  return parseHubState(state)?.app ?? null;
}

/** Resolves an app key to its base origin from the `app-urls` setting entries. */
export function resolveAppOrigin(
  appUrls: unknown,
  app: string,
): string | null {
  let source: unknown = appUrls;
  if (typeof source === 'string') {
    // Defensive: `app-urls` normally arrives parsed, but tolerate a JSON string.
    try {
      source = JSON.parse(source);
    } catch {
      source = [];
    }
  }
  const list = Array.isArray(source) ? (source as unknown[]) : [];
  for (const item of list) {
    if (typeof item !== 'string') {
      continue;
    }
    const separatorIndex = item.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }
    if (item.slice(0, separatorIndex).trim() === app) {
      const value = item.slice(separatorIndex + 1).trim();
      return value || null;
    }
  }
  return null;
}

function normalizeOrigin(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  try {
    return new URL(value).origin.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Returns the absolute URL to forward the browser to when the callback belongs to
 * a different app, or null when the flow should be handled locally by this hub.
 */
export function getHubForwardUrl(params: {
  appUrls: unknown;
  state: string | null | undefined;
  provider: string;
  flow: OAuthCallbackFlow;
  code: string;
  currentOrigin: string;
}): string | null {
  const { appUrls, state, provider, flow, code, currentOrigin } = params;

  const app = parseHubStateApp(state);
  if (!app) {
    return null;
  }

  const targetOrigin = normalizeOrigin(resolveAppOrigin(appUrls, app));
  if (!targetOrigin || targetOrigin === normalizeOrigin(currentOrigin)) {
    // Unknown app or same origin as the hub: nothing to forward, handle locally.
    return null;
  }

  const query = new URLSearchParams({ code });
  if (state) {
    query.set('state', state);
  }
  return `${targetOrigin}/callback/${provider}/${flow}?${query.toString()}`;
}
