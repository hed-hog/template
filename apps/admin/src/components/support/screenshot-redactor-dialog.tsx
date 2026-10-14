'use client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eraser, Undo2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef, useState } from 'react';

type Rect = { x: number; y: number; w: number; h: number };

type ScreenshotRedactorDialogProps = {
  open: boolean;
  file: File | null;
  onCancel: () => void;
  onApply: (file: File) => void;
};

/**
 * "Borrar": o usuário arrasta retângulos sobre o print e cada área vira um
 * mosaico de blocos grandes, ilegível de verdade (um desfoque leve às vezes
 * ainda deixa ler números). Só a versão borrada sai do navegador.
 */
export function ScreenshotRedactorDialog({
  open,
  file,
  onCancel,
  onApply,
}: ScreenshotRedactorDialogProps) {
  const t = useTranslations('core.Support');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [rects, setRects] = useState<Rect[]>([]);
  const [draft, setDraft] = useState<Rect | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!open || !file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => setImage(img);
    img.src = url;
    // As áreas começam vazias porque quem abre troca a `key` do diálogo.
    return () => {
      URL.revokeObjectURL(url);
      setImage(null);
    };
  }, [open, file]);

  const render = useCallback(
    (withDraft: boolean) => {
      const canvas = canvasRef.current;
      if (!canvas || !image) return;
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(image, 0, 0);
      rects.forEach((rect) => pixelate(ctx, image, rect));
      if (withDraft && draft && draft.w > 0 && draft.h > 0) {
        ctx.save();
        ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
        ctx.strokeStyle = '#2563eb';
        ctx.lineWidth = Math.max(2, image.naturalWidth / 600);
        ctx.setLineDash([8, 6]);
        ctx.fillRect(draft.x, draft.y, draft.w, draft.h);
        ctx.strokeRect(draft.x, draft.y, draft.w, draft.h);
        ctx.restore();
      }
    },
    [image, rects, draft]
  );

  useEffect(() => {
    render(true);
  }, [render]);

  const toImagePoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    const bounds = canvas.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * canvas.width;
    const y = ((event.clientY - bounds.top) / bounds.height) * canvas.height;
    return {
      x: Math.min(Math.max(x, 0), canvas.width),
      y: Math.min(Math.max(y, 0), canvas.height),
    };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStart.current) return;
    const rect = normalizeRect(dragStart.current, toImagePoint(event));
    dragStart.current = null;
    setDraft(null);
    // Clique sem arrastar não vira área borrada.
    if (rect.w >= 4 && rect.h >= 4) setRects((prev) => [...prev, rect]);
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas || !file) return;
    render(false);
    canvas.toBlob((blob) => {
      if (blob) onApply(new File([blob], file.name, { type: 'image/png' }));
    }, 'image/png');
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
      <DialogContent className="max-h-[95vh] sm:max-w-[min(1200px,95vw)]">
        <DialogHeader>
          <DialogTitle>{t('redactTitle')}</DialogTitle>
          <DialogDescription>{t('redactDescription')}</DialogDescription>
        </DialogHeader>

        <div className="flex justify-center rounded-md border bg-muted/40 p-2">
          {image ? (
            <canvas
              ref={canvasRef}
              className="max-h-[60vh] max-w-full cursor-crosshair touch-none select-none"
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId);
                dragStart.current = toImagePoint(event);
                setDraft({ ...dragStart.current, w: 0, h: 0 });
              }}
              onPointerMove={(event) => {
                if (dragStart.current) {
                  setDraft(normalizeRect(dragStart.current, toImagePoint(event)));
                }
              }}
              onPointerUp={handlePointerUp}
            />
          ) : (
            <div className="py-20 text-sm text-muted-foreground">
              {t('redactLoading')}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!rects.length}
              onClick={() => setRects((prev) => prev.slice(0, -1))}
            >
              <Undo2 className="size-4" />
              {t('undo')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!rects.length}
              onClick={() => setRects([])}
            >
              <Eraser className="size-4" />
              {t('clear')}
            </Button>
            <span className="text-xs text-muted-foreground">
              {rects.length
                ? t('redactedCount', { count: rects.length })
                : t('noRedaction')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onCancel}>
              {t('cancel')}
            </Button>
            <Button onClick={handleApply} disabled={!image}>
              {t('apply')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function normalizeRect(
  a: { x: number; y: number },
  b: { x: number; y: number }
): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    w: Math.abs(a.x - b.x),
    h: Math.abs(a.y - b.y),
  };
}

/** Reduz a área a poucos pixels e amplia de volta sem suavização (mosaico). */
function pixelate(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: Rect
) {
  const block = Math.max(
    10,
    Math.round(Math.min(image.naturalWidth, image.naturalHeight) / 70)
  );
  const tinyW = Math.max(1, Math.ceil(rect.w / block));
  const tinyH = Math.max(1, Math.ceil(rect.h / block));
  const tiny = document.createElement('canvas');
  tiny.width = tinyW;
  tiny.height = tinyH;
  const tinyCtx = tiny.getContext('2d');
  if (!tinyCtx) return;
  tinyCtx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, tinyW, tinyH);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tiny, 0, 0, tinyW, tinyH, rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}
