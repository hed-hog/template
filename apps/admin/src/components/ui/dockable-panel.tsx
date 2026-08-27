'use client';

import { XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as React from 'react';

import { useMediaQuery } from '@/hooks/use-media-query';
import { usePanelResize } from '@/hooks/use-panel-resize';
import { cn } from '@/lib/utils';

import { PanelResizeHandle } from './panel-resize-handle';
import { ResizableSheetContent } from './resizable-sheet-content';
import { Sheet, SheetDescription, SheetHeader, SheetTitle } from './sheet';

/**
 * Abaixo disso não sobra canvas para dividir com o painel, então ele volta a
 * ser uma folha sobreposta — o comportamento certo em tablet e celular.
 */
export const DOCK_MIN_VIEWPORT = 1280;

/** O que o painel ancorado nunca tira de quem divide a linha com ele. */
const SIBLING_MIN_WIDTH = 480;

type DockablePanelContextValue = {
  docked: boolean;
  titleId: string;
};

const DockablePanelContext =
  React.createContext<DockablePanelContextValue | null>(null);

type DockablePanelProps = {
  /** Chave de persistência da largura, compartilhada pelos dois modos. */
  panelId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  /**
   * Largura da linha que hospeda o painel, normalmente medida com um
   * `ResizeObserver`. Sem ela o clamp só conhece a viewport e o painel pode
   * espremer o conteúdo ao lado.
   */
  containerWidth?: number | null;
  /** No modo folha, bloqueia o resto da tela — para formulário de tela cheia. */
  sheetModal?: boolean;
  /**
   * Rótulo acessível do painel ancorado. Só é necessário para painel que não
   * usa `PanelTitle` (quem usa já é anunciado pelo próprio título).
   */
  label?: string;
  className?: string;
  onInteractOutside?: React.ComponentProps<
    typeof ResizableSheetContent
  >['onInteractOutside'];
  children?: React.ReactNode;
};

/**
 * Painel lateral que muda de forma com o espaço disponível: em tela larga é uma
 * coluna ancorada à direita, irmã do conteúdo e redimensionável pela borda; em
 * tela estreita é a folha sobreposta de sempre.
 *
 * Precisa ser renderizado no lugar do layout onde a coluna deve aparecer — no
 * modo folha o Radix portaliza e a posição na árvore não importa, mas no modo
 * ancorado ele é um irmão flex de verdade.
 *
 * A largura é persistida por painel e por usuário na mesma chave nos dois
 * modos (ver `usePersistedSheetWidth`), então quem arrasta a folha no notebook
 * encontra a mesma largura ancorada no monitor grande.
 */
export function DockablePanel({
  panelId,
  open,
  onOpenChange,
  defaultWidth = 480,
  minWidth = 320,
  maxWidth = 860,
  containerWidth = null,
  sheetModal = false,
  label,
  className,
  onInteractOutside,
  children,
}: DockablePanelProps) {
  const docked = useMediaQuery(`(min-width: ${DOCK_MIN_VIEWPORT}px)`);
  const titleId = React.useId();

  const context = React.useMemo(() => ({ docked, titleId }), [docked, titleId]);

  return (
    <DockablePanelContext.Provider value={context}>
      {docked ? (
        open ? (
          <DockedPanel
            panelId={panelId}
            defaultWidth={defaultWidth}
            minWidth={minWidth}
            maxWidth={maxWidth}
            containerWidth={containerWidth}
            titleId={titleId}
            label={label}
            className={className}
            onClose={() => onOpenChange(false)}
          >
            {children}
          </DockedPanel>
        ) : null
      ) : (
        <Sheet open={open} onOpenChange={onOpenChange} modal={sheetModal}>
          <ResizableSheetContent
            sheetId={panelId}
            defaultWidth={defaultWidth}
            minWidth={minWidth}
            maxWidth={maxWidth}
            className={className}
            onInteractOutside={onInteractOutside}
          >
            {children}
          </ResizableSheetContent>
        </Sheet>
      )}
    </DockablePanelContext.Provider>
  );
}

function DockedPanel({
  panelId,
  defaultWidth,
  minWidth,
  maxWidth,
  containerWidth,
  titleId,
  label,
  className,
  onClose,
  children,
}: {
  panelId: string;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  containerWidth: number | null;
  titleId: string;
  label?: string;
  className?: string;
  onClose: () => void;
  children?: React.ReactNode;
}) {
  const t = useTranslations('core.Sheet');
  const { width, isResizing, startResize } = usePanelResize({
    sheetId: panelId,
    defaultWidth,
    minWidth,
    maxWidth,
    side: 'right',
    containerWidth,
    siblingMinWidth: SIBLING_MIN_WIDTH,
  });

  return (
    <aside
      role="region"
      aria-label={label}
      aria-labelledby={label ? undefined : titleId}
      data-slot="dockable-panel"
      data-resizing={isResizing ? '' : undefined}
      // As classes espelham as não-posicionais do SheetContent para o conteúdo
      // não mudar de espaçamento ao trocar de modo.
      className={cn(
        'bg-background relative flex h-full shrink-0 flex-col gap-4 border-l',
        className
      )}
      style={{ width: `${width}px` }}
    >
      <PanelResizeHandle
        side="right"
        isResizing={isResizing}
        onPointerDown={startResize}
      />
      {children}
      {/* Ancorado não há Radix para fechar por Escape ou clique fora, e nem
          deveria: o painel é parte do layout. Sai por aqui ou pelo botão que
          o abriu. */}
      <button
        type="button"
        onClick={onClose}
        className="ring-offset-background focus:ring-ring absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden"
      >
        <XIcon className="size-4" />
        <span className="sr-only">{t('close')}</span>
      </button>
    </aside>
  );
}

/**
 * Cabeçalho do painel. `SheetHeader` já é uma `div` pura, então serve nos dois
 * modos sem ramificação.
 */
export const PanelHeader = SheetHeader;

/**
 * Título do painel.
 *
 * `SheetTitle` é o `Dialog.Title` do Radix e lança exceção fora de um
 * `Dialog.Root`, o que não existe no modo ancorado — daí a troca por um `h2`
 * com as mesmas classes, carregando o id que rotula a região.
 */
export function PanelTitle({
  className,
  ...props
}: React.ComponentProps<'h2'>) {
  const context = React.useContext(DockablePanelContext);

  if (context && !context.docked) {
    return <SheetTitle className={className} {...props} />;
  }

  return (
    <h2
      id={context?.titleId}
      data-slot="panel-title"
      className={cn('text-foreground font-semibold', className)}
      {...props}
    />
  );
}

/** Descrição do painel. Mesma razão do `PanelTitle` para a troca de primitivo. */
export function PanelDescription({
  className,
  ...props
}: React.ComponentProps<'p'>) {
  const context = React.useContext(DockablePanelContext);

  if (context && !context.docked) {
    return <SheetDescription className={className} {...props} />;
  }

  return (
    <p
      data-slot="panel-description"
      className={cn('text-muted-foreground text-sm', className)}
      {...props}
    />
  );
}
