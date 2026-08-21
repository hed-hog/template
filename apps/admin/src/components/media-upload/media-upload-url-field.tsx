'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { buildImageUrl } from '@/lib/build-image-url';
import { cn } from '@/lib/utils';
import { useApp } from '@hed-hog/next-app-provider';
import { ImageIcon, Loader2, Trash2, UploadCloud } from 'lucide-react';
import { useRef, useState } from 'react';
import { toast } from 'sonner';

export type MediaUploadUrlFieldLabels = {
  /** Text shown inside the empty preview placeholder. */
  empty: string;
  upload: string;
  replace: string;
  remove: string;
  uploading: string;
  uploadError: string;
  linkPlaceholder: string;
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
  disabled?: boolean;
  className?: string;
  previewClassName?: string;
  /** Hide the manual URL paste input — upload becomes the only way in. */
  hideUrlInput?: boolean;
}

/**
 * A single image slot bound to a plain URL string instead of a stored file
 * id — for contexts (like CMS component props) where the consumer renders
 * `<img src>` directly from the prop value. Uploading still goes through the
 * shared `/file` endpoint; the resulting long-cached `/file/image/:id` URL is
 * what gets stored. The manual URL input stays available so pasting an
 * existing external link (e.g. a CDN already in use) doesn't force a
 * re-upload.
 */
export function MediaUploadUrlField({
  value,
  onChange,
  label,
  description,
  destination,
  labels,
  disabled,
  className,
  previewClassName = 'h-28 w-full',
  hideUrlInput,
}: MediaUploadUrlFieldProps) {
  const { request } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [broken, setBroken] = useState(false);

  const hasValue = Boolean(value);

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
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
      const url = id ? buildImageUrl(id) : null;
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
        accept="image/*"
        className="hidden"
        onChange={handleSelect}
      />

      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-md border border-border/70 bg-muted/30',
          previewClassName
        )}
      >
        {hasValue && !broken ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={value}
            alt={label}
            className="h-full w-full object-contain"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-muted-foreground/50">
            <ImageIcon className="size-5" />
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
