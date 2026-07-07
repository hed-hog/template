'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  Download,
  Eye,
  ImageIcon,
  Loader2,
  Trash2,
  UploadCloud,
  Video as VideoIcon,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

export type MediaUploadKind = 'image' | 'video';

export type MediaUploadLabels = {
  /** Text shown inside the empty preview placeholder. */
  empty: string;
  upload: string;
  replace: string;
  remove: string;
  download: string;
  zoom: string;
  uploading: string;
  uploadError: string;
  downloadError: string;
};

export interface MediaUploadFieldProps {
  kind: MediaUploadKind;
  /** Stored `file` id, or null when empty. */
  fileId: number | null;
  onChange: (fileId: number | null) => void;
  label: string;
  description?: string;
  /** Upload destination folder passed to `POST /file`. */
  destination: string;
  labels: MediaUploadLabels;
  /** Base name (without extension) used for downloads. */
  downloadName?: string;
  disabled?: boolean;
  className?: string;
  /** Tailwind sizing for the preview box (e.g. "h-28 w-28"). */
  previewClassName?: string;
}

const MIME_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'image/svg+xml': 'svg',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/ogg': 'ogv',
};

function extFromType(type: string, kind: MediaUploadKind): string {
  return MIME_EXT[type] ?? (kind === 'video' ? 'mp4' : 'png');
}

/**
 * A single media slot (image or video) that handles upload, preview, fullscreen
 * zoom and download against the core `file` endpoints. Reusable across forms:
 * upload posts to `/file` preserving the original (no forced crop), the preview
 * uses `/file/image/:id` for images and `/file/open/:id` for videos, and the
 * value is the stored file id surfaced via `onChange`.
 */
export function MediaUploadField({
  kind,
  fileId,
  onChange,
  label,
  description,
  destination,
  labels,
  downloadName,
  disabled,
  className,
  previewClassName = 'h-40 w-full',
}: MediaUploadFieldProps) {
  const { request } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  // Object URL for the just-uploaded file, so the preview updates instantly
  // without round-tripping the server image endpoint.
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  // Drop any local preview when the bound id changes from the outside
  // (e.g. the form is reset to another record).
  useEffect(() => {
    setLocalUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, [fileId]);

  // Revoke the object URL on unmount. Depending on `localUrl` (instead of an
  // empty dependency array) makes the cleanup re-run with the current value
  // whenever it changes, so the closure captured on unmount always revokes
  // the latest object URL rather than the stale `null` from the first render.
  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  const serverUrl =
    kind === 'image' ? buildImageUrl(fileId) : buildFileOpenUrl(fileId);
  const previewUrl = localUrl ?? serverUrl;
  const hasMedia = Boolean(fileId);
  const accept = kind === 'image' ? 'image/*' : 'video/*';

  async function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    const typeOk =
      kind === 'image'
        ? file.type.startsWith('image/')
        : file.type.startsWith('video/');
    if (!typeOk) {
      toast.error(labels.uploadError);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('destination', destination);
      // No maxWidth/maxHeight: keep the original aspect (only the global
      // image-max-dimension cap applies). Videos pass through untouched.
      const res = await request<{ id?: number }>({
        url: '/file',
        method: 'POST',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const id = res?.data?.id;
      if (!id) {
        toast.error(labels.uploadError);
        return;
      }
      const objectUrl = URL.createObjectURL(file);
      setLocalUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return objectUrl;
      });
      onChange(id);
    } catch {
      toast.error(labels.uploadError);
    } finally {
      setUploading(false);
    }
  }

  function handleRemove() {
    setLocalUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    onChange(null);
  }

  async function handleDownload() {
    const url = buildFileOpenUrl(fileId);
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = `${downloadName ?? 'media'}.${extFromType(blob.type, kind)}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch {
      toast.error(labels.downloadError);
    }
  }

  const previewBox = (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-border/70 bg-muted/30',
        previewClassName
      )}
    >
      {hasMedia && previewUrl ? (
        kind === 'image' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={label}
            className="h-full w-full object-contain"
          />
        ) : (
          <video
            src={previewUrl}
            className="h-full w-full object-contain"
            muted
            loop
            autoPlay
            playsInline
          />
        )
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 border-dashed text-muted-foreground/50">
          {kind === 'image' ? (
            <ImageIcon className="size-6" />
          ) : (
            <VideoIcon className="size-6" />
          )}
          <span className="px-2 text-center text-[11px] leading-tight">
            {labels.empty}
          </span>
        </div>
      )}
      {uploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/70">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
    </div>
  );

  return (
    <div className={cn('space-y-1.5', className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleSelect}
      />

      <p className="text-xs font-medium text-muted-foreground">{label}</p>

      {previewBox}

      {description ? (
        <p className="text-[11px] text-muted-foreground/70">{description}</p>
      ) : null}

      <div className="flex items-center justify-end gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-7 w-7"
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
              {uploading
                ? labels.uploading
                : hasMedia
                  ? labels.replace
                  : labels.upload}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {hasMedia ? (
          <Dialog>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DialogTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="h-7 w-7"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </DialogTrigger>
                </TooltipTrigger>
                <TooltipContent>{labels.zoom}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <DialogContent className="flex max-h-[95vh] max-w-[95vw] flex-col gap-3 p-3 sm:max-w-[90vw]">
              <DialogTitle className="sr-only">{label}</DialogTitle>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto">
                {kind === 'image' && previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt={label}
                    className="max-h-[80vh] w-auto object-contain"
                  />
                ) : previewUrl ? (
                  <video
                    src={previewUrl}
                    className="max-h-[80vh] w-auto"
                    controls
                    loop
                    autoPlay
                    playsInline
                  />
                ) : null}
              </div>
              <DialogFooter className="gap-2 sm:justify-center">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDownload}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  {labels.download}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ) : null}

        {hasMedia ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-7 w-7 text-destructive hover:text-destructive"
                  disabled={disabled || uploading}
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
