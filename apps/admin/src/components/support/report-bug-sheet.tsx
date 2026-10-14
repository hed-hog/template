'use client';

import { Button } from '@/components/ui/button';
import { CommentRichEditor } from '@/components/ui/comment-rich-editor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { useApp } from '@hed-hog/next-app-provider';
import { Bug, FileText, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AttachmentsField, useAddAttachments } from './attachments-field';
import {
  SUPPORT_API,
  SUPPORT_CHANGED_EVENT,
  SUPPORT_PAGE,
  collectClientContext,
  imagesFromPaste,
  isBlankRichText,
} from './support-client';

export type SupportContext = {
  screenName?: string;
  moduleName?: string;
  pageUrl?: string;
};

const IMPACTS = [
  { value: 'blocked', label: 'impactBlocked', hint: 'impactBlockedHint' },
  { value: 'workaround', label: 'impactWorkaround', hint: 'impactWorkaroundHint' },
  { value: 'minor', label: 'impactMinor', hint: 'impactMinorHint' },
] as const;
type Impact = (typeof IMPACTS)[number]['value'];

const EMPTY = {
  title: '',
  attemptedAction: '',
  whatHappened: '',
  expectedBehavior: '',
  impact: null as Impact | null,
};

/** Monta o multipart dos formulários de suporte (campos + anexos). */
export function supportFormData(
  fields: Record<string, string | undefined>,
  files: File[]
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value) form.append(key, value);
  }
  files.forEach((file) => form.append('attachments', file));
  return form;
}

/**
 * "Reportar erro": abre o chamado na Fábrica de Software. O print da tela já
 * vem anexado (tirado no clique, antes de o sheet abrir).
 */
export function ReportBugSheet({
  open,
  onOpenChange,
  initialScreenshot,
  context,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialScreenshot: File | null;
  context: SupportContext;
}) {
  const t = useTranslations('core.Support');
  const { request } = useApp();
  const router = useRouter();
  const addAttachments = useAddAttachments();
  // Quem abre o sheet troca a `key` a cada abertura: o formulário nasce limpo,
  // com o print do clique e uma chave de idempotência nova (reenviar após
  // falha de rede não duplica o chamado; um segundo relato é outro chamado).
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>(() =>
    initialScreenshot ? [initialScreenshot] : []
  );
  const [submitted, setSubmitted] = useState(false);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const errors = {
    title: !form.title.trim(),
    attemptedAction: isBlankRichText(form.attemptedAction),
    whatHappened: isBlankRichText(form.whatHappened),
    impact: !form.impact,
  };
  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    try {
      const response = await request<{ code: string; attachmentsFailed: number }>({
        url: `${SUPPORT_API}/bugs`,
        method: 'POST',
        data: supportFormData(
          {
            title: form.title.trim(),
            attemptedAction: form.attemptedAction,
            whatHappened: form.whatHappened,
            expectedBehavior: isBlankRichText(form.expectedBehavior) ? undefined : form.expectedBehavior,
            impact: form.impact ?? undefined,
            screenName: context.screenName,
            moduleName: context.moduleName,
            pageUrl: context.pageUrl,
            clientContext: JSON.stringify(collectClientContext() ?? {}),
            idempotencyKey,
          },
          files
        ),
      });
      toast.success(t('bugSent', { code: response.data.code }), {
        action: { label: t('follow'), onClick: () => router.push(SUPPORT_PAGE) },
      });
      if (response.data.attachmentsFailed > 0) {
        toast.warning(t('attachmentsFailed', { count: response.data.attachmentsFailed }));
      }
      window.dispatchEvent(new CustomEvent(SUPPORT_CHANGED_EVENT));
      onOpenChange(false);
    } catch {
      // O erro já vira toast no AppProvider.
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 p-0 sm:max-w-[520px]"
        onPaste={(event) => {
          const images = imagesFromPaste(event);
          if (images.length) setFiles((current) => addAttachments(current, images));
        }}
      >
        <SheetHeader className="flex flex-row items-start gap-3 space-y-0 border-b px-6 py-5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <Bug className="size-5" />
          </span>
          <div>
            <SheetTitle>{t('reportBug')}</SheetTitle>
            <SheetDescription>{t('bugSubtitle')}</SheetDescription>
          </div>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <ContextChip context={context} />

          <Field label={t('title')} required error={submitted && errors.title ? t('errTitle') : null}>
            <Input
              maxLength={200}
              placeholder={t('bugTitlePlaceholder')}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              aria-invalid={submitted && errors.title}
            />
          </Field>
          <Field label={t('attempted')} required error={submitted && errors.attemptedAction ? t('errAttempted') : null}>
            <CommentRichEditor
              value={form.attemptedAction}
              placeholder=""
              onChange={(html) => set('attemptedAction', html)}
            />
          </Field>
          <Field label={t('happened')} required error={submitted && errors.whatHappened ? t('errHappened') : null}>
            <CommentRichEditor
              value={form.whatHappened}
              placeholder=""
              onChange={(html) => set('whatHappened', html)}
            />
          </Field>
          <Field label={t('expected')} optional={t('optional')}>
            <CommentRichEditor
              value={form.expectedBehavior}
              placeholder=""
              onChange={(html) => set('expectedBehavior', html)}
            />
          </Field>
          <Field label={t('impact')} required error={submitted && errors.impact ? t('errImpact') : null}>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup">
              {IMPACTS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={form.impact === option.value}
                  onClick={() => set('impact', option.value)}
                  className={cn(
                    'cursor-pointer rounded-md border px-3 py-2.5 text-left transition-colors',
                    form.impact === option.value
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'hover:bg-muted/50',
                    submitted && errors.impact && 'border-destructive'
                  )}
                >
                  <span className="block text-sm font-semibold">{t(option.label)}</span>
                  <span className="block text-xs text-muted-foreground">{t(option.hint)}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label={t('attachments')} optional={t('optional')}>
            <AttachmentsField files={files} onChange={setFiles} />
          </Field>
          <div className="flex items-start gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {t('privacyWarning')}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSubmit}>{t('sendToHcode')}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function ContextChip({ context }: { context: SupportContext }) {
  const t = useTranslations('core.Support');
  if (!context.screenName && !context.moduleName) return null;
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-xs text-primary">
      <FileText className="size-3.5 shrink-0" />
      <span className="truncate">
        {context.screenName ? (
          <>
            {t('screen')} <strong>{context.screenName}</strong>
          </>
        ) : null}
        {context.screenName && context.moduleName ? ' · ' : null}
        {context.moduleName ? (
          <>
            {t('module')} <strong>{context.moduleName}</strong>
          </>
        ) : null}
      </span>
    </div>
  );
}

export function Field({
  label,
  required,
  optional,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  optional?: string;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}
        {required ? <span className="text-destructive">*</span> : null}
        {optional ? (
          <span className="font-normal text-muted-foreground">{optional}</span>
        ) : null}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
