'use client';

import { GripVerticalIcon } from 'lucide-react';
import * as React from 'react';

import { useIsMobile } from '@/hooks/use-mobile';
import { usePersistedSheetWidth } from '@/hooks/use-persisted-sheet-width';
import { cn } from '@/lib/utils';

import { SheetContent } from './sheet';

type SheetSide = 'top' | 'right' | 'bottom' | 'left';

type ResizableSheetContentProps = React.ComponentProps<typeof SheetContent> & {
  sheetId: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  enableResize?: boolean;
};

const VIEWPORT_GUTTER = 24;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function ResizableSheetContent({
  sheetId,
  defaultWidth = 640,
  minWidth = 420,
  maxWidth = 1280,
  enableResize = true,
  side = 'right',
  className,
  style,
  children,
  ...props
}: ResizableSheetContentProps) {
  const isMobile = useIsMobile();
  const canResize =
    enableResize && !isMobile && (side === 'right' || side === 'left');

  const [viewportWidth, setViewportWidth] = React.useState<number | null>(null);

  React.useEffect(() => {
    function updateViewportWidth() {
      setViewportWidth(window.innerWidth);
    }

    updateViewportWidth();
    window.addEventListener('resize', updateViewportWidth);

    return () => {
      window.removeEventListener('resize', updateViewportWidth);
    };
  }, []);

  const effectiveMaxWidth =
    viewportWidth != null
      ? Math.min(maxWidth, viewportWidth - VIEWPORT_GUTTER)
      : Number.isFinite(maxWidth)
        ? maxWidth
        : defaultWidth;

  const [persistedWidth, setPersistedWidth] = usePersistedSheetWidth({
    sheetId,
    defaultWidth,
    minWidth,
    maxWidth: effectiveMaxWidth,
    enabled: enableResize,
  });

  const [previewWidth, setPreviewWidth] = React.useState<number | null>(null);
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeStateRef = React.useRef({
    startX: 0,
    startWidth: persistedWidth,
  });

  const currentWidth = clamp(
    previewWidth ?? persistedWidth,
    minWidth,
    effectiveMaxWidth
  );

  React.useEffect(() => {
    if (!isResizing) {
      return;
    }

    function handlePointerMove(event: PointerEvent) {
      const deltaX = event.clientX - resizeStateRef.current.startX;
      const resizedWidth =
        side === 'right'
          ? resizeStateRef.current.startWidth - deltaX
          : resizeStateRef.current.startWidth + deltaX;

      setPreviewWidth(clamp(resizedWidth, minWidth, effectiveMaxWidth));
    }

    function handlePointerUp() {
      setIsResizing(false);

      if (previewWidth !== null) {
        setPersistedWidth(previewWidth);
      }

      setPreviewWidth(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [
    isResizing,
    effectiveMaxWidth,
    minWidth,
    previewWidth,
    setPersistedWidth,
    side,
  ]);

  const handleResizeStart = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      /* v8 ignore next 3 -- unreachable: this handler is only attached to the resize button, which itself only renders when canResize is true */
      if (!canResize) {
        return;
      }

      event.preventDefault();
      resizeStateRef.current = {
        startX: event.clientX,
        startWidth: currentWidth,
      };
      setIsResizing(true);
    },
    [canResize, currentWidth]
  );

  const computedStyle: React.CSSProperties = {
    ...style,
    ...(side === 'right' || side === 'left'
      ? isMobile
        ? {
            width: '100vw',
            maxWidth: '100vw',
          }
        : {
            width: `${currentWidth}px`,
            maxWidth: `${currentWidth}px`,
          }
      : {}),
  };

  return (
    <SheetContent
      side={side as SheetSide}
      className={cn(
        isMobile &&
          (side === 'right' || side === 'left') &&
          'w-screen max-w-none',
        className
      )}
      style={computedStyle}
      {...props}
    >
      {canResize ? (
        <button
          type="button"
          aria-label="Resize panel"
          className={cn(
            'group absolute top-0 z-10 flex h-full w-3 cursor-ew-resize items-center justify-center',
            side === 'right' ? '-left-1.5' : '-right-1.5'
          )}
          onPointerDown={handleResizeStart}
        >
          <span
            className={cn(
              'absolute inset-y-0 w-px transition-colors duration-150',
              isResizing
                ? 'bg-primary'
                : 'bg-border delay-0 group-hover:bg-primary/70 group-hover:delay-150'
            )}
          />
          <span
            className={cn(
              'relative z-10 pointer-events-none rounded-full border p-0.5 shadow-sm transition-colors',
              isResizing
                ? 'border-primary bg-primary/15 text-primary-foreground'
                : 'bg-border/80 text-muted-foreground/70 group-hover:border-primary group-hover:bg-primary/15 group-hover:text-primary-foreground'
            )}
          >
            <GripVerticalIcon className="size-3" />
          </span>
        </button>
      ) : null}
      {children}
    </SheetContent>
  );
}
