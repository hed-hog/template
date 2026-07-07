'use client';

import { AppProgressProviderProps, AppProgressProvider as ProgressProvider } from '@bprogress/next';
import { User } from '@hed-hog/api-types';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import { decode } from 'js-base64';
import { useRouter } from 'next/navigation';
import {
    createContext,
    Dispatch,
    ReactNode,
    SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState
} from 'react';
import { toast } from "sonner";
import { useLocalStorage } from 'usehooks-ts';


// Export QueryClient for external use
export { QueryClient, useQuery } from '@tanstack/react-query';

type ThemeMode = 'light' | 'dark' | 'system';
type ThemeSource = 'explicit' | 'fallback';
type Density = 'compact' | 'comfortable' | 'spacious';

const THEME_STORAGE_KEY = 'theme';
const THEME_SOURCE_STORAGE_KEY = 'theme-source';
const DENSITY_STORAGE_KEY = 'theme-spacing';
const DENSITY_SOURCE_STORAGE_KEY = 'theme-spacing-source';
const ZOOM_STORAGE_KEY = 'theme-zoom';
const ZOOM_SOURCE_STORAGE_KEY = 'theme-zoom-source';
const FORM_DRAFT_STORAGE_MARKER = '-draft';

const isThemeMode = (value: unknown): value is ThemeMode => {
	return value === 'light' || value === 'dark' || value === 'system';
};

const isDensity = (value: unknown): value is Density => {
	return value === 'compact' || value === 'comfortable' || value === 'spacious';
};

const isZoom = (value: unknown): value is string => {
	return typeof value === 'string' && /^[0-9]{1,3}%$/.test(value);
};

const parseStorageValue = (value: string | null): string | null => {
	if (value === null) return null;

	try {
		const parsed = JSON.parse(value);
		return typeof parsed === 'string' ? parsed : null;
	} catch {
		return value;
	}
};

const getStoredThemeSource = (): ThemeSource | null => {
	if (typeof window === 'undefined') return null;

	const parsedValue = parseStorageValue(
		window.localStorage.getItem(THEME_SOURCE_STORAGE_KEY),
	);

	return parsedValue === 'explicit' || parsedValue === 'fallback'
		? parsedValue
		: null;
};

const clearStoredFormDrafts = () => {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		Object.keys(window.localStorage).forEach(key => {
			if (key.includes(FORM_DRAFT_STORAGE_MARKER)) {
				window.localStorage.removeItem(key);
			}
		});
	} catch {
		// Ignore storage cleanup failures.
	}
};

export type RegisterForm = {
	name: string;
	email: string;
	password: string;
	cpf: string;
};

export enum LocalStorageKeys {
	Collapsed = 'collapsed-sidebar',
	AccessToken = 'access-token',
	RefreshToken = 'refresh-token',
	UrlAfterLogin = 'url-after-login',
	User = 'user',
	UserType = 'user-type',
	BrowserId = 'browser-id',
}

function getBrowserId(): string {
	if (typeof window === 'undefined') return '';
	let id = localStorage.getItem(LocalStorageKeys.BrowserId);
	if (!id) {
		id = typeof crypto !== 'undefined' && crypto.randomUUID
			? crypto.randomUUID()
			: Math.random().toString(36).slice(2) + Date.now().toString(36);
		localStorage.setItem(LocalStorageKeys.BrowserId, id);
	}
	return id;
}

// usehooks-ts stores strings via JSON.stringify, so localStorage.getItem returns '"token"' (with quotes).
// This helper JSON.parses the raw value so direct reads match the hook's deserialised state.
function readLocalStorageToken(key: string): string {
	if (typeof window === 'undefined') return '';
	const raw = localStorage.getItem(key);
	if (!raw) return '';
	try {
		const parsed = JSON.parse(raw);
		return typeof parsed === 'string' ? parsed : '';
	} catch {
		return raw;
	}
}

export type ForbiddenErrorState = {
	show: boolean;
	message: string;
	url: string;
	method: string;
	statusCode?: number;
};

const emptyForbiddenErrorState: ForbiddenErrorState = {
	show: false,
	message: '',
	url: '',
	method: '',
	statusCode: undefined,
};

