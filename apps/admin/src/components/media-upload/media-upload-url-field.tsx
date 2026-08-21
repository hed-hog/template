'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { buildFileOpenUrl, buildImageUrl } from '@/lib/build-image-url';
import { cn } from '@/lib/utils';
import { useApp } from '@hed-hog/next-app-provider';
import {
  AlertTriangle,
  ImageIcon,
  Loader2,
  Trash2,
  UploadCloud,
  Video as VideoIcon,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

export type MediaUploadUrlFieldKind = 'image' | 'video';

export type MediaUploadUrlFieldLabels = {
  /** Text shown inside the empty preview placeholder. */
  empty: string;
  upload: string;
  replace: string;
  remove: string;
  uploading: string;
  uploadError: string;
  linkPlaceholder: string;
  /**
   * Shown instead of the broken-image placeholder when the value is a
   * relative path (e.g. migrated content pointing at the public site's own
   * `/public` folder) but `previewBaseUrl` isn't configured — otherwise this
   * case silently looks like a generic broken image.
   */
  previewUnavailable?: string;
};

export interface MediaUploadUrlFieldProps {
  /** Publicly reachable image URL, or an empty string when unset. */
  value: string;
  onChange: (url: string) => void;
  label: string;
  description?: string;
  /** Upload destination folder passed to `POST /file`. */
  destination: string;
  labels: MediaUploadUrlFieldLabels;
  /** Which media this slot accepts and how it previews. Defaults to 'image'. */
  kind?: MediaUploadUrlFieldKind;
  disabled?: boolean;
  className?: string;
  previewClassName?: string;
  /** Hide the manual URL paste input — upload becomes the only way in. */
  hideUrlInput?: boolean;
  /**
   * Origem contra a qual resolver um caminho relativo só na prévia.
   *
   * Conteúdo migrado de um site costuma guardar `/pasta/imagem.png`, servido
   * pelo domínio público — que não é o do admin. Sem isto a prévia dá 404 e o
   * editor mostra um campo quebrado para uma imagem que está no ar.
   */
  previewBaseUrl?: string;
}

/**
 * A single media slot (image or video, per `kind`) bound to a plain URL
 * string instead of a stored file id — for contexts (like CMS component
 * props) where the consumer renders `<img src>`/`<video src>` directly from
 * the prop value. Uploading still goes through the shared `/file` endpoint;
 * the resulting URL is the long-cached `/file/image/:id` for images or the
 * generic `/file/open/:id` for video (the image endpoint 404s non-image
 * content). The manual URL input stays available so pasting an existing
 * external link (e.g. a CDN already in use) doesn't force a re-upload.
 */
export function MediaUploadUrlField({
  value,
  onChange,
  label,
  description,
  destination,
  labels,
  kind = 'image',
  disabled,
  className,
  previewClassName = 'h-28 w-full',
  hideUrlInput,
  previewBaseUrl,
}: MediaUploadUrlFieldProps) {
  const { request } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [broken, setBroken] = useState(false);

  const hasValue = Boolean(value);

  // Absoluto (http(s)://, `//`, `data:`) ou já é a URL de um arquivo enviado
  // por aqui (`/file/...`, resolvida pela própria API) — nesses casos o
  // valor já é diretamente carregável, prefixo nenhum ajuda.
  const isAbsoluteUrl = /^([a-z][a-z0-9+.-]*:)?\/\//i.test(value);
  const needsBaseUrl = hasValue && !isAbsoluteUrl;
  // Conteúdo migrado às vezes guarda o caminho sem a barra inicial
  // (`imagem.png` em vez de `/imagem.png`) — sem isto só o primeiro formato
  // era reescrito, e o segundo caía direto pro `<img src>` quebrado.
  const relativePath = value.startsWith('/') ? value : `/${value}`;
  // Só a prévia é reescrita: o valor gravado continua relativo, que é o que o
  // site espera.
  const previewSrc =
    needsBaseUrl && previewBaseUrl
      ? `${previewBaseUrl.replace(/\/$/, '')}${relativePath}`
      : value;
  // Caminho relativo sem `previewBaseUrl` configurado nunca vai carregar
  // nesta prévia (o navegador resolve contra o domínio do admin, não o do
  // site) — mostrar isso explicitamente em vez de deixar cair no ícone de
  // imagem quebrada genérico, que parece um bug e não um dado faltando.
  const missingBaseUrl = needsBaseUrl && !previewBaseUrl;

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith(`${kind}/`)) {
      toast.error(labels.uploadError);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('destination', destination);
      const res = await request<{ id?: number }>({
        url: '/file',
        method: 'POST',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const id = res?.data?.id;
      // `/file/image/:id` (buildImageUrl) explicitly 404s anything whose
      // mimetype isn't image/* — a video needs the generic `/file/open/:id`
      // endpoint instead, same split as the fileId-based MediaUploadField.
      const url = id ? (kind === 'image' ? buildImageUrl(id) : buildFileOpenUrl(id)) : null;
      if (!url) {
        toast.error(labels.uploadError);
        return;
      }
      setBroken(false);
      onChange(url);
    } catch {
      toast.error(labels.uploadError);
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setBroken(false);
    onChange('');
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={`${kind}/*`}
        className="hidden"
        onChange={handleSelect}
      />

      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-md border border-border/70 bg-muted/30',
          previewClassName
        )}
      >
        {hasValue && missingBaseUrl ? (
          <div className="flex flex-col items-center gap-1 px-2 text-amber-600 dark:text-amber-500">
            <AlertTriangle className="size-5" />
            <span className="text-center text-[11px] leading-tight">
              {labels.previewUnavailable ??
                'Prévia indisponível — configure o Domínio Público em CMS → Configurações'}
            </span>
          </div>
        ) : hasValue && !broken ? (
          kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewSrc}
              alt={label}
              className="h-full w-full object-contain"
              onError={() => setBroken(true)}
            />
          ) : (
            <video
              src={previewSrc}
              className="h-full w-full object-contain"
              muted
              loop
              autoPlay
              playsInline
              onError={() => setBroken(true)}
            />
          )
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
            {kind === 'image' ? (
              <ImageIcon className="size-5" />
            ) : (
              <VideoIcon className="size-5" />
            )}
            <span className="px-2 text-center text-[11px] leading-tight">
              {labels.empty}
            </span>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/70">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </div>

      {description ? (
        <p className="text-[11px] text-muted-foreground/70">{description}</p>
      ) : null}

      <div className="flex items-center gap-1">
        {hideUrlInput ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 flex-1 text-xs"
            disabled={disabled || uploading}
            onClick={() => inputRef.current?.click()}
          >
            {uploading ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <UploadCloud className="mr-1.5 h-3.5 w-3.5" />
            )}
            {uploading ? labels.uploading : hasValue ? labels.replace : labels.upload}
          </Button>
        ) : (
          <>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    disabled={disabled || uploading}
                    onClick={() => inputRef.current?.click()}
                  >
                    {uploading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <UploadCloud className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {uploading ? labels.uploading : hasValue ? labels.replace : labels.upload}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <Input
              // Explícito de propósito: `Input` repassa o `type` cru, e sem ele o
              // atributo não sai no DOM — o campo funciona (text é o default), mas
              // fica indistinguível do input[type=file] oculto acima para quem
              // consulta o DOM por seletor.
              type="text"
              value={value}
              onChange={(e) => {
                setBroken(false);
                onChange(e.target.value);
              }}
              placeholder={labels.linkPlaceholder}
              disabled={disabled}
              className="h-7 flex-1 text-xs"
            />
          </>
        )}

        {hasValue ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                  disabled={disabled}
                  onClick={handleRemove}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{labels.remove}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </div>
    </div>
  );
}
