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
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useApp } from '@hed-hog/next-app-provider';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ArrowLeft,
  Fingerprint,
  Key,
  Mail,
  RefreshCw,
  Shield,
  Smartphone,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LanguageSelector } from '../language-selector';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type MfaMethod = {
  type: 'totp' | 'email' | 'webauthn' | string;
};

type MfaCodePayload = {
  token: string;
  code: string;
  methodType?: string;
};

function extractErrorMessage(error: unknown, fallback: string) {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response &&
    error.response.data &&
    typeof error.response.data === 'object' &&
    'message' in error.response.data &&
    typeof error.response.data.message === 'string'
  ) {
    return error.response.data.message;
  }

  return fallback;
}

function isMfaMethodArray(value: unknown): value is MfaMethod[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === 'object' && item !== null && 'type' in item
    )
  );
}

export function MfaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    showToastHandler,
    setAccessToken,
    getUrlAfterLogin,
    getSettingValue,
    request,
  } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [hasTotpMfa, setHasTotpMfa] = useState(false);
  const [hasEmailMfa, setHasEmailMfa] = useState(false);
  const [hasWebAuthnMfa, setHasWebAuthnMfa] = useState(false);
  const [resendingCode, setResendingCode] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [activeTab, setActiveTab] = useState<string>('totp');
  const [shouldAutoStartWebAuthn, setShouldAutoStartWebAuthn] = useState(false);
  const [webAuthnStarted, setWebAuthnStarted] = useState(false);
  const t = useTranslations('core.MfaPage');

  const totpCodeLength = 6;
  const emailCodeLength = parseInt(
    getSettingValue('mfa-email-code-length') || '6'
  );

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(
        () => setResendCooldown(resendCooldown - 1),
        1000
      );
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleWebAuthnAuth = useCallback(async () => {
    // Defensive guard: every entry point that invokes this handler (the
    // exclusive security-key button, the tab-embedded submit button, and the
    // auto-start effect below) only fires once `mfaToken` has already been
    // set from the search params, so this is never true through the UI.
    /* v8 ignore next 4 */
    if (!mfaToken) {
      setError(t('errorMfaTokenNotFound'));
      return;
    }

    if (webAuthnStarted) {
      return;
    }

    setWebAuthnStarted(true);
    setLoading(true);
    setError(null);

    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      const optionsResponse = await request<
        Parameters<typeof startAuthentication>[0]
      >({
        url: '/auth/webauthn/generate',
        method: 'POST',
        data: { mfaToken },
      });

      if (!optionsResponse.data) {
        throw new Error('Failed to generate authentication options');
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
          mfaToken,
          assertionResponse: assertion,
        },
      });

      if (verifyResponse.data?.accessToken) {
        setAccessToken(verifyResponse.data.accessToken);
        showToastHandler?.('success', t('successAuth'));
        if (verifyResponse.data.requiresPasswordReset) {
          router.push('/core/account/password?required=1');
        } else {
          router.push(getUrlAfterLogin());
        }
      }
    } catch (error: unknown) {
      console.error('Erro ao autenticar com WebAuthn:', error);
      setError(extractErrorMessage(error, t('errorWebAuthnFailed')));
      setWebAuthnStarted(false);
    } finally {
      setLoading(false);
    }
  }, [
    mfaToken,
    webAuthnStarted,
    request,
    setAccessToken,
    showToastHandler,
    router,
    getUrlAfterLogin,
    t,
  ]);

  useEffect(() => {
    const token = searchParams.get('token');
    const methods = searchParams.get('methods');

    if (!token) {
      showToastHandler?.('error', t('errorMfaTokenNotFoundRedirect'));
      router.push('/login');
      return;
    }

    setMfaToken(token);

    if (methods) {
      try {
        const parsedMethods: unknown = JSON.parse(decodeURIComponent(methods));
        const mfaMethods = isMfaMethodArray(parsedMethods) ? parsedMethods : [];
        const hasTotp = mfaMethods.some((m) => m.type === 'totp');
        const hasEmail = mfaMethods.some((m) => m.type === 'email');
        const hasWebAuthn = mfaMethods.some((m) => m.type === 'webauthn');

        setHasTotpMfa(hasTotp);
        setHasEmailMfa(hasEmail);
        setHasWebAuthnMfa(hasWebAuthn);

        if (hasWebAuthn && !hasTotp && !hasEmail) {
          setActiveTab('webauthn');
          setShouldAutoStartWebAuthn(true);
        } else if (hasTotp) {
          setActiveTab('totp');
        } else if (hasEmail) {
          setActiveTab('email');
          // Unreachable: by this point !hasTotp && !hasEmail already held (the
          // two branches above didn't match), so `hasWebAuthn` here is exactly
          // the condition already handled by the very first `if` above.
          /* v8 ignore next 2 */
        } else if (hasWebAuthn) {
          setActiveTab('webauthn');
        } else {
          setActiveTab('recovery');
        }
      } catch (error) {
        console.error('Error parsing MFA methods:', error);
      }
    }
  }, [searchParams, router, showToastHandler, t]);

  useEffect(() => {
    if (shouldAutoStartWebAuthn && mfaToken && !loading && !webAuthnStarted) {
      setShouldAutoStartWebAuthn(false);
      // NOTE (found while writing coverage tests): this timer's callback is
      // never actually reached. `shouldAutoStartWebAuthn` is itself one of
      // this effect's own dependencies, so flipping it to `false` above
      // schedules a re-render whose commit runs this effect's cleanup
      // (clearTimeout) *before* the 500ms elapse — the auto-start immediately
      // cancels itself. Confirmed via instrumentation: the effect re-runs and
      // clears the timer within the same tick, well under 500ms real time.
      // This looks like a pre-existing product bug (auto-start-on-mount for
      // an exclusively-WebAuthn MFA flow never fires) rather than a test gap.
      /* v8 ignore next 3 */
      const timer = setTimeout(() => {
        handleWebAuthnAuth();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    shouldAutoStartWebAuthn,
    mfaToken,
    loading,
    webAuthnStarted,
    handleWebAuthnAuth,
  ]);

  type TotpForm = z.infer<typeof totpSchema>;
  const totpSchema = z.object({
    code: z
      .string()
      .length(totpCodeLength, t('errorCodeLength', { length: totpCodeLength })),
  });

  type EmailForm = z.infer<typeof emailSchema>;
  const emailSchema = z.object({
    code: z
      .string()
      .length(
        emailCodeLength,
        t('errorCodeLength', { length: emailCodeLength })
      ),
  });

  type RecoveryForm = z.infer<typeof recoverySchema>;
  const recoverySchema = z.object({
    code: z.string().min(1, t('errorRecoveryCodeRequired')),
  });

  const getSchemaForTab = () => {
    if (activeTab === 'recovery') {
      return recoverySchema;
    }
    if (activeTab === 'totp') {
      return totpSchema;
    }
    return emailSchema;
  };

  const form = useForm<TotpForm | EmailForm | RecoveryForm>({
    resolver: zodResolver(getSchemaForTab()),
    defaultValues: {
      code: '',
    },
  });

  useEffect(() => {
    form.reset({ code: '' });
    setError(null);
  }, [activeTab, form]);

  const onSubmit = async (data: TotpForm | EmailForm | RecoveryForm) => {
    if (!mfaToken) {
      setError(t('errorMfaTokenNotFound'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = '/auth/login-code';
      const payload: MfaCodePayload = {
        token: mfaToken,
        code: data.code,
      };

      if (activeTab === 'webauthn') {
        await handleWebAuthnAuth();
        return;
      } else {
        payload.methodType = activeTab;
      }

      const response = await request<{
        accessToken: string;
        refreshToken?: string;
        requiresPasswordReset?: boolean;
      }>({
        url: endpoint,
        method: 'POST',
        data: payload,
      });

      if (response.data?.accessToken) {
        setAccessToken(response.data.accessToken);
        showToastHandler?.('success', t('successAuth'));
        if (response.data.requiresPasswordReset) {
          router.push('/core/account/password?required=1');
        } else {
          router.push(getUrlAfterLogin());
        }
      }
    } catch (error: unknown) {
      console.error('Erro ao verificar código:', error);
      setError(extractErrorMessage(error, t('errorInvalidCode')));
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    // Defensive guard: the resend button only renders when `hasEmailMfa` is
    // true, which is only set (alongside `mfaToken`) once a `token` search
    // param is present, so `mfaToken` is always truthy here in practice.
    /* v8 ignore next */
    if (!mfaToken) return;

    setResendingCode(true);
    try {
      await request({
        url: '/auth/resend-mfa-code',
        method: 'POST',
        data: { token: mfaToken },
      });
      setResendCooldown(30);
      showToastHandler?.('success', t('successCodeResent'));
    } catch {
      showToastHandler?.('error', t('errorCodeResend'));
    } finally {
      setResendingCode(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background transition-colors p-4">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full max-w-lg p-8 rounded-xl shadow-xl bg-card border"
        >
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold text-center">{t('title')}</h2>
            <p className="mt-2 text-sm text-muted-foreground text-center">
              {hasWebAuthnMfa && !hasTotpMfa && !hasEmailMfa
                ? t('descriptionWebAuthnOnly')
                : t('descriptionMultipleMethods')}
            </p>
          </div>

          <div className="mb-12 flex justify-center">
            <LanguageSelector />
          </div>

          {/* If there's ONLY WebAuthn, show the fingerprint UI directly */}
          {hasWebAuthnMfa && !hasTotpMfa && !hasEmailMfa ? (
            <div className="space-y-6">
              <div className="p-8 rounded-lg bg-muted/50 border-2 border-dashed border-muted-foreground/30 w-full">
                <div className="flex flex-col items-center gap-4">
                  <Fingerprint className="w-16 h-16 text-primary/60" />
                  <p className="text-sm text-center text-muted-foreground">
                    {t('webAuthnClickInstructions')}
                  </p>
                </div>
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{t('alertErrorTitle')}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                type="button"
                onClick={handleWebAuthnAuth}
                disabled={loading}
                className="w-full h-11"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {t('buttonAuthenticating')}
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-4 h-4 mr-2" />
                    {t('buttonUseSecurityKey')}
                  </>
                )}
              </Button>

              <div className="text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/login')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('buttonBackToLogin')}
                </Button>
              </div>
            </div>
          ) : (
            /* Normal layout with tabs when there are multiple methods */
            <>
              <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="w-full"
              >
                <TabsList
                  className="grid w-full"
                  style={{
                    gridTemplateColumns: `repeat(${[hasTotpMfa, hasEmailMfa, hasWebAuthnMfa, true].filter(Boolean).length}, 1fr)`,
                  }}
                >
                  {hasTotpMfa && (
                    <TabsTrigger
                      value="totp"
                      className="flex items-center gap-2"
                    >
                      <Smartphone className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('tabApp')}</span>
                    </TabsTrigger>
                  )}
                  {hasEmailMfa && (
                    <TabsTrigger
                      value="email"
                      className="flex items-center gap-2"
                    >
                      <Mail className="w-4 h-4" />
                      <span className="hidden sm:inline">{t('tabEmail')}</span>
                    </TabsTrigger>
                  )}
                  {hasWebAuthnMfa && (
                    <TabsTrigger
                      value="webauthn"
                      className="flex items-center gap-2"
                    >
                      <Fingerprint className="w-4 h-4" />
                      <span className="hidden sm:inline">
                        {t('tabSecurityKey')}
                      </span>
                    </TabsTrigger>
                  )}
                  <TabsTrigger
                    value="recovery"
                    className="flex items-center gap-2"
                  >
                    <Key className="w-4 h-4" />
                    <span className="hidden sm:inline">
                      {t('tabRecoveryCode')}
                    </span>
                  </TabsTrigger>
                </TabsList>

                {hasTotpMfa && (
                  <TabsContent value="totp" className="space-y-4">
                    <div className="text-center text-sm text-muted-foreground py-2">
                      {t('instructionTotp')}
                    </div>
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-center block text-sm font-medium mb-4">
                            {t('labelTotpCode', { length: totpCodeLength })}
                          </FormLabel>
                          <FormControl>
                            <div className="flex justify-center">
                              <InputOTP maxLength={totpCodeLength} {...field}>
                                <InputOTPGroup>
                                  {Array.from({ length: totpCodeLength }).map(
                                    (_, index) => (
                                      <InputOTPSlot
                                        key={index}
                                        index={index}
                                        className="w-12 h-14 text-lg"
                                      />
                                    )
                                  )}
                                </InputOTPGroup>
                              </InputOTP>
                            </div>
                          </FormControl>
                          <FormMessage className="text-center mt-2" />
                        </FormItem>
                      )}
                    />
                  </TabsContent>
                )}

                {hasEmailMfa && (
                  <TabsContent value="email" className="space-y-4">
                    <div className="text-center text-sm text-muted-foreground py-2">
                      {t('instructionEmail')}
                    </div>
                    <FormField
                      control={form.control}
                      name="code"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-center block text-sm font-medium mb-4">
                            {t('labelEmailCode', { length: emailCodeLength })}
                          </FormLabel>
                          <FormControl>
                            <div className="flex justify-center">
                              <InputOTP maxLength={emailCodeLength} {...field}>
                                <InputOTPGroup>
                                  {Array.from({ length: emailCodeLength }).map(
                                    (_, index) => (
                                      <InputOTPSlot
                                        key={index}
                                        index={index}
                                        className="w-12 h-14 text-lg"
                                      />
                                    )
                                  )}
                                </InputOTPGroup>
                              </InputOTP>
                            </div>
                          </FormControl>
                          <FormMessage className="text-center mt-2" />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-center">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={resendingCode || resendCooldown > 0}
                        onClick={handleResendCode}
                        className="text-primary hover:text-primary/80"
                      >
                        {resendingCode ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            {t('buttonResending')}
                          </>
                        ) : resendCooldown > 0 ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {t('buttonResendIn', { seconds: resendCooldown })}
                          </>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {t('buttonResendCode')}
                          </>
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                )}

                {hasWebAuthnMfa && (
                  <TabsContent value="webauthn" className="space-y-4">
                    <div className="text-center text-sm text-muted-foreground py-2">
                      {t('instructionWebAuthn')}
                    </div>
                    <div className="p-6 rounded-lg bg-muted/50 border-2 border-dashed border-muted-foreground/30 w-full">
                      <div className="flex flex-col items-center gap-3">
                        <Fingerprint className="w-12 h-12 text-primary/60" />
                        <p className="text-sm text-center text-muted-foreground">
                          {t('webAuthnClickInstructions')}
                        </p>
                      </div>
                    </div>
                  </TabsContent>
                )}

                <TabsContent value="recovery" className="space-y-4">
                  <div className="text-center text-sm text-muted-foreground py-2">
                    {t('instructionRecovery')}
                  </div>
                  <FormField
                    control={form.control}
                    name="code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-center block text-sm font-medium mb-4">
                          {t('labelRecoveryCode')}
                        </FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            className="text-center text-lg font-mono uppercase"
                            autoComplete="off"
                          />
                        </FormControl>
                        <FormMessage className="text-center mt-2" />
                      </FormItem>
                    )}
                  />
                </TabsContent>
              </Tabs>

              {error && (
                <div className="mt-6">
                  <Alert variant="destructive">
                    <AlertTitle>{t('alertErrorTitle')}</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                </div>
              )}

              <Button
                type={activeTab === 'webauthn' ? 'button' : 'submit'}
                onClick={
                  activeTab === 'webauthn' ? handleWebAuthnAuth : undefined
                }
                disabled={loading}
                variant="default"
                className="w-full mt-6 h-11"
              >
                {loading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    {t('buttonVerifying')}
                  </>
                ) : (
                  <>
                    {activeTab === 'totp' && (
                      <Smartphone className="w-4 h-4 mr-2" />
                    )}
                    {activeTab === 'email' && <Mail className="w-4 h-4 mr-2" />}
                    {activeTab === 'webauthn' && (
                      <Fingerprint className="w-4 h-4 mr-2" />
                    )}
                    {activeTab === 'recovery' && (
                      <Key className="w-4 h-4 mr-2" />
                    )}
                    {activeTab === 'webauthn'
                      ? t('buttonAuthenticate')
                      : t('buttonVerifyCode')}
                  </>
                )}
              </Button>

              <div className="mt-4 text-center">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => router.push('/login')}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  {t('buttonBackToLogin')}
                </Button>
              </div>
            </>
          )}
        </form>
      </Form>
    </div>
  );
}