type AppContextType = {
	logout: () => Promise<void>;
	login: (
		email: string,
		password: string,
	) => Promise<RequestLoginType>;
	forgot: (email: string) => Promise<void>;
	signup: (data: RegisterForm) => Promise<{
		accessToken: string;
		hasChallenge: boolean;
	}>;
	resetPassword: (
		code: string,
		newPassword: string,
		confirmNewPassword: string,
	) => Promise<void>;
	accessToken: string;
	user: User | null | undefined;
	clearUserData: () => void;
	request: <T extends {}>(
		config?: AxiosRequestConfig & { showErrors?: boolean },
	) => Promise<AxiosResponse<T, any>>;
	showToastHandler: (
		type: 'success' | 'error',
		name: string,
		action?: string,
		error?: any,
	) => void;
	setAccessToken: Dispatch<SetStateAction<string>>;
	getUrlAfterLogin: () => string;
	setUrlAfterLogin: Dispatch<SetStateAction<string>>;
	getErrorMessage: (error: any) => string;
	userEmail: string;
	userPhotoUrl: string;
	userAbbr: string;
	locales: { code: string; name: string }[];
	currentLocaleCode: string;
	setCurrentLocaleCode: Dispatch<SetStateAction<string>>;
	currentTheme: ThemeMode;
	setCurrentTheme: Dispatch<SetStateAction<ThemeMode>>;
	density: Density;
	setDensity: Dispatch<SetStateAction<Density>>;
	zoom: string;
	setZoom: Dispatch<SetStateAction<string>>;
	refetchUser: () => Promise<unknown>;
	getSettingValue: (key: string) => any;
	setSettingValue: (key: string, value: any) => Promise<void>;
	forbiddenError: ForbiddenErrorState;
	setForbiddenError: Dispatch<SetStateAction<ForbiddenErrorState>>;
};

export const AppContext = createContext<AppContextType>({
	logout: () => Promise.resolve(),	
	login: () => Promise.resolve({accessToken: '', hasMfa: false}),
	forgot: () => Promise.resolve(),
	signup: () => Promise.resolve({accessToken: '', hasChallenge: false}),
	resetPassword: () => Promise.resolve(),
	clearUserData: () => {},
	accessToken: '',
	user: null,
	request: () => new Promise(() => {}),
	showToastHandler: () => {},
	setAccessToken: () => {},
	getUrlAfterLogin: () => '',
	setUrlAfterLogin: () => {},
	getErrorMessage: () => '',
	userEmail: '',
	userPhotoUrl: '/placeholder.png',
	userAbbr: '',
	locales: [],
	currentLocaleCode: 'en',
	setCurrentLocaleCode: () => {},
	currentTheme: 'system',
	setCurrentTheme: () => {},
	density: 'comfortable',
	setDensity: () => {},
	zoom: '100%',
	setZoom: () => {},
	refetchUser: () => new Promise(() => {}),
	getSettingValue: () => null,
	setSettingValue: () => Promise.resolve(),
	forbiddenError: emptyForbiddenErrorState,
	setForbiddenError: () => {},
});

type RequestLoginType = {
	accessToken?: string;
	refreshToken?: string;
	hasMfa?: boolean;
	requiresMfa?: boolean;
	mfaToken?: string;
	mfaMethods?: any[]
	requiresEmailVerification?: boolean;
	requiresPasswordReset?: boolean;
	token?: string;
};

type RequestSignupType = {
	accessToken?: string;
	refreshToken?: string;
	user: User;
	hasChallenge: boolean;
}

export type ApiErrorContext = {
	url: string;
	method?: string;
	statusCode?: number;
};

export type AppProviderProps = {
	children: ReactNode;
	toast: typeof toast | any;
	queryClient?: QueryClient;
	settings: Record<string, any>;
	locales: { code: string; name: string }[];
	bprogressConfig?: AppProgressProviderProps;
	/**
	 * Optional global hook fired for every real API error (any non-cancelled
	 * response error), regardless of the per-request `showErrors` flag. Lets a
	 * host app surface errors (e.g. a global error modal) without touching each
	 * call site. Not fired for cancelled/aborted requests or the silent token
	 * refresh cycle.
	 */
	onError?: (error: any, context: ApiErrorContext) => void;
};

// Create a default QueryClient instance
const defaultQueryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 0,
			refetchOnWindowFocus: true,
			retry: (failureCount, error: any) => {
				const statusCode = error?.response?.status;
				if (statusCode === 400 || statusCode === 401 || statusCode === 403) {
					return false;
				}

				const errorMessage = (
					error?.response?.data?.message ||
					error?.message ||
					''
				)
					.toString()
					.toLowerCase();

				if (
					errorMessage.includes('token') ||
					errorMessage.includes('unauthorized') ||
					errorMessage.includes('forbidden')
				) {
					return false;
				}

				return failureCount < 3;
			},
		},
	},
});

