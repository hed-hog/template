import 'server-only';

type NextFetchConfig = {
  revalidate?: number | false;
  tags?: string[];
};

type FetchAdminApiJsonOptions = Omit<RequestInit, 'cache' | 'signal'> & {
  cache?: RequestCache;
  next?: NextFetchConfig;
  timeoutMs?: number;
};

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;
const DEFAULT_API_BASE_URL = 'http://localhost:3100';

const normalizeBaseUrl = (url: string) => url.trim().replace(/\/$/, '');
const normalizeApiBaseUrl = (url: string) => {
  const normalizedUrl = normalizeBaseUrl(url);

  return normalizedUrl.replace(/\/api$/, '');
};

const resolveAbsoluteUrl = (value?: string) => {
  const normalizedValue = value?.trim();
  if (!normalizedValue || !ABSOLUTE_URL_PATTERN.test(normalizedValue)) {
    return null;
  }

  return normalizeBaseUrl(normalizedValue);
};

export class AdminApiError extends Error {
  code?: string;
  responseBody?: string;
  status?: number;
  url: string;

  constructor(
    message: string,
    options: {
      cause?: unknown;
      code?: string;
      responseBody?: string;
      status?: number;
      url: string;
    }
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'AdminApiError';
    this.code = options.code;
    this.responseBody = options.responseBody;
    this.status = options.status;
    this.url = options.url;
  }
}

export const getAdminApiBaseUrl = () => {
  const internalApiUrl = process.env.INTERNAL_API_URL?.trim();
  if (internalApiUrl) {
    return normalizeApiBaseUrl(internalApiUrl);
  }

  const publicBaseUrl = resolveAbsoluteUrl(
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
  );
  if (publicBaseUrl) {
    return normalizeApiBaseUrl(publicBaseUrl);
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Admin API URL is not configured for production. Set INTERNAL_API_URL or an absolute NEXT_PUBLIC_API_BASE_URL.'
    );
  }

  return DEFAULT_API_BASE_URL;
};

export const buildAdminApiUrl = (path: string) =>
  new URL(path.replace(/^\//, ''), `${getAdminApiBaseUrl()}/`).toString();

const createTimeoutSignal = (timeoutMs?: number) => {
  if (!timeoutMs) {
    return { cleanup: undefined, signal: undefined as AbortSignal | undefined };
  }

  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return {
      cleanup: undefined,
      signal: AbortSignal.timeout(timeoutMs),
    };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  return {
    cleanup: () => clearTimeout(timeoutId),
    signal: controller.signal,
  };
};

const getErrorCode = (error: unknown): string | undefined => {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  if ('code' in error && typeof error.code === 'string') {
    return error.code;
  }

  if ('cause' in error) {
    return getErrorCode(error.cause);
  }

  return undefined;
};

const isAbortOrTimeoutError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') {
    return false;
  }

  if (
    'name' in error &&
    typeof error.name === 'string' &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  ) {
    return true;
  }

  if (
    'message' in error &&
    typeof error.message === 'string' &&
    /aborted|timeout|timed out/i.test(error.message)
  ) {
    return true;
  }

  if ('cause' in error) {
    return isAbortOrTimeoutError(error.cause);
  }

  return false;
};

const getAdminApiErrorCode = (error: unknown): string | undefined => {
  if (isAbortOrTimeoutError(error)) {
    return 'ETIMEDOUT';
  }

  return getErrorCode(error);
};

export const isRetryableAdminApiError = (error: unknown) => {
  const code = getAdminApiErrorCode(error);

  return (
    code === 'ECONNREFUSED' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    code === 'UND_ERR_CONNECT_TIMEOUT'
  );
};

export const fetchAdminApiJson = async <T>(
  path: string,
  options: FetchAdminApiJsonOptions = {}
) => {
  const {
    cache = 'no-store',
    headers,
    timeoutMs = 5000,
    ...requestInit
  } = options;
  const url = buildAdminApiUrl(path);
  const { cleanup, signal } = createTimeoutSignal(timeoutMs);

  try {
    const response = await fetch(url, {
      ...requestInit,
      cache,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        ...headers,
      },
      signal,
    });

    if (!response.ok) {
      const responseBody = await response.text();
      throw new AdminApiError(
        `Request to ${url} failed with status ${response.status} ${response.statusText}`,
        {
          responseBody,
          status: response.status,
          url,
        }
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof AdminApiError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : 'Unknown admin API fetch error';
    throw new AdminApiError(`Request to ${url} failed: ${message}`, {
      cause: error,
      code: getAdminApiErrorCode(error),
      url,
    });
  } finally {
    cleanup?.();
  }
};
