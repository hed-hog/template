'use client';

import * as React from 'react';

import { useIsMobile } from '@/hooks/use-mobile';
import { usePanelResize } from '@/hooks/use-panel-resize';
import { cn } from '@/lib/utils';

import { PanelResizeHandle } from './panel-resize-handle';
import { SheetContent } from './sheet';

type SheetSide = 'top' | 'right' | 'bottom' | 'left';

type ResizableSheetContentProps = React.ComponentProps<typeof SheetContent> & {
  sheetId: string;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  enableResize?: boolean;
};

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
  const isHorizontal = side === 'right' || side === 'left';
  const canResize = enableResize && !isMobile && isHorizontal;

  const { width, isResizing, startResize } = usePanelResize({
    sheetId,
    defaultWidth,
    minWidth,
    maxWidth,
    side: side === 'left' ? 'left' : 'right',
    enabled: enableResize,
    canResize,
  });

  const computedStyle: React.CSSProperties = {
    ...style,
    ...(isHorizontal
      ? isMobile
        ? {
            width: '100vw',
            maxWidth: '100vw',
          }
        : {
            width: `${width}px`,
            maxWidth: `${width}px`,
          }
      : {}),
  };

  return (
    <SheetContent
      side={side as SheetSide}
      className={cn(
        isMobile && isHorizontal && 'w-screen max-w-none',
        className
      )}
      style={computedStyle}
      {...props}
    >
      {canResize ? (
        <PanelResizeHandle
          side={side === 'left' ? 'left' : 'right'}
          isResizing={isResizing}
          onPointerDown={startResize}
        />
      ) : null}
      {children}
    </SheetContent>
  );
}