function AppContextProvider({
	children,
	accessToken,
	setAccessToken,
	urlAfterLogin,
	setUrlAfterLogin,
	settings,
	apiBaseUrl: apiBaseUrlProp,
	toast: toaster,
	locales,
	onError,
}: {
	children: ReactNode;
	accessToken: string;
	setAccessToken: Dispatch<SetStateAction<string>>;
	urlAfterLogin: string;
	setUrlAfterLogin: Dispatch<SetStateAction<string>>;
	settings: Record<string, any>;
	apiBaseUrl?: string;
	toast?: typeof toast | any;
	locales: { code: string; name: string }[];
	onError?: (error: any, context: ApiErrorContext) => void;
}) {
	const [settingsState, setSettingsState] = useLocalStorage('settings', JSON.stringify(settings));
	const [currentLocaleCode, setCurrentLocaleCode] = useLocalStorage("locale", "en");
	const [currentTheme, setStoredCurrentTheme] = useLocalStorage<ThemeMode>(
		THEME_STORAGE_KEY,
		isThemeMode(settings['theme-mode']) ? settings['theme-mode'] : 'system',
	);
	const [density, setStoredDensity] = useLocalStorage<Density>(
		DENSITY_STORAGE_KEY,
		isDensity(settings['theme-spacing']) ? settings['theme-spacing'] : 'comfortable',
	);
	const [zoom, setStoredZoom] = useLocalStorage<string>(
		ZOOM_STORAGE_KEY,
		isZoom(settings['theme-zoom']) ? settings['theme-zoom'] : '100%',
	);
	const [refreshToken, setRefreshToken] = useLocalStorage(LocalStorageKeys.RefreshToken, '');
	const [forbiddenError, setForbiddenError] = useState<ForbiddenErrorState>(emptyForbiddenErrorState);
	const settingsApiBaseUrl =
		typeof settings['api-base-url'] === 'string'
			? settings['api-base-url'].trim()
			: typeof settings['api_base_url'] === 'string'
				? settings['api_base_url'].trim()
				: '';
	const apiBaseUrl =
		apiBaseUrlProp?.trim() ||
		process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
		settingsApiBaseUrl ||
		'/api';

	// Track the previous settings to detect changes
	const prevSettingsRef = useRef<string>('');

	// Sync settings from server to localStorage whenever they change
	useEffect(() => {
		const newSettingsString = JSON.stringify(settings);
		
		// Only update if settings actually changed
		if (prevSettingsRef.current !== newSettingsString) {
			prevSettingsRef.current = newSettingsString;
			setSettingsState(newSettingsString);
		}
	}, [settings, setSettingsState, settingsState]);

	const router = useRouter();

	// Use refs to persist refresh state across re-renders
	const isRefreshingRef = useRef(false);
	const hasShownSessionExpiredRef = useRef(false);
	const isRedirectingToLoginRef = useRef(false);
	const failedQueueRef = useRef<Array<{
		resolve: (value?: any) => void;
		reject: (reason?: any) => void;
	}>>([]);
	const forbiddenQueueRef = useRef<ForbiddenErrorState[]>([]);
	const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

	const getErrorMessage = (error: any) => {
		const raw = error?.response?.data?.message ?? error?.message;
		if (typeof raw === 'string') return raw;
		if (Array.isArray(raw)) return raw.join(' ');
		if (raw && typeof raw === 'object') return Object.values(raw).flat().join(' ');
		return 'An unknown error occurred';
	};

	const handleError = (error: any) => {
		const message = getErrorMessage(error);
		if (message.includes('Invalid file type: ')) {
			toaster.error('O tipo de arquivo enviado não é permitido.');
		} else {
			switch (error.code) {
				case 'ERR_NETWORK':
					toaster.error('Network error');
					break;
				default:
					toaster.error(message || 'An error occurred');
			}
		}
	};

	const processQueue = useCallback((error: any, token: string | null = null) => {
		failedQueueRef.current.forEach(prom => {
			if (token) {
				prom.resolve(token);
			} else {
				prom.reject(error);
			}
		});
		failedQueueRef.current = [];
	}, []);

	const isTokenErrorMessage = useCallback((message: unknown) => {
		if (typeof message !== 'string') return false;
		return (
			message.includes('jwt expired') ||
			message.includes('invalid signature') ||
			message.includes('invalid token') ||
			message.includes('token expired') ||
			message.includes('unauthorized')
		);
	}, []);

	const isAuthorizationError = useCallback(
		(statusCode: number | undefined, message: string) => {
			if (statusCode === 403) {
				return true;
			}

			return false;
		},
		[],
	);

	const createForbiddenErrorState = useCallback(
		(
			error: any,
			originalRequest: AxiosRequestConfig,
			requestUrl: string,
			statusCode: number | undefined,
			fallbackMethod?: string,
		): ForbiddenErrorState => {
			const backendMessage = error.response?.data?.message;
			const message =
				typeof backendMessage === 'string' && backendMessage.trim().length > 0
					? `Você não tem acesso para solicitar este recurso. ${backendMessage}`
					: 'Você não tem acesso para solicitar este recurso.';

			return {
				show: true,
				message,
				url: requestUrl,
				method: (originalRequest.method || fallbackMethod || 'GET').toUpperCase(),
				statusCode,
			};
		},
		[],
	);

	const refreshTokenRequest = useCallback(async (): Promise<string | null> => {
		try {
			const browserId = getBrowserId();
			const refreshInstance = axios.create({
				baseURL: apiBaseUrl,
				withCredentials: true,
				headers: {
					'Accept-Language': currentLocaleCode ?? 'en',
					...(browserId ? { 'X-Browser-ID': browserId } : {}),
				},
			});
			refreshInstance.defaults.withCredentials = true;

			// Always read the freshest refresh token from localStorage to handle cross-tab rotation.
			// The closure value may be stale if another tab rotated the token before this request fired.
			const tokenToSend = typeof window !== 'undefined'
				? readLocalStorageToken(LocalStorageKeys.RefreshToken) || refreshToken
				: refreshToken;

			const response = await refreshInstance.post<{
				accessToken: string;
				refreshToken?: string;
			}>('/auth/refresh', tokenToSend ? { refreshToken: tokenToSend } : {});

			if (response.data?.refreshToken) {
				setRefreshToken(response.data.refreshToken);
			}

			return response.data?.accessToken || null;
		} catch (error) {
			if (typeof window !== 'undefined') {
				console.debug('[auth] refresh failed', error);
			}
			return null;
		}
	}, [apiBaseUrl, currentLocaleCode, refreshToken, setRefreshToken]);

	const enqueueForbiddenError = useCallback((forbiddenState: ForbiddenErrorState) => {
		setForbiddenError(currentForbiddenError => {
			if (!currentForbiddenError.show) {
				return forbiddenState;
			}

			forbiddenQueueRef.current.push(forbiddenState);
			return currentForbiddenError;
		});
	}, []);

	const clearForbiddenError = useCallback(() => {
		const nextForbiddenError = forbiddenQueueRef.current.shift();
		setForbiddenError(nextForbiddenError ?? emptyForbiddenErrorState);
	}, []);

	const clearSessionState = useCallback(() => {
		setAccessToken('');
		setRefreshToken('');
	}, [setAccessToken, setRefreshToken]);

	const rememberCurrentUrl = useCallback(() => {
		if (typeof window === 'undefined') {
			return;
		}

		const nextUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
		setUrlAfterLogin(nextUrl || '/');
	}, [setUrlAfterLogin]);

	const setCurrentTheme: Dispatch<SetStateAction<ThemeMode>> = useCallback(
		value => {
			const nextTheme =
				typeof value === 'function' ? value(currentTheme) : value;

			if (!isThemeMode(nextTheme)) {
				return;
			}

			setStoredCurrentTheme(nextTheme);

			if (typeof window !== 'undefined') {
				window.localStorage.setItem(
					THEME_SOURCE_STORAGE_KEY,
					JSON.stringify('explicit'),
				);
				window.dispatchEvent(
					new CustomEvent<ThemeMode>('hedhog:theme-change', {
						detail: nextTheme,
					}),
				);
			}
		},
		[currentTheme, setStoredCurrentTheme],
	);

	const setDensity: Dispatch<SetStateAction<Density>> = useCallback(
		value => {
			const nextDensity =
				typeof value === 'function' ? value(density) : value;

			if (!isDensity(nextDensity)) {
				return;
			}

			setStoredDensity(nextDensity);

			if (typeof window !== 'undefined') {
				window.localStorage.setItem(
					DENSITY_SOURCE_STORAGE_KEY,
					JSON.stringify('explicit'),
				);
				window.dispatchEvent(new CustomEvent('hedhog:settings-change'));
			}
		},
		[density, setStoredDensity],
	);

	const setZoom: Dispatch<SetStateAction<string>> = useCallback(
		value => {
			const nextZoom = typeof value === 'function' ? value(zoom) : value;

			if (!isZoom(nextZoom)) {
				return;
			}

			setStoredZoom(nextZoom);

			if (typeof window !== 'undefined') {
				window.localStorage.setItem(
					ZOOM_SOURCE_STORAGE_KEY,
					JSON.stringify('explicit'),
				);
				window.dispatchEvent(new CustomEvent('hedhog:settings-change'));
			}
		},
		[zoom, setStoredZoom],
	);

	const setForbiddenErrorState = useCallback<Dispatch<SetStateAction<ForbiddenErrorState>>>(
		value => {
			if (typeof value === 'function') {
				setForbiddenError(currentValue => {
					const nextValue = value(currentValue);
					if (!nextValue.show) {
						return forbiddenQueueRef.current.shift() ?? emptyForbiddenErrorState;
					}

					return nextValue;
				});
				return;
			}

			if (!value.show) {
				clearForbiddenError();
				return;
			}

			setForbiddenError(value);
		},
		[clearForbiddenError],
	);

	const requestImpl = useCallback(
		<T extends {}>(config?: AxiosRequestConfig & {showErrors?: boolean}) => {
			const instance = axios.create({
				baseURL: apiBaseUrl,
				withCredentials: true,
			});

			instance.interceptors.request.use(
				cnf => {
					cnf.headers = cnf.headers ?? {};
					if (
						typeof FormData !== 'undefined' &&
						cnf.data instanceof FormData
					) {
						delete (cnf.headers as any)['Content-Type'];
						delete (cnf.headers as any)['content-type'];
					}
					// Only set Authorization header if not already set (to avoid overwriting refreshed token)
					if (accessToken && !cnf.headers['Authorization']) {
						cnf.headers['Authorization'] = `Bearer ${accessToken}`;
					}
					cnf.headers['Accept-Language'] = currentLocaleCode ?? 'en';
					const browserId = getBrowserId();
					if (browserId) cnf.headers['X-Browser-ID'] = browserId;
					return cnf;
				},
				error => {
					if (config?.showErrors !== false) handleError(error);
					return Promise.reject(error);
				},
			);

			instance.interceptors.response.use(
				response => response,
				async error => {
					const originalRequest = error.config ?? {};
					const statusCode = error.response?.status;
					const requestUrl = originalRequest.url || '';

					// Detect authentication errors - check both status code AND message
					const errorMessage = typeof error.response?.data?.message === 'string' 
						? error.response.data.message.toLowerCase() 
						: '';
					const isAuthorizationFailure = isAuthorizationError(
						statusCode,
						errorMessage,
					);

					if (isAuthorizationFailure) {
						enqueueForbiddenError(
							createForbiddenErrorState(
								error,
								originalRequest,
								requestUrl,
								statusCode,
								config?.method,
							),
						);

						onError?.(error, {
							url: requestUrl,
							method: originalRequest.method,
							statusCode,
						});

						return Promise.reject(error);
					}

					const isAuthRelatedEndpoint = requestUrl.includes('/auth/');
					const isOAuthCallbackEndpoint =
						requestUrl.includes('/oauth/') && requestUrl.includes('/callback/');
					const isAuthError = 
						statusCode === 401 ||
						(statusCode === 400 && isAuthRelatedEndpoint && requestUrl.includes('/auth/verify')) ||
						isTokenErrorMessage(errorMessage);
					// Don't retry login/refresh endpoints or already retried requests
					const shouldNotRetry = 
						originalRequest._retry ||
						isOAuthCallbackEndpoint ||
						originalRequest.url?.includes('/auth/login') ||
						originalRequest.url?.includes('/auth/refresh') ||
						originalRequest.url?.includes('/auth/signup');

					if (isAuthError && !shouldNotRetry) {
						// If already refreshing, queue this request
						if (isRefreshingRef.current) {
							return new Promise((resolve, reject) => {
								failedQueueRef.current.push({ resolve, reject });
							})
								.then(token => {
									originalRequest.headers['Authorization'] = `Bearer ${token}`;
									return instance(originalRequest);
								})
								.catch(err => {
									return Promise.reject(err);
								});
						}

						// Mark request as retried and start refresh process
						originalRequest._retry = true;
						isRefreshingRef.current = true;

						// Snapshot tokens before the attempt so we can detect cross-tab rotation
						const failedAccessToken = (originalRequest.headers?.['Authorization'] as string)?.replace('Bearer ', '') ?? '';
						const refreshTokenSnapshot = typeof window !== 'undefined'
							? readLocalStorageToken(LocalStorageKeys.RefreshToken)
							: refreshToken;

						// Core refresh logic — runs inside Web Locks when available.
						// After acquiring the lock, checks if another tab already refreshed before calling the API.
						const doRefresh = async (): Promise<string | null> => {
							const latest = typeof window !== 'undefined'
								? readLocalStorageToken(LocalStorageKeys.AccessToken) || null
								: null;
							if (latest && latest !== failedAccessToken && latest !== '') return latest;
							return refreshTokenRequest();
						};

						try {
							// Web Locks API serializes refresh across tabs: only one tab runs doRefresh
							// at a time; others wait and then reuse the winner's token from localStorage.
							const newToken = typeof window !== 'undefined' && 'locks' in navigator
								? await (navigator as any).locks.request('hedhog-auth-refresh', doRefresh)
								: await doRefresh();

							if (!newToken) {
								throw error;
							}

							// Update token in state
							setAccessToken(newToken);

							// Process all queued requests with the new token
							processQueue(null, newToken);

							// Notify other tabs immediately so they don't need to wait for the storage event
							broadcastChannelRef.current?.postMessage({
								type: 'TOKEN_REFRESHED',
								accessToken: newToken,
								refreshToken: typeof window !== 'undefined'
									? readLocalStorageToken(LocalStorageKeys.RefreshToken)
									: '',
							});

							originalRequest.headers = originalRequest.headers ?? {};
							originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
							return instance(originalRequest);

						} catch (refreshError) {
							// Fallback for browsers without Web Locks: if localStorage was updated by
							// another tab while this request was in flight, reuse their tokens.
							if (typeof window !== 'undefined') {
								const latestAccessToken = readLocalStorageToken(LocalStorageKeys.AccessToken) || null;
								const latestRefreshToken = readLocalStorageToken(LocalStorageKeys.RefreshToken) || null;

								if (
									latestRefreshToken &&
									latestRefreshToken !== refreshTokenSnapshot &&
									latestAccessToken
								) {
									setAccessToken(latestAccessToken);
									setRefreshToken(latestRefreshToken);
									processQueue(null, latestAccessToken);

									originalRequest.headers = originalRequest.headers ?? {};
									originalRequest.headers['Authorization'] = `Bearer ${latestAccessToken}`;
									return instance(originalRequest);
								}
							}

							processQueue(refreshError, null);

							try {
								const logoutInstance = axios.create({
									baseURL: apiBaseUrl,
									withCredentials: true,
								});
								await logoutInstance.post('/auth/logout', refreshToken ? { refreshToken } : {});
							} catch {
								// Ignore logout errors after refresh failure; local session cleanup still proceeds.
							}

							clearSessionState();

							if (!hasShownSessionExpiredRef.current) {
								hasShownSessionExpiredRef.current = true;
								toaster.error('Sessão expirada. Faça login novamente.');
							}

							if (typeof window !== 'undefined' && !isRedirectingToLoginRef.current) {
								isRedirectingToLoginRef.current = true;
								rememberCurrentUrl();
								router.push('/login');
							}

							return Promise.reject(refreshError);
						} finally {
							isRefreshingRef.current = false;
						}
					}

					// Surface every real (non-cancelled) API error to the optional global
					// handler, regardless of `showErrors`, so a host app can render a modal
					// even for calls that intentionally suppress the toast.
					const isCanceled =
						axios.isCancel?.(error) ||
						error?.code === 'ERR_CANCELED' ||
						error?.name === 'CanceledError';
					if (!isCanceled) {
						onError?.(error, {
							url: requestUrl,
							method: originalRequest.method,
							statusCode,
						});
					}

					// For non-auth errors, show error message if configured
					if (config?.showErrors !== false) handleError(error);
					return Promise.reject(error);
				},
			);

			return instance.request<T>(config ?? {});
		},
		[
			accessToken,
			currentLocaleCode,
			apiBaseUrl,
			setAccessToken,
			setRefreshToken,
			processQueue,
			refreshTokenRequest,
			toaster,
			isAuthorizationError,
			isTokenErrorMessage,
			createForbiddenErrorState,
			enqueueForbiddenError,
			clearSessionState,
			rememberCurrentUrl,
			refreshToken,
			router,
			onError,
		],
	);

	// STABLE identity for `request`. Consumers that put `request` in effect
	// dependency arrays (a pattern used throughout the app) will no longer
	// re-trigger — and abort the in-flight request — on every token/locale/router
	// change, which used to keep pages stuck in "loading". Call behavior is
	// identical: the wrapper always delegates to the latest implementation via ref.
	const requestImplRef = useRef(requestImpl);
	requestImplRef.current = requestImpl;
	const request = useCallback(
		<T extends {}>(config?: AxiosRequestConfig & { showErrors?: boolean }) =>
			requestImplRef.current<T>(config),
		[],
	);

	const { data: user, refetch: refetchUser } = useQuery({
		queryKey: ['user', accessToken],
		queryFn: async () => {
			if (!accessToken) return null;
			const response = await request<User>({ url: '/auth/verify', showErrors: false });
			return response.data;
		},
		enabled: !!accessToken,
		refetchOnMount: false,
		refetchOnReconnect: false,
	});

	const userEmail = user?.user_identifier?.find((id: { type: string; }) => id.type === 'email')?.value || '';
	const userPhotoUrl = user?.photo_id 
		? `${apiBaseUrl}/file/open/${user.photo_id}`
		: '/placeholder.png';
	const userAbbr = user?.name?.split(' ').map((word: string) => word.charAt(0).toUpperCase()).join('') || '';

	const parseToken = (token: string) => {
		if (!token) return;
		try {
			const parts = token.split('.');
			if (parts.length !== 3 || !parts[1]) throw new Error('Invalid token format');
			JSON.parse(decode(parts[1]));
			// Expired tokens are NOT cleared here — the request interceptor handles them reactively
			// by attempting a refresh on 401, preserving the enabled state of dependent queries.
		} catch (error) {
			handleError(error);
		}
	};

	const getUrlAfterLogin = () => {
		const url = urlAfterLogin;
		setUrlAfterLogin('/');
		return url;
	};

	const login = async (email: string, password: string) => {
		const { data } = await request<RequestLoginType>({
			method: 'POST',
			url: '/auth/login',
			data: { email, password },
			showErrors: false,
		});

		if (data.requiresEmailVerification && data.token) {
			return { 
				requiresEmailVerification: true, 
				token: data.token 
			};
		}

		if (data.requiresMfa && data.mfaToken) {
			return { 
				requiresMfa: true, 
				mfaToken: data.mfaToken,
				mfaMethods: data.mfaMethods 
			};
		}

		if (!data.accessToken) throw new Error('Login failed');
		if (data.hasMfa) return { accessToken: data.accessToken, hasMfa: true };

		parseToken(data.accessToken);
		if (data.refreshToken) {
			setRefreshToken(data.refreshToken);
		}
		setAccessToken(data.accessToken);
		return {
			accessToken: data.accessToken,
			hasMfa: false,
			requiresPasswordReset: data.requiresPasswordReset === true,
		};
	};

	const forgot = async (email: string) => {
		await request({ url: '/auth/forgot', method: 'POST', data: { email } });
	};

	const signup = async (data: RegisterForm) => {
		const { data: response } = await request<RequestSignupType>({
			url: '/auth/signup',
			method: 'POST',
			data,
			showErrors: false,
		});

		if (!response.user) throw new Error('Signup failed');
		if (response.hasChallenge) return { accessToken: '', hasChallenge: true };
		if (response.accessToken) {
			parseToken(response.accessToken);
			if (response.refreshToken) {
				setRefreshToken(response.refreshToken);
			}
			setAccessToken(response.accessToken);
			return { accessToken: response.accessToken, hasChallenge: false };
		}
		throw new Error('Signup failed');
	};

	const resetPassword = async (code: string, newPassword: string, confirmNewPassword: string) => {
		if (newPassword !== confirmNewPassword) {
			throw new Error('Passwords do not match');
		}

		let data: RequestLoginType | undefined;

		try {
			const response = await request<RequestLoginType>({
				url: '/auth/forgot-reset',
				method: 'POST',
				data: { code, password: newPassword },
				showErrors: false,
			});

			data = response.data;
		} catch (error: any) {
			const statusCode = error?.response?.status;
			if (statusCode !== 404) {
				throw error;
			}

			const fallbackResponse = await request<RequestLoginType>({
				url: '/auth/reset',
				method: 'POST',
				data: { code, newPassword, confirmNewPassword },
				showErrors: false,
			});

			data = fallbackResponse.data;
		}

		if (!data) {
			throw new Error('Reset password failed');
		}

		if (data.refreshToken) {
			setRefreshToken(data.refreshToken);
		}
		if (data.accessToken) setAccessToken(data.accessToken);
	};

	const showToastHandler = (type: 'success' | 'error', name: string, action = '', error: any = null) => {
		if (type === 'success') {
			toaster.success(`${name} ${action}`);
		} else {
			toaster.error(`${name}: ${error?.message || ''}`);
		}
	};

	const logout = async () => {
		try {
			// Call server logout to clear refresh token cookie
			await request({ 
				url: '/auth/logout', 
				method: 'POST', 
				showErrors: false 
			});
		} catch (error) {
			// Even if server logout fails, we still clear client-side.
		} finally {
			clearSessionState();
			
			if (typeof window !== 'undefined') {
				clearStoredFormDrafts();
				rememberCurrentUrl();
				window.location.href = '/login';
			}
		}
	};

	const getSettingValue = useCallback((key: string) => {
		
		try {
			const settings = JSON.parse(settingsState || '{}');

			if (!(key in settings)) {
				return null;
			}

			return settings[key];
		} catch (error) {
			console.error('Failed to get setting', error);
			return null;
		}
	}, [settingsState]);

	const setSettingValue = async (key: string, value: any) => {
		try {
      await request({
        url: `/setting/${key}`,
        method: 'PUT', 
        data: { value },
      });
		
			const settings = JSON.parse(settingsState || '{}');
			const sensitiveKeys = new Set([
				'ai-openai-api-key',
				'ai-gemini-api-key',
			]);

			if (sensitiveKeys.has(key)) {
				delete settings[key];
			} else {
				settings[key] = value;
			}

			setSettingsState(JSON.stringify(settings));
			
    } catch (error) {
			console.error('Failed to update setting', error);
    }
	}

	useEffect(() => {
		parseToken(accessToken);

		if (accessToken) {
			hasShownSessionExpiredRef.current = false;
			isRedirectingToLoginRef.current = false;
		}
	}, [accessToken]);

	// Cross-tab token sync: when another tab successfully refreshes, update this tab immediately
	// without waiting for the localStorage storage event (which has latency and may be missed).
	useEffect(() => {
		if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;

		const channel = new BroadcastChannel('hedhog-auth');
		broadcastChannelRef.current = channel;

		channel.onmessage = (event: MessageEvent) => {
			if (event.data?.type !== 'TOKEN_REFRESHED') return;
			setAccessToken(event.data.accessToken);
			if (event.data.refreshToken) {
				setRefreshToken(event.data.refreshToken);
			}
			hasShownSessionExpiredRef.current = false;
			isRedirectingToLoginRef.current = false;
		};

		return () => {
			channel.close();
			broadcastChannelRef.current = null;
		};
	}, [setAccessToken, setRefreshToken]);

	// Proactive refresh on tab focus: if the access token is expired or expiring within 60s,
	// refresh silently before any request fails, avoiding the "session expired" toast entirely.
	useEffect(() => {
		if (typeof window === 'undefined') return;

		const handleVisibilityChange = async () => {
			if (document.visibilityState !== 'visible') return;
			if (isRefreshingRef.current) return;

			const currentAccessToken = readLocalStorageToken(LocalStorageKeys.AccessToken);
			const currentRefreshToken = readLocalStorageToken(LocalStorageKeys.RefreshToken);

			if (!currentRefreshToken) return;

			const isExpiredOrExpiringSoon = (() => {
				if (!currentAccessToken) return true;
				try {
					const parts = currentAccessToken.split('.');
					if (parts.length !== 3 || !parts[1]) return true;
					const parsed = JSON.parse(decode(parts[1]));
					return parsed.exp * 1000 < Date.now() + 60 * 1000;
				} catch {
					return true;
				}
			})();

			if (!isExpiredOrExpiringSoon) return;

			isRefreshingRef.current = true;
			try {
				const newToken = await refreshTokenRequest();
				if (newToken) {
					setAccessToken(newToken);
					processQueue(null, newToken);
					broadcastChannelRef.current?.postMessage({
						type: 'TOKEN_REFRESHED',
						accessToken: newToken,
						refreshToken: readLocalStorageToken(LocalStorageKeys.RefreshToken),
					});
					hasShownSessionExpiredRef.current = false;
					isRedirectingToLoginRef.current = false;
				}
			} catch {
				// Silent failure — if the refresh token itself is invalid, the next request
				// will trigger the reactive flow and show the session-expired toast.
			} finally {
				isRefreshingRef.current = false;
			}
		};

		document.addEventListener('visibilitychange', handleVisibilityChange);
		return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
	}, [refreshTokenRequest, setAccessToken, processQueue]);

	useEffect(() => {
		if (getStoredThemeSource() === 'explicit') {
			return;
		}

		const fallbackTheme = isThemeMode(settings['theme-mode'])
			? settings['theme-mode']
			: 'system';

		if (currentTheme !== fallbackTheme) {
			setStoredCurrentTheme(fallbackTheme);
		}
	}, [currentTheme, settings, setStoredCurrentTheme]);

	return (
		<AppContext.Provider
			value={{
				login,
				forgot,
				resetPassword,
				signup,
				user,
				clearUserData: () => clearSessionState(),
				accessToken,
				setAccessToken,
				request,
				logout,
				showToastHandler,
				getUrlAfterLogin,
				setUrlAfterLogin,
				getErrorMessage,
				userEmail,
				userPhotoUrl,
				userAbbr,
				locales,
				currentLocaleCode,
				setCurrentLocaleCode,
				currentTheme,
				setCurrentTheme,
				density,
				setDensity,
				zoom,
				setZoom,
				refetchUser,
				getSettingValue,
				setSettingValue,
				forbiddenError,
				setForbiddenError: setForbiddenErrorState,
			}}
		>
			{children}
		</AppContext.Provider>
	);
}

