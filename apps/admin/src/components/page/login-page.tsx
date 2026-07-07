'use client';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  formatIntegrationProviderName,
  IntegrationLogo,
  normalizeIntegrationProvider,
} from '@/components/ui/integration-logo';
import { useFormDraft } from '@/hooks/use-form-draft';
import { formatDateTime } from '@/lib/format-date';
import { useApp } from '@hed-hog/next-app-provider';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { Eye, EyeOff, Fingerprint, Loader2, Shield, Wrench } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { LanguageSelector } from '../language-selector';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type ProviderConfig = {
  id: string;
  name: string;
};

const OAUTH_PROVIDER_TOGGLE_MAP: Array<{
  settingSlug: string;
  provider: ProviderConfig;
}> = [
  {
    settingSlug: 'oauth-facebook-enabled',
    provider: { id: 'facebook', name: 'Facebook' },
  },
  {
    settingSlug: 'oauth-github-enabled',
    provider: { id: 'github', name: 'GitHub' },
  },
  {
    settingSlug: 'oauth-google-enabled',
    provider: { id: 'google', name: 'Google' },
  },
  {
    settingSlug: 'oauth-microsoft-enabled',
    provider: { id: 'microsoft', name: 'Microsoft' },
  },
  {
    settingSlug: 'oauth-microsoft-entra-id-enabled',
    provider: { id: 'microsoft-entra-id', name: 'Microsoft Entra ID' },
  },
  {
    settingSlug: 'oauth-apple-enabled',
    provider: { id: 'apple', name: 'Apple' },
  },
  {
    settingSlug: 'oauth-linkedin-enabled',
    provider: { id: 'linkedin', name: 'LinkedIn' },
  },
];

type LoginDraftPayload = {
  email: string;
};

type PendingMfaState = {
  mfaToken: string;
  mfaMethods: Array<{ type?: string }>;
};

const LOGIN_PAGE_DRAFT_STORAGE_KEY = 'core-login-page-draft';

