'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, ZoomIn } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Cropper, { type Area } from 'react-easy-crop';
import { getCroppedBlob } from './crop-image';

export type ImageCropDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Source image picked by the user. Cleared/reopened resets the crop state. */
  file: File | null;
  /** Target aspect ratio (width / height), e.g. 850/256 or 1. */
  aspect: number;
  /** Output pixel size produced for upload. */
  outputWidth: number;
  outputHeight: number;
  cropShape?: 'rect' | 'round';
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  zoomLabel?: string;
  onCropped: (blob: Blob) => void | Promise<void>;
};

export function ImageCropDialog({
  open,
  onOpenChange,
  file,
  aspect,
  outputWidth,
  outputHeight,
  cropShape = 'rect',
  title,
  description,
  confirmLabel,
  cancelLabel,
  zoomLabel,
  onCropped,
}: ImageCropDialogProps) {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [areaPixels, setAreaPixels] = useState<Area | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!file) {
      setImageSrc(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setImageSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setAreaPixels(null);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onCropComplete = useCallback((_area: Area, areaInPixels: Area) => {
    setAreaPixels(areaInPixels);
  }, []);

  async function handleConfirm() {
    if (!imageSrc || !areaPixels) return;
    setProcessing(true);
    try {
      const blob = await getCroppedBlob(
        imageSrc,
        areaPixels,
        outputWidth,
        outputHeight,
      );
      await onCropped(blob);
      onOpenChange(false);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!processing) onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title ?? 'Recortar imagem'}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="relative h-[320px] w-full overflow-hidden rounded-md bg-muted">
          {imageSrc ? (
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={aspect}
              cropShape={cropShape}
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <ZoomIn className="size-4 shrink-0 text-muted-foreground" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-primary"
            aria-label={zoomLabel ?? 'Zoom'}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={processing}
            onClick={() => onOpenChange(false)}
          >
            {cancelLabel ?? 'Cancelar'}
          </Button>
          <Button
            type="button"
            className="gap-2"
            disabled={processing || !areaPixels}
            onClick={handleConfirm}
          >
            {processing ? <Loader2 className="size-4 animate-spin" /> : null}
            {confirmLabel ?? 'Aplicar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