export const AppProvider = ({children, toast: _, queryClient, settings, locales, bprogressConfig, onError}: AppProviderProps) => {
	const settingsApiBaseUrl =
		typeof settings['api-base-url'] === 'string'
			? settings['api-base-url'].trim()
			: typeof settings['api_base_url'] === 'string'
				? settings['api_base_url'].trim()
				: undefined;
	const [accessToken, setAccessToken] = useLocalStorage(LocalStorageKeys.AccessToken, '');
	const [urlAfterLogin, setUrlAfterLogin] = useLocalStorage(LocalStorageKeys.UrlAfterLogin, '/');
	const client = queryClient || defaultQueryClient;

	return (
		<ProgressProvider {...bprogressConfig} color={settings['theme-primary-light'] || settings['theme-primary-dark'] || '#000000'}>
			<QueryClientProvider client={client}>
				<AppContextProvider
					accessToken={accessToken}
					setAccessToken={setAccessToken}
					urlAfterLogin={urlAfterLogin}
					setUrlAfterLogin={setUrlAfterLogin}
					settings={settings}
					apiBaseUrl={settingsApiBaseUrl}
					toast={_}
					locales={locales}
					onError={onError}
				>
					{children}
				</AppContextProvider>
			</QueryClientProvider>
		</ProgressProvider>
	);
};

export const useApp = () => {
	const context = useContext(AppContext);

	if (!context) {
		throw new Error('useApp must be used within an AppProvider');
	}

	return context;
};
