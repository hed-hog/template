'use client';

import { FileTypeIcon } from '@/components/file-type-icon';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertTriangle, Loader2, Paperclip, X } from 'lucide-react';
import * as React from 'react';
import { Attachment } from './intake-types';

type Props = {
  attachments: Attachment[];
  accept: string;
  maxFiles: number;
  hint: string;
  onFiles: (files: File[]) => void;
  onRemove: (localId: string) => void;
};

/**
 * Anexos do formulario publico em miniaturas quadradas.
 *
 * Imagem mostra o proprio conteudo (do `blob:` local, antes mesmo de o upload
 * terminar); o resto mostra o icone colorido do tipo. Colar um print em
 * qualquer campo cai aqui tambem — ver `usePasteAttachments`.
 */
export function IntakeAttachments({
  attachments,
  accept,
  maxFiles,
  hint,
  onFiles,
  onRemove,
}: Props) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const full = attachments.length >= maxFiles;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label>Anexos</Label>
        <span className="text-xs text-muted-foreground">
          {attachments.length}/{maxFiles}
        </span>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple
        className="hidden"
        onChange={(event) => {
          onFiles(Array.from(event.target.files ?? []));
          event.target.value = '';
        }}
      />

      <div className="flex flex-wrap gap-2">
        {attachments.map((item) => (
          <Thumb key={item.localId} item={item} onRemove={onRemove} />
        ))}

        {!full && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex size-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          >
            <Paperclip className="size-5" />
            Adicionar
          </button>
        )}
      </div>

      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function Thumb({
  item,
  onRemove,
}: {
  item: Attachment;
  onRemove: (localId: string) => void;
}) {
  const isImage = Boolean(item.previewUrl);

  return (
    <div
      className={cn(
        'group relative size-24 overflow-hidden rounded-md border bg-muted/40',
        item.status === 'error' && 'border-destructive',
      )}
      title={item.error ? `${item.name} — ${item.error}` : item.name}
    >
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob: local, sem otimizacao possivel
        <img
          src={item.previewUrl}
          alt={item.name}
          className="size-full object-cover"
        />
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-1 px-1.5 pt-1">
          <FileTypeIcon
            filename={item.name}
            mimeType={item.mimetype}
            size={36}
          />
          <span className="w-full truncate text-center text-[10px] leading-tight text-muted-foreground">
            {item.name}
          </span>
        </div>
      )}

      {item.status === 'uploading' && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/60">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {item.status === 'error' && (
        <div className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-destructive/90 px-1.5 py-0.5 text-[10px] text-destructive-foreground">
          <AlertTriangle className="size-3 shrink-0" />
          <span className="truncate">{item.error}</span>
        </div>
      )}

      <Button
        type="button"
        variant="secondary"
        size="icon-sm"
        tooltip="Remover anexo"
        className="absolute right-1 top-1 size-6 rounded-full opacity-90 shadow-sm"
        onClick={() => onRemove(item.localId)}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}
