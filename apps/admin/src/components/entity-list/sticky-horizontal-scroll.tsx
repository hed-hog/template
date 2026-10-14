'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

const TABLE_CONTAINER_SELECTOR = '[data-slot="table-container"]';

type StickyHorizontalScrollProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Barra de rolagem horizontal que gruda no rodapé da janela enquanto a tabela
 * está na tela. A barra nativa do `<Table>` fica depois da última linha, e numa
 * tela estreita com muitas linhas o usuário nunca chega a vê-la.
 *
 * Quem rola de fato é o container que `Table` (`@/components/ui/table`) monta
 * em volta do `<table>`; esta barra é uma cópia sincronizada dele, com
 * `position: sticky` — então para sozinha no fim da tabela, sem calcular
 * posição. A barra nativa do container é escondida para não aparecerem duas;
 * toque e trackpad continuam rolando o próprio container.
 */
export function StickyHorizontalScroll({
  children,
  className,
}: StickyHorizontalScrollProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = useState(0);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const container = wrapperRef.current?.querySelector<HTMLElement>(
      TABLE_CONTAINER_SELECTOR
    );

    if (!container) return;

    const measure = () => {
      setScrollWidth(container.scrollWidth);
      setOverflowing(container.scrollWidth > container.clientWidth + 1);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver(measure);
    observer.observe(container);

    const table = container.querySelector('table');
    if (table) observer.observe(table);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const container = wrapperRef.current?.querySelector<HTMLElement>(
      TABLE_CONTAINER_SELECTOR
    );
    const bar = barRef.current;

    if (!container || !bar || !overflowing) return;

    // Cada lado só copia quando o valor difere, o que basta para o eco do
    // evento `scroll` do outro lado não voltar em loop.
    const syncFromContainer = () => {
      if (bar.scrollLeft !== container.scrollLeft) {
        bar.scrollLeft = container.scrollLeft;
      }
    };
    const syncFromBar = () => {
      if (container.scrollLeft !== bar.scrollLeft) {
        container.scrollLeft = bar.scrollLeft;
      }
    };

    syncFromContainer();
    container.addEventListener('scroll', syncFromContainer, { passive: true });
    bar.addEventListener('scroll', syncFromBar, { passive: true });

    return () => {
      container.removeEventListener('scroll', syncFromContainer);
      bar.removeEventListener('scroll', syncFromBar);
    };
  }, [overflowing]);

  return (
    <div
      ref={wrapperRef}
      className={cn(
        overflowing &&
          '[&_[data-slot=table-container]]:[scrollbar-width:none] [&_[data-slot=table-container]::-webkit-scrollbar]:hidden',
        className
      )}
    >
      {children}
      {overflowing ? (
        <div
          ref={barRef}
          data-slot="sticky-horizontal-scrollbar"
          aria-hidden="true"
          className="sticky bottom-0 z-10 overflow-x-auto overflow-y-hidden bg-background"
        >
          <div className="h-px" style={{ width: scrollWidth }} />
        </div>
      ) : null}
    </div>
  );
}
