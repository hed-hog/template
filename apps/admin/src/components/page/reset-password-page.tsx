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
import { useApp } from '@hed-hog/next-app-provider';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LanguageSelector } from '../language-selector';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

export function ResetPasswordPage() {
  const { resetPassword, refetchUser, getErrorMessage, getSettingValue } =
    useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('core.ResetPasswordPage');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const token =
    searchParams.get('token') ||
    searchParams.get('code') ||
    searchParams.get('resetCode') ||
    '';

  const minPasswordLength = getSettingValue('password-min-length') || 6;
  const minPasswordSymbols = getSettingValue('password-min-symbols') || 0;
  const minPasswordUppercase = getSettingValue('password-min-uppercase') || 0;
  const minPasswordNumbers = getSettingValue('password-min-numbers') || 0;

  const resetPasswordSchema = z
    .object({
      newPassword: z
        .string()
        .min(
          minPasswordLength,
          t('newPasswordMinLength', { minLength: minPasswordLength })
        )
        .refine(
          (val) => {
            const symbolCount = val.replace(/[a-zA-Z0-9]/g, '').length;
            return symbolCount >= minPasswordSymbols;
          },
          {
            message: t('newPasswordMinSymbols', {
              minSymbols: minPasswordSymbols,
            }),
          }
        )
        .refine(
          (val) => {
            const uppercaseCount = (val.match(/[A-Z]/g) || []).length;
            return uppercaseCount >= minPasswordUppercase;
          },
          {
            message: t('newPasswordMinUppercase', {
              minUppercase: minPasswordUppercase,
            }),
          }
        )
        .refine(
          (val) => {
            const numberCount = (val.match(/[0-9]/g) || []).length;
            return numberCount >= minPasswordNumbers;
          },
          {
            message: t('newPasswordMinNumbers', {
              minNumbers: minPasswordNumbers,
            }),
          }
        ),
      confirmPassword: z.string().min(1, t('confirmPasswordRequired')),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t('passwordsDontMatch'),
      path: ['confirmPassword'],
    });

  type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

  const form = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ResetPasswordForm) => {
    if (!token) {
      setError(t('missingToken'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await resetPassword(token, data.newPassword, data.confirmPassword);
      // Garante que o guard de rota (que le `user.requires_password_reset`)
      // enxergue o estado atualizado antes de navegar para a area logada.
      await refetchUser();
      setSuccess(true);
      setTimeout(() => {
        router.replace('/');
        router.refresh();
      }, 1200);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background transition-colors">
      <div className="w-full max-w-sm p-8 rounded-lg shadow-lg bg-card">
        <h2 className="text-2xl font-bold mb-6 text-center">{t('title')}</h2>
        <div className="mb-6 flex justify-center">
          <LanguageSelector />
        </div>

        {!token && (
          <Alert variant="destructive" className="mb-6">
            <AlertTitle>{t('missingTokenTitle')}</AlertTitle>
            <AlertDescription>{t('missingToken')}</AlertDescription>
          </Alert>
        )}

        {success ? (
          <Alert>
            <AlertTitle>{t('successTitle')}</AlertTitle>
            <AlertDescription>{t('successDescription')}</AlertDescription>
          </Alert>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('newPasswordLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder={t('newPasswordPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('confirmPasswordLabel')}</FormLabel>
                    <FormControl>
                      <Input
                        type="password"
                        autoComplete="new-password"
                        placeholder={t('confirmPasswordPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error && (
                <Alert variant="destructive">
                  <AlertTitle>{t('errorTitle')}</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <Button
                type="submit"
                disabled={loading || !token}
                className="w-full"
              >
                {loading ? t('submitButtonLoading') : t('submitButton')}
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  );
}
