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
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { LanguageSelector } from '../language-selector';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

/**
 * Troca de senha obrigatória (senha redefinida pelo administrador).
 *
 * Fica fora do layout `(app)` de propósito: enquanto o reset está pendente o
 * `RoleGuard` responde 401 a toda rota com papel, exceto
 * `PUT /profile/change-password` e `GET /auth/verify`. Dentro do layout, cada
 * chamada da sidebar, das notificações e afins virava renovação de token + toast
 * de erro, sem parar. Aqui só as duas rotas liberadas são chamadas.
 */
export function ForcePasswordChangePage() {
  const {
    request,
    refetchUser,
    getErrorMessage,
    getSettingValue,
    getUrlAfterLogin,
    accessToken,
    user,
    logout,
  } = useApp();
  const router = useRouter();
  const t = useTranslations('core.ForcePasswordChangePage');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const requiresPasswordReset =
    (user as { requires_password_reset?: boolean } | null)
      ?.requires_password_reset === true;

  useEffect(() => {
    if (loading) return;
    if (!accessToken) {
      router.replace('/login');
      return;
    }
    // `user` nulo é sessão ainda carregando, não "sem reset pendente".
    if (user && !requiresPasswordReset) {
      router.replace('/');
    }
  }, [accessToken, user, requiresPasswordReset, loading, router]);

  const minPasswordLength = getSettingValue('password-min-length') || 6;
  const minPasswordSymbols = getSettingValue('password-min-symbols') || 0;
  const minPasswordUppercase = getSettingValue('password-min-uppercase') || 0;
  const minPasswordNumbers = getSettingValue('password-min-numbers') || 0;

  const schema = z
    .object({
      currentPassword: z.string().min(1, t('currentPasswordRequired')),
      newPassword: z
        .string()
        .min(
          minPasswordLength,
          t('newPasswordMinLength', { minLength: minPasswordLength })
        )
        .refine(
          (val) =>
            val.replace(/[a-zA-Z0-9]/g, '').length >= minPasswordSymbols,
          {
            message: t('newPasswordMinSymbols', {
              minSymbols: minPasswordSymbols,
            }),
          }
        )
        .refine(
          (val) => (val.match(/[A-Z]/g) || []).length >= minPasswordUppercase,
          {
            message: t('newPasswordMinUppercase', {
              minUppercase: minPasswordUppercase,
            }),
          }
        )
        .refine(
          (val) => (val.match(/[0-9]/g) || []).length >= minPasswordNumbers,
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
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
      message: t('samePassword'),
      path: ['newPassword'],
    });

  type ForcePasswordChangeForm = z.infer<typeof schema>;

  const form = useForm<ForcePasswordChangeForm>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const onSubmit = async (data: ForcePasswordChangeForm) => {
    setLoading(true);
    setError(null);

    try {
      await request({
        url: '/profile/change-password',
        method: 'PUT',
        data: {
          currentPassword: data.currentPassword,
          newPassword: data.newPassword,
        },
        // O erro aparece no próprio cartão, com a regra que o backend recusou.
        showErrors: false,
      });
      // O guard do layout lê `user.requires_password_reset`: sem o refetch, a
      // navegação abaixo voltaria direto para esta tela.
      await refetchUser();
      const afterUrl = getUrlAfterLogin();
      router.replace(
        afterUrl &&
          !afterUrl.startsWith('/login') &&
          !afterUrl.startsWith('/change-password')
          ? afterUrl
          : '/'
      );
    } catch (err) {
      setError(getErrorMessage(err));
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

        <Alert className="mb-6">
          <AlertTitle>{t('noticeTitle')}</AlertTitle>
          <AlertDescription>{t('noticeDescription')}</AlertDescription>
        </Alert>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('currentPasswordLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      autoComplete="current-password"
                      placeholder={t('currentPasswordPlaceholder')}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              loading={loading}
              loadingLabel={t('submitButtonLoading')}
              className="w-full"
            >
              {t('submitButton')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              disabled={loading}
              onClick={() => logout()}
            >
              {t('logoutButton')}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
