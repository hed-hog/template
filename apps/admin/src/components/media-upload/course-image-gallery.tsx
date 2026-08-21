'use client';

import { FileTypeIcon } from '@/components/file-type-icon';
import { ImageCropDialog } from '@/components/image-crop/image-crop-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { buildImageUrl } from '@/lib/build-image-url';
import { useApp } from '@hed-hog/next-app-provider';
import {
  Eye,
  ImagePlus,
  Loader2,
  Power,
  PowerOff,
  Star,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import Image from 'next/image';
import { type ChangeEvent, useRef, useState } from 'react';
import { toast } from 'sonner';

export type CourseImageKind = 'logo' | 'banner' | 'square';

export type CourseImageItem = {
  id: number;
  fileId: number | null;
  filename: string | null;
  isPrimary: boolean;
  isActive: boolean;
  order: number;
};

export type CourseImageGallerySpec = {
  aspect: number;
  width: number;
  height: number;
  imageType: string;
};

type TranslateFn = (key: string, values?: Record<string, string | number>) => string;

type CourseImageGalleryProps = {
  courseId: string | number | null;
  type: CourseImageKind;
  label: string;
  spec: CourseImageGallerySpec;
  images: CourseImageItem[];
  onChanged: () => void | Promise<void>;
  t: TranslateFn;
};

export function CourseImageGallery({
  courseId,
  type,
  label,
  spec,
  images,
  onChanged,
  t,
}: CourseImageGalleryProps) {
  const { request } = useApp();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const specLabel =
    spec.width && spec.height ? `${spec.width}×${spec.height}px` : null;

  function handleSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('toasts.onlyImages'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('toasts.maxSize'));
      return;
    }
    setCropFile(file);
  }

  async function handleCropped(blob: Blob) {
    if (!courseId) return;
    setCropFile(null);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', new File([blob], `${type}.webp`, { type: 'image/webp' }));
      formData.append('destination', 'lms/courses');
      formData.append('imageType', spec.imageType);
      formData.append('maxWidth', String(spec.width));
      formData.append('maxHeight', String(spec.height));
      const uploadResponse = await request<{ id: number }>({
        url: '/file',
        method: 'POST',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const fileId = uploadResponse?.data?.id;
      if (!fileId) throw new Error('invalid file id');
      await request({
        url: `/lms/courses/${courseId}/images`,
        method: 'POST',
        data: { fileId, type },
      });
      await onChanged();
    } catch {
      toast.error(t('toasts.fileUploadError'));
    } finally {
      setUploading(false);
    }
  }

  async function openOriginal(fileId: number | null) {
    /* v8 ignore next -- unreachable: the triggering button is disabled under the same !image.fileId condition */
    if (!fileId) return;
    try {
      const response = await request<{ url?: string }>({
        url: `/file/open/${fileId}`,
        method: 'PUT',
      });
      const url = response?.data?.url;
      if (!url) {
        toast.error(t('toasts.openFileError'));
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error(t('toasts.openFileError'));
    }
  }

  async function setPrimary(image: CourseImageItem) {
    if (!courseId || image.isPrimary) return;
    setBusyId(image.id);
    try {
      await request({
        url: `/lms/courses/${courseId}/images/${image.id}/primary`,
        method: 'PATCH',
      });
      await onChanged();
    } catch {
      toast.error(t('toasts.fileUploadError'));
    } finally {
      setBusyId(null);
    }
  }

  async function toggleActive(image: CourseImageItem) {
    if (!courseId) return;
    setBusyId(image.id);
    try {
      await request({
        url: `/lms/courses/${courseId}/images/${image.id}/active`,
        method: 'PATCH',
        data: { isActive: !image.isActive },
      });
      await onChanged();
    } catch {
      toast.error(t('toasts.fileUploadError'));
    } finally {
      setBusyId(null);
    }
  }

  async function removeImage(image: CourseImageItem) {
    if (!courseId) return;
    setBusyId(image.id);
    try {
      await request({
        url: `/lms/courses/${courseId}/images/${image.id}`,
        method: 'DELETE',
      });
      // File cleanup is best-effort: a failure here shouldn't block the
      // list update (the course image was already removed successfully).
      if (image.fileId) {
        try {
          await request({
            url: '/file',
            method: 'DELETE',
            data: { ids: [image.fileId] },
          });
        } catch {
          /* an orphaned file is tolerable; continue the flow */
        }
      }
      await onChanged();
    } catch {
      toast.error(t('toasts.fileUploadError'));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {specLabel ? (
          <p className="text-[11px] text-muted-foreground/70">{specLabel}</p>
        ) : null}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleSelect}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((image) => {
          const preview = buildImageUrl(image.fileId);
          const busy = busyId === image.id;
          return (
            <div
              key={image.id}
              className="group relative overflow-hidden rounded-xl border border-border/70 bg-muted/30"
            >
              <div className="relative h-28 w-full">
                {preview ? (
                  <Image
                    src={preview}
                    alt={image.filename ?? label}
                    fill
                    sizes="200px"
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <FileTypeIcon filename={image.filename ?? 'image'} size={20} />
                  </div>
                )}
                {busy ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-1 px-2 pt-1">
                {image.isPrimary ? (
                  <Badge variant="secondary" className="h-5 gap-1 px-1.5 text-[10px]">
                    <Star className="h-3 w-3" />
                    {t('form.media.defaultBadge')}
                  </Badge>
                ) : null}
                {!image.isActive ? (
                  <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
                    {t('form.media.inactiveBadge')}
                  </Badge>
                ) : null}
              </div>

              <div className="flex items-center justify-end gap-0.5 px-1 py-1">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={busy || image.isPrimary}
                        onClick={() => setPrimary(image)}
                      >
                        <Star
                          className={
                            image.isPrimary
                              ? 'h-3.5 w-3.5 fill-current text-amber-500'
                              : 'h-3.5 w-3.5'
                          }
                        />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('form.media.setDefault')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={busy}
                        onClick={() => toggleActive(image)}
                      >
                        {image.isActive ? (
                          <Power className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <PowerOff className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {image.isActive
                        ? t('form.media.deactivate')
                        : t('form.media.activate')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        disabled={busy || !image.fileId}
                        onClick={() => openOriginal(image.fileId)}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('form.media.viewOriginalImage')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        disabled={busy}
                        onClick={() => removeImage(image)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{t('form.media.removeImage')}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
          );
        })}

        <button
          type="button"
          disabled={uploading || !courseId}
          onClick={() => inputRef.current?.click()}
          className="flex h-40 min-h-28 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-muted/20 text-muted-foreground transition hover:bg-muted/40 disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <UploadCloud className="h-5 w-5" />
          )}
          <span className="text-[11px]">{t('form.media.addImage')}</span>
        </button>

        {images.length === 0 && !uploading ? (
          <div className="col-span-full flex items-center gap-2 text-[11px] text-muted-foreground/70">
            <ImagePlus className="h-4 w-4" />
            {t('form.media.galleryEmpty')}
          </div>
        ) : null}
      </div>

      <ImageCropDialog
        open={Boolean(cropFile)}
        onOpenChange={(next) => {
          if (!next) setCropFile(null);
        }}
        file={cropFile}
        aspect={spec.aspect}
        outputWidth={spec.width}
        outputHeight={spec.height}
        onCropped={handleCropped}
      />
    </div>
  );
}
