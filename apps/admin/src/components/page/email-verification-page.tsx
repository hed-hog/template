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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { useApp } from '@hed-hog/next-app-provider';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, RefreshCw, Shield } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LanguageSelector } from '../language-selector';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function EmailVerificationPage() {
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
  const t = useTranslations('core.EmailVerificationPage');

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

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      showToastHandler?.('error', t('errorMfaTokenNotFoundRedirect'));
      router.push('/login');
      return;
    }

    setMfaToken(token);
  }, [searchParams, router, showToastHandler]);

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

  // setActiveTab is never invoked in this email-only flow (no tab switcher is
  // rendered), so activeTab stays 'totp' forever: the 'recovery' branch below
  // and the trailing emailSchema fallback are unreachable dead code.
  const getSchemaForTab = () => {
    /* v8 ignore next 3 */
    if (activeTab === 'recovery') {
      return recoverySchema;
    }
    /* v8 ignore next 3 */
    if (activeTab === 'totp') {
      return totpSchema;
    }
    /* v8 ignore next */
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
  }, [activeTab]);

  const onSubmit = async ({ code }: TotpForm | EmailForm | RecoveryForm) => {
    if (!mfaToken) {
      setError(t('errorMfaTokenNotFound'));
      return;
    }

    const { data } = await request<{
      accessToken?: string;
      requiresPasswordReset?: boolean;
    }>({
      url: '/auth/login-email-verification',
      method: 'POST',
      data: { token: mfaToken, code },
    });

    if (data?.accessToken) {
      setAccessToken(data.accessToken);
      showToastHandler?.('success', t('successEmailVerified'));
      if (data.requiresPasswordReset) {
        router.push('/core/account/password?required=1');
      } else {
        router.push(getUrlAfterLogin() || '/');
      }
    }
  };

  const handleResendCode = async () => {
    if (!mfaToken) return;

    setResendingCode(true);
    try {
      form.reset({ code: '' });
      const { data } = await request<{ token: string }>({
        url: '/auth/login-email-verification-resend',
        method: 'POST',
        data: { token: mfaToken },
      });
      setMfaToken(data.token);
      setResendCooldown(30);

      showToastHandler?.('success', t('successCodeResent'));
    } catch (error) {
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
              {t('description')}
            </p>
          </div>

          <div className="mb-5 flex justify-center">
            <LanguageSelector />
          </div>

          <div className="text-center text-sm text-muted-foreground">
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
                              autoFocus={index === 0}
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

          <div className="flex justify-center flex-col mt-8 space-y-4">
            {/* setLoading is never called in this component, so `loading` stays
                false and the "verifying" ternary branch below is unreachable. */}
            <Button type="submit" disabled={loading}>
              {/* v8 ignore next */}
              {loading ? t('buttonVerifying') : t('buttonVerifyEmail')}
            </Button>

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

          {error && (
            <div className="mt-6">
              <Alert variant="destructive">
                <AlertTitle>{t('alertErrorTitle')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}

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
        </form>
      </Form>
    </div>
  );
}
