'use client';

import * as React from 'react';

import { usePersistedSheetWidth } from '@/hooks/use-persisted-sheet-width';

export type PanelResizeSide = 'left' | 'right';

type UsePanelResizeOptions = {
  /** Chave de persistência da largura — a mesma nos modos folha e ancorado. */
  sheetId: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  side?: PanelResizeSide;
  /** Liga a leitura/escrita da largura no storage. */
  enabled?: boolean;
  /** Liga o arrasto. Fica falso em mobile e nos lados top/bottom. */
  canResize?: boolean;
  /**
   * Largura da linha que hospeda o painel. A viewport sozinha não serve para
   * um painel ancorado: a sidebar do admin já consumiu parte dela, então o
   * clamp pela viewport deixaria o painel comer o vizinho.
   */
  containerWidth?: number | null;
  /** Espaço que o painel nunca tira de quem divide a linha com ele. */
  siblingMinWidth?: number;
};

const VIEWPORT_GUTTER = 24;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Motor de redimensionamento por arrasto compartilhado pelos dois modos de
 * painel lateral: a folha (`ResizableSheetContent`) e o painel ancorado
 * (`DockablePanel`). Mantém o clamp contra a viewport, a persistência da
 * largura e o drag por pointer events em um lugar só, para que arrastar a
 * borda pareça igual nos dois.
 */
export function usePanelResize({
  sheetId,
  defaultWidth,
  minWidth,
  maxWidth,
  side = 'right',
  enabled = true,
  canResize = true,
  containerWidth = null,
  siblingMinWidth = 0,
}: UsePanelResizeOptions) {
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

  let widthCeiling = maxWidth;

  if (viewportWidth != null) {
    widthCeiling = Math.min(widthCeiling, viewportWidth - VIEWPORT_GUTTER);
  }

  if (containerWidth != null) {
    widthCeiling = Math.min(widthCeiling, containerWidth - siblingMinWidth);
  }

  // Antes do primeiro efeito não se sabe a viewport, e um maxWidth infinito
  // não serve de teto para o clamp — nesse intervalo vale o defaultWidth.
  const effectiveMaxWidth = Number.isFinite(widthCeiling)
    ? Math.max(minWidth, widthCeiling)
    : defaultWidth;

  const [persistedWidth, setPersistedWidth] = usePersistedSheetWidth({
    sheetId,
    defaultWidth,
    minWidth,
    maxWidth: effectiveMaxWidth,
    enabled,
  });

  const [previewWidth, setPreviewWidth] = React.useState<number | null>(null);
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeStateRef = React.useRef({
    startX: 0,
    startWidth: persistedWidth,
  });

  const width = clamp(
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

  const startResize = React.useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      /* v8 ignore next 3 -- unreachable: só a alça chama isso, e ela só existe quando canResize é true */
      if (!canResize) {
        return;
      }

      event.preventDefault();
      resizeStateRef.current = {
        startX: event.clientX,
        startWidth: width,
      };
      setIsResizing(true);
    },
    [canResize, width]
  );

  return { width, isResizing, startResize };
}