export function LoginPage() {
  const router = useRouter();
  const {
    login,
    getSettingValue,
    showToastHandler,
    getErrorMessage,
    getUrlAfterLogin,
    currentLocaleCode,
    request,
    setAccessToken,
  } = useApp();
  const [loading, setLoading] = useState(false);
  const [loadingProviderId, setLoadingProviderId] = useState<string | null>(
    null
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showEmergencyPasswordForm, setShowEmergencyPasswordForm] =
    useState(false);
  const [showMaintenanceLogin, setShowMaintenanceLogin] = useState(false);
  const [titleSecretTapCount, setTitleSecretTapCount] = useState(0);
  const [titleSecretTapStartedAt, setTitleSecretTapStartedAt] = useState<
    number | null
  >(null);
  const emergencyUnlockTimeoutRef = useRef<number | null>(null);
  const [pendingMfa, setPendingMfa] = useState<PendingMfaState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('core.LoginPage');

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  const disableAuthenticationWithEmailAndPassword = isHydrated
    ? getSettingValue('disable-authentication-with-email-and-password') || false
    : false;
  const isMaintenanceMode = isHydrated
    ? getSettingValue('maintenance-mode-enabled') === true
    : false;
  const shouldShowEmailAndPasswordForm =
    !disableAuthenticationWithEmailAndPassword || showEmergencyPasswordForm;
  const shouldShowLoginContent = !isMaintenanceMode || showMaintenanceLogin;
  const providers: ProviderConfig[] = isHydrated
    ? OAUTH_PROVIDER_TOGGLE_MAP.filter(
        ({ settingSlug }) => getSettingValue(settingSlug) === true
      ).map(({ provider }) => provider)
    : [];

  type LoginForm = z.infer<typeof loginSchema>;
  const loginSchema = z.object({
    email: z
      .string({ required_error: t('emailRequired') })
      .email(t('emailInvalid')),
    password: z
      .string({ required_error: t('passwordRequired') })
      .min(6, t('passwordMinLength')),
  });

  const form = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const watchedValues = useWatch({
    control: form.control,
  });

  const {
    clearDraft,
    loadDraft,
    hasDraft,
    savedAt: draftSavedAt,
  } = useFormDraft<LoginDraftPayload>({
    storageKey: LOGIN_PAGE_DRAFT_STORAGE_KEY,
    value: {
      // Defensive fallback: RHF's defaultValues ({ email: '' }) make
      // watchedValues.email always a defined string, so the `?? ''` branch is
      // never exercised in practice.
      /* v8 ignore next */
      email: watchedValues.email ?? '',
    },
    // Same defensive fallback as above; watchedValues.email is never nullish
    // given the form's defaultValues.
    /* v8 ignore next */
    hasData: (watchedValues.email ?? '').trim().length > 0,
    enabled: shouldShowEmailAndPasswordForm,
  });

  const draftStatusContent = useMemo(() => {
    if (!hasDraft || !draftSavedAt) {
      return null;
    }

    const savedDate = new Date(draftSavedAt);
    if (Number.isNaN(savedDate.getTime())) {
      return null;
    }

    const locale = currentLocaleCode.startsWith('pt') ? ptBR : enUS;
    const relativeLabel = formatDistanceToNow(savedDate, {
      addSuffix: true,
      locale,
    });
    const absoluteLabel = formatDateTime(
      savedDate,
      getSettingValue,
      currentLocaleCode
    );

    return currentLocaleCode.startsWith('pt')
      ? `Rascunho salvo ${relativeLabel} • Último salvamento: ${absoluteLabel}`
      : `Draft saved ${relativeLabel} • Last saved: ${absoluteLabel}`;
  }, [draftSavedAt, currentLocaleCode, getSettingValue, hasDraft]);

  const hasWebAuthnMfa =
    pendingMfa?.mfaMethods.some((method) => method.type === 'webauthn') ?? false;
  const hasAlternativeMfaMethods =
    pendingMfa?.mfaMethods.some((method) => method.type !== 'webauthn') ?? false;

  const finishLogin = (requiresPasswordReset?: boolean) => {
    if (requiresPasswordReset) {
      router.push('/core/account/password?required=1');
      return;
    }

    const afterUrl = getUrlAfterLogin();
    router.push(afterUrl && !afterUrl.startsWith('/login') ? afterUrl : '/');
  };

  const onSubmit = async (data: LoginForm) => {
    if (loading) return;

    setLoadingProviderId(null);
    setPendingMfa(null);
    setLoading(true);
    setError(null);

    try {
      const response = await login(data.email, data.password);

      if (response?.requiresEmailVerification && response?.token) {
        clearDraft();
        showToastHandler('success', t('mfaVerificationMessage'));
        router.push(
          `/email-verification?token=${encodeURIComponent(response.token)}`
        );
        return;
      }

      if (response?.requiresMfa && response?.mfaToken) {
        clearDraft();
        const mfaMethods = response?.mfaMethods || [];

        if (mfaMethods.some((method) => method?.type === 'webauthn')) {
          setPendingMfa({
            mfaToken: response.mfaToken,
            mfaMethods,
          });
          showToastHandler('success', t('securityKeyAvailableMessage'));
          setLoading(false);
        } else {
          const methodsParam = encodeURIComponent(JSON.stringify(mfaMethods));
          showToastHandler('success', t('mfaVerificationMessage'));
          router.push(
            `/mfa?token=${encodeURIComponent(response.mfaToken)}&methods=${methodsParam}`
          );
        }
        return;
      }

      clearDraft();
      showToastHandler?.('success', t('loginSuccess'));
      finishLogin(response?.requiresPasswordReset);
    } catch (error) {
      setError(getErrorMessage(error));
      setLoading(false);
    }
  };

  const handleSecurityKeyLogin = async () => {
    // Defensive guard: this handler is only reachable by clicking the
    // security-key button, which only renders when `pendingMfa` (with a
    // truthy `mfaToken`) is set, and is `disabled` while `loading`; neither
    // sub-condition can become true through the rendered UI.
    /* v8 ignore next 3 */
    if (!pendingMfa?.mfaToken || loading) {
      return;
    }

    setLoading(true);
    setLoadingProviderId(null);
    setError(null);

    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const optionsResponse = await request<
        Parameters<typeof startAuthentication>[0]
      >({
        url: '/auth/webauthn/generate',
        method: 'POST',
        data: { mfaToken: pendingMfa.mfaToken },
      });

      if (!optionsResponse.data) {
        throw new Error(t('securityKeyUnavailable'));
      }

      const assertion = await startAuthentication(optionsResponse.data);
      const verifyResponse = await request<{
        accessToken: string;
        refreshToken?: string;
        requiresPasswordReset?: boolean;
      }>({
        url: '/auth/webauthn/verify',
        method: 'POST',
        data: {
          mfaToken: pendingMfa.mfaToken,
          assertionResponse: assertion,
        },
      });

      if (!verifyResponse.data?.accessToken) {
        throw new Error(t('securityKeyUnavailable'));
      }

      setAccessToken(verifyResponse.data.accessToken);
      clearDraft();
      showToastHandler?.('success', t('loginSuccess'));
      finishLogin(verifyResponse.data.requiresPasswordReset);
    } catch (error) {
      setError(getErrorMessage(error));
      setLoading(false);
    }
  };

  const handleUseAnotherMethod = () => {
    // Defensive guard: the "use another method" button is only rendered when
    // `pendingMfa` (with a truthy `mfaToken`) is set, so this condition can
    // never be true through the rendered UI.
    /* v8 ignore next 3 */
    if (!pendingMfa?.mfaToken) {
      return;
    }

    const methodsParam = encodeURIComponent(JSON.stringify(pendingMfa.mfaMethods));
    router.push(
      `/mfa?token=${encodeURIComponent(pendingMfa.mfaToken)}&methods=${methodsParam}`
    );
  };

  useEffect(() => {
    if (!shouldShowEmailAndPasswordForm) {
      return;
    }

    const storedDraft = loadDraft();
    if (!storedDraft?.payload.email) {
      return;
    }

    form.reset({
      email: storedDraft.payload.email,
      password: '',
    });
  }, [form, loadDraft, shouldShowEmailAndPasswordForm]);

  useEffect(() => {
    return () => {
      if (emergencyUnlockTimeoutRef.current !== null) {
        window.clearTimeout(emergencyUnlockTimeoutRef.current);
      }
    };
  }, []);

  const handleTitleSecretClick = (event: MouseEvent<HTMLHeadingElement>) => {
    if (!disableAuthenticationWithEmailAndPassword) return;

    // Hidden unlock: require Shift+Alt and 5 clicks inside a short window.
    if (!event.shiftKey || !event.altKey) {
      setTitleSecretTapCount(0);
      setTitleSecretTapStartedAt(null);
      return;
    }

    const now = Date.now();
    const secretWindowMs = 8000;

    if (
      titleSecretTapStartedAt === null ||
      now - titleSecretTapStartedAt > secretWindowMs
    ) {
      setTitleSecretTapStartedAt(now);
      setTitleSecretTapCount(1);
      return;
    }

    const nextCount = titleSecretTapCount + 1;

    if (nextCount < 5) {
      setTitleSecretTapCount(nextCount);
      return;
    }

    setShowEmergencyPasswordForm(true);
    setTitleSecretTapCount(0);
    setTitleSecretTapStartedAt(null);

    if (emergencyUnlockTimeoutRef.current !== null) {
      window.clearTimeout(emergencyUnlockTimeoutRef.current);
    }

    emergencyUnlockTimeoutRef.current = window.setTimeout(() => {
      setShowEmergencyPasswordForm(false);
    }, 120000);
  };

  const handleProviderLogin = (providerId: string) => {
    // Defensive guard: every OAuth provider button shares the same
    // `disabled={loading}` state, so this handler can't be re-entered while a
    // login is already in flight through the rendered UI.
    /* v8 ignore next */
    if (loading) return;

    setError(null);
    setLoadingProviderId(providerId);
    setLoading(true);
    // OAuth redirect is handled by the <Link href> wrapping the button
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background transition-colors">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full max-w-sm p-8 rounded-lg shadow-lg bg-card"
        >
          <h2
            className="text-2xl font-bold mb-6 text-center"
            onClick={handleTitleSecretClick}
          >
            {t('title')}
          </h2>
          <div className="mb-6 flex justify-center">
            <LanguageSelector />
          </div>

          {!shouldShowLoginContent && (
            <div className="space-y-5">
              <div className="relative overflow-hidden rounded-2xl border border-amber-300/70 bg-linear-to-br from-amber-50 via-background to-amber-100/70 p-5 text-amber-900 shadow-sm dark:border-amber-400/30 dark:from-amber-500/10 dark:via-zinc-950 dark:to-amber-900/20 dark:text-amber-100">
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-300/20 blur-2xl dark:bg-amber-300/10" />
                <div className="relative flex items-start gap-3">
                  <div className="mt-0.5 rounded-md border border-amber-400/40 bg-amber-100/80 p-2 dark:border-amber-400/30 dark:bg-amber-500/20">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-semibold tracking-tight">
                      {currentLocaleCode.startsWith('pt')
                        ? 'Sistema em manutenção'
                        : 'System under maintenance'}
                    </p>
                    <p className="text-xs text-amber-800/90 dark:text-amber-100/85">
                      {currentLocaleCode.startsWith('pt')
                        ? 'Estamos realizando melhorias no momento para garantir mais estabilidade e desempenho.'
                        : 'We are currently applying improvements to ensure better stability and performance.'}
                    </p>
                    <p className="text-xs text-amber-700/80 dark:text-amber-100/70">
                      {currentLocaleCode.startsWith('pt')
                        ? 'Tente novamente em alguns minutos.'
                        : 'Please try again in a few minutes.'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground/90 hover:text-foreground"
                  onClick={() => setShowMaintenanceLogin(true)}
                >
                  {currentLocaleCode.startsWith('pt')
                    ? 'Acessar login'
                    : 'Access login'}
                </Button>
              </div>
            </div>
          )}

          {shouldShowLoginContent && shouldShowEmailAndPasswordForm && (
            <div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('emailLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder={t('emailPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className="mt-4">
                    <FormLabel>{t('passwordLabel')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          placeholder={t('passwordPlaceholder')}
                          {...field}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={
                            showPassword ? t('hidePassword') : t('showPassword')
                          }
                        >
                          {showPassword ? (
                            <EyeOff size={20} />
                          ) : (
                            <Eye size={20} />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {draftStatusContent ? (
                <p className="mt-4 text-xs text-muted-foreground">
                  {draftStatusContent}
                </p>
              ) : null}
              <div className="mt-4 flex justify-end">
                <a
                  href="/forgot"
                  className="text-sm text-primary hover:underline"
                >
                  {t('forgotPassword')}
                </a>
              </div>
              {error && (
                <div className="mt-4">
                  <Alert variant="destructive">
                    <AlertTitle>{t('errorTitle')}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              )}
              {pendingMfa && hasWebAuthnMfa ? (
                <div className="mt-6 space-y-3">
                  <div className="rounded-lg border bg-muted/40 p-4">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-primary/10 p-2 text-primary">
                        <Shield className="size-4" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-medium">
                          {t('securityKeyPromptTitle')}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {t('securityKeyPromptDescription')}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    disabled={loading}
                    className="w-full"
                    onClick={handleSecurityKeyLogin}
                  >
                    {loading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" />
                        {t('securityKeyButtonLoading')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-2">
                        <Fingerprint className="size-4" />
                        {t('securityKeyButton')}
                      </span>
                    )}
                  </Button>

                  {hasAlternativeMfaMethods ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={handleUseAnotherMethod}
                      disabled={loading}
                    >
                      {t('otherMfaMethodsButton')}
                    </Button>
                  ) : null}

                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setPendingMfa(null);
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    {t('backToPasswordButton')}
                  </Button>
                </div>
              ) : (
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-6"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" />
                      {t('loginButtonLoading')}
                    </span>
                  ) : (
                    t('loginButton')
                  )}
                </Button>
              )}

              {providers.length > 0 && <hr className="my-8" />}
            </div>
          )}

          {shouldShowLoginContent && (
            <div className="w-full flex flex-col justify-center items-center gap-2">
              {providers.map((p) => (
                <Link
                  key={String(p.id)}
                  className="w-full"
                  href={`${process.env.NEXT_PUBLIC_API_BASE_URL}/oauth/${normalizeIntegrationProvider(String(p.id))}/login`}
                >
                  <Button
                    type="button"
                    className="w-full"
                    variant="outline"
                    disabled={loading}
                    onClick={() => handleProviderLogin(String(p.id))}
                  >
                    {loading && loadingProviderId === String(p.id) ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        <span>{t('loginButtonLoading')}</span>
                      </>
                    ) : (
                      <>
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-white">
                          <IntegrationLogo
                            provider={String(p.id)}
                            size={16}
                            decorative
                          />
                        </span>
                        <span>
                          {t('loginWith')}{' '}
                          {formatIntegrationProviderName(String(p.id), p.name)}
                        </span>
                      </>
                    )}
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </form>
      </Form>
    </div>
  );
}
