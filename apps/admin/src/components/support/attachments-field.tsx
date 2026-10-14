'use client';

import { Button } from '@/components/ui/button';
import { FileText, Paperclip, ScanEye, Upload, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { ScreenshotRedactorDialog } from './screenshot-redactor-dialog';
import {
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENTS,
  MAX_ATTACHMENT_BYTES,
  formatFileSize,
  isImage,
} from './support-client';

// Uma URL por arquivo, criada na primeira exibição. Não é revogada: revogar no
// cleanup quebra a miniatura no Strict Mode, e são no máximo alguns prints.
const previewUrls = new WeakMap<File, string>();
function previewUrl(file: File): string {
  let url = previewUrls.get(file);
  if (!url) {
    url = URL.createObjectURL(file);
    previewUrls.set(file, url);
  }
  return url;
}

/** Acrescenta arquivos válidos respeitando o limite; avisa o que ficou de fora. */
export function useAddAttachments() {
  const t = useTranslations('core.Support');
  return (current: File[], incoming: File[]): File[] => {
    const valid = incoming.filter((file) => {
      if (!ACCEPTED_ATTACHMENT_TYPES.includes(file.type)) {
        toast.error(t('invalidFile', { name: file.name }));
        return false;
      }
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(t('fileTooLarge', { name: file.name }));
        return false;
      }
      return true;
    });
    const room = MAX_ATTACHMENTS - current.length;
    if (valid.length > room) {
      toast.warning(t('tooManyFiles', { max: MAX_ATTACHMENTS }));
    }
    return [...current, ...valid.slice(0, Math.max(room, 0))];
  };
}

/**
 * Anexos dos formulários de suporte: prints e PDFs, até {@link MAX_ATTACHMENTS}.
 * O print da tela tirado no clique entra como o primeiro; imagem pode ser
 * borrada antes do envio para esconder dados pessoais.
 */
export function AttachmentsField({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const t = useTranslations('core.Support');
  const addAttachments = useAddAttachments();
  const inputRef = useRef<HTMLInputElement>(null);
  const [redacting, setRedacting] = useState<number | null>(null);

  const previews = files.map((file) => (isImage(file) ? previewUrl(file) : null));

  return (
    <>
      {files.length > 0 ? (
        <ul className="mb-2 space-y-2">
          {files.map((file, index) => (
            <li
              key={`${file.name}-${file.size}-${index}`}
              className="flex items-center gap-3 rounded-md border p-3"
            >
              {previews[index] ? (
                <button
                  type="button"
                  className="h-14 w-20 shrink-0 cursor-pointer overflow-hidden rounded border bg-muted/40"
                  onClick={() => setRedacting(index)}
                  aria-label={t('redact')}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- blob local */}
                  <img
                    src={previews[index] ?? undefined}
                    alt={file.name}
                    className="h-full w-full object-cover object-top"
                  />
                </button>
              ) : (
                <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded border bg-muted/40 text-destructive">
                  <FileText className="size-6" />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              {isImage(file) ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setRedacting(index)}
                >
                  <ScanEye className="size-4" />
                  {t('redact')}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="icon-sm"
                tooltip={t('removeAttachment')}
                onClick={() => onChange(files.filter((_, i) => i !== index))}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      ) : null}

      {files.length === 0 ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed px-4 py-5 text-center text-sm text-muted-foreground hover:bg-muted/40"
        >
          <Upload className="size-5 text-primary" />
          <span>
            <strong className="text-primary">{t('sendFiles')}</strong>{' '}
            {t('pasteHint')}
          </span>
          <span className="text-xs">
            {t('attachmentsHint', { max: MAX_ATTACHMENTS })}
          </span>
        </button>
      ) : (
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {t('attachmentsCount', { count: files.length, max: MAX_ATTACHMENTS })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={files.length >= MAX_ATTACHMENTS}
            onClick={() => inputRef.current?.click()}
          >
            <Paperclip className="size-4" />
            {t('addAttachment')}
          </Button>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED_ATTACHMENT_TYPES.join(',')}
        className="hidden"
        onChange={(event) => {
          onChange(addAttachments(files, Array.from(event.target.files ?? [])));
          event.target.value = '';
        }}
      />

      <ScreenshotRedactorDialog
        key={redacting ?? 'closed'}
        open={redacting !== null}
        file={redacting !== null ? (files[redacting] ?? null) : null}
        onCancel={() => setRedacting(null)}
        onApply={(redacted) => {
          if (redacting !== null) {
            onChange(files.map((file, i) => (i === redacting ? redacted : file)));
          }
          setRedacting(null);
        }}
      />
    </>
  );
}
