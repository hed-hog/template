'use client';

import { Button } from '@/components/ui/button';
import { CommentRichEditor } from '@/components/ui/comment-rich-editor';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useApp } from '@hed-hog/next-app-provider';
import { Check, Lightbulb, MessagesSquare } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import { AttachmentsField, useAddAttachments } from './attachments-field';
import {
  ContextChip,
  Field,
  SupportContext,
  supportFormData,
} from './report-bug-sheet';
import {
  SUPPORT_API,
  SUPPORT_CHANGED_EVENT,
  SUPPORT_PAGE,
  collectClientContext,
  imagesFromPaste,
  isBlankRichText,
} from './support-client';

const EMPTY = { title: '', situation: '', problem: '', solution: '' };

/** Link do tópico no fórum (aba + tópico aberto). */
export const forumTopicPath = (id: number) =>
  `${SUPPORT_PAGE}?aba=forum&topico=${id}`;

/**
 * "Propor melhoria": vira um tópico no Fórum de melhorias. Os colegas apoiam
 * e comentam, a IA resume, e quando a ideia amadurece ela vai para o Aprovador
 * de Suporte.
 */
export function ProposeImprovementSheet({
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
  // Remontado (`key`) a cada abertura: formulário limpo e chave nova.
  const [form, setForm] = useState(EMPTY);
  const [files, setFiles] = useState<File[]>(() =>
    initialScreenshot ? [initialScreenshot] : []
  );
  const [submitted, setSubmitted] = useState(false);
  const [created, setCreated] = useState<{ id: number; code: string } | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const errors = {
    title: !form.title.trim(),
    situation: isBlankRichText(form.situation),
    problem: isBlankRichText(form.problem),
  };
  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    try {
      const response = await request<{
        id: number;
        code: string;
        attachmentsFailed: number;
      }>({
        url: `${SUPPORT_API}/improvements`,
        method: 'POST',
        data: supportFormData(
          {
            title: form.title.trim(),
            situation: form.situation,
            problem: form.problem,
            solution: isBlankRichText(form.solution) ? undefined : form.solution,
            screenName: context.screenName,
            moduleName: context.moduleName,
            pageUrl: context.pageUrl,
            clientContext: JSON.stringify(collectClientContext() ?? {}),
            idempotencyKey,
          },
          files
        ),
      });
      if (response.data.attachmentsFailed > 0) {
        toast.warning(
          t('topicAttachmentsFailed', { count: response.data.attachmentsFailed })
        );
      }
      window.dispatchEvent(new CustomEvent(SUPPORT_CHANGED_EVENT));
      onOpenChange(false);
      setCreated({ id: response.data.id, code: response.data.code });
    } catch {
      // O erro já vira toast no AppProvider.
    }
  };

  return (
    <>
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
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
              <Lightbulb className="size-5" />
            </span>
            <div>
              <SheetTitle>{t('proposeImprovement')}</SheetTitle>
              <SheetDescription>{t('improvementSubtitle')}</SheetDescription>
            </div>
          </SheetHeader>

          <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
            <ContextChip context={context} />
            <div className="flex items-start gap-2 rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
              <MessagesSquare className="mt-0.5 size-4 shrink-0" />
              {t('improvementIntro')}
            </div>
            <Field label={t('improvementTitle')} required error={submitted && errors.title ? t('errTitle') : null}>
              <Input
                maxLength={200}
                placeholder={t('improvementTitlePlaceholder')}
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                aria-invalid={submitted && errors.title}
              />
            </Field>
            <Field label={t('situation')} required error={submitted && errors.situation ? t('errSituation') : null}>
              <CommentRichEditor
                value={form.situation}
                placeholder=""
                onChange={(html) => set('situation', html)}
              />
            </Field>
            <Field label={t('problem')} required error={submitted && errors.problem ? t('errProblem') : null}>
              <CommentRichEditor
                value={form.problem}
                placeholder=""
                onChange={(html) => set('problem', html)}
              />
            </Field>
            <Field label={t('solution')} optional={t('optional')}>
              <CommentRichEditor
                value={form.solution}
                placeholder=""
                onChange={(html) => set('solution', html)}
              />
            </Field>
            <Field label={t('attachments')} optional={t('optional')}>
              <AttachmentsField files={files} onChange={setFiles} />
            </Field>
          </div>

          <div className="flex items-center justify-between gap-2 border-t px-6 py-4">
            <span className="text-xs text-muted-foreground">{t('required')}</span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={handleSubmit}>{t('publish')}</Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={created !== null} onOpenChange={() => setCreated(null)}>
        <DialogContent className="text-center sm:max-w-md">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Check className="size-7" />
          </span>
          <DialogTitle className="text-center">{t('topicCreated')}</DialogTitle>
          {created ? (
            <div className="mx-auto rounded-md border bg-muted/40 px-4 py-2 text-sm">
              {t('protocol')}{' '}
              <strong className="text-base text-primary">{created.code}</strong>
            </div>
          ) : null}
          <DialogDescription className="text-center">
            {t('topicCreatedHint')}
          </DialogDescription>
          <DialogFooter className="border-t pt-4 sm:justify-end">
            <Button variant="outline" onClick={() => setCreated(null)}>
              {t('close')}
            </Button>
            <Button
              onClick={() => {
                if (created) router.push(forumTopicPath(created.id));
                setCreated(null);
              }}
            >
              {t('viewTopic')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
