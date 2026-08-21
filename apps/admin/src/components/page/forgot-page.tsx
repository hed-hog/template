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
import { useFormDraft } from '@/hooks/use-form-draft';
import { formatDateTime } from '@/lib/format-date';
import { useApp } from '@hed-hog/next-app-provider';
import { zodResolver } from '@hookform/resolvers/zod';
import { formatDistanceToNow } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { z } from 'zod';
import { LanguageSelector } from '../language-selector';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';

type ForgotDraftPayload = {
  email: string;
};

const FORGOT_PAGE_DRAFT_STORAGE_KEY = 'core-forgot-page-draft';

export function ForgotPage() {
  const {
    showToastHandler,
    getErrorMessage,
    forgot,
    currentLocaleCode,
    getSettingValue,
  } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations('core.ForgotPage');

  const forgotSchema = z.object({
    email: z
      .string({ required_error: t('emailRequired') })
      .email(t('emailInvalid')),
  });

  type ForgotForm = z.infer<typeof forgotSchema>;

  const form = useForm<ForgotForm>({
    resolver: zodResolver(forgotSchema),
    defaultValues: {
      email: '',
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
  } = useFormDraft<ForgotDraftPayload>({
    storageKey: FORGOT_PAGE_DRAFT_STORAGE_KEY,
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
    enabled: true,
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

  useEffect(() => {
    const storedDraft = loadDraft();
    if (!storedDraft?.payload.email) {
      return;
    }

    form.reset({
      email: storedDraft.payload.email,
    });
  }, [form, loadDraft]);

  const onSubmit = async (data: ForgotForm) => {
    setLoading(true);
    setError(null);
    forgot(data.email)
      .then(() => {
        clearDraft();
        showToastHandler?.('success', t('forgotSuccess'));
      })
      .catch((error) => {
        setError(getErrorMessage(error));
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background transition-colors">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="w-full max-w-sm p-8 rounded-lg shadow-lg bg-card"
        >
          <h2 className="text-2xl font-bold mb-6 text-center">{t('title')}</h2>
          <div className="mb-6 flex justify-center">
            <LanguageSelector />
          </div>
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
          {error && (
            <div className="mt-4">
              <Alert variant="destructive">
                <AlertTitle>{t('errorTitle')}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>
          )}
          {draftStatusContent ? (
            <p className="mt-4 text-xs text-muted-foreground">
              {draftStatusContent}
            </p>
          ) : null}
          <Button type="submit" disabled={loading} className="w-full mt-6">
            {loading ? t('forgotButtonLoading') : t('forgotButton')}
          </Button>
        </form>
      </Form>
    </div>
  );
}
