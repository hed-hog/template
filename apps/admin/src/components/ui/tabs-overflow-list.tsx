'use client';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';

export interface TabItem {
  value: string;
  label: ReactNode;
}

interface TabsOverflowListProps {
  items: TabItem[];
  activeValue: string;
  onValueChange: (value: string) => void;
  className?: string;
  listClassName?: string;
  triggerClassName?: string;
  moreLabel?: string;
}

/**
 * TabsList that collapses overflowing tabs into a "N Mais" dropdown.
 *
 * Pattern mirrors configurations/layout.tsx:
 * - All items always in DOM: visible → TabsTrigger, overflow → invisible
 *   absolute span (so tabRefs always have a valid offsetWidth for measurement).
 * - ResizeObserver is set up once and fires recalculate on every container resize.
 * - getComputedStyle reads the real padding + gap from the TabsList element so the
 *   budget calculation is always accurate, regardless of responsive class values.
 * - Active tab is always forced into the visible set (replaces the last slot).
 */
export function TabsOverflowList({
  items,
  activeValue,
  onValueChange,
  className,
  listClassName,
  triggerClassName,
  moreLabel = 'Mais',
}: TabsOverflowListProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<(HTMLElement | null)[]>([]);
  const tabWidths = useRef<number[]>([]);
  const [visibleCount, setVisibleCount] = useState(items.length);

  useLayoutEffect(() => {
    const container = containerRef.current;
    /* v8 ignore next -- unreachable: containerRef is always populated before this effect runs (the ref'd div renders unconditionally) */
    if (!container) return;

    const calculate = () => {
      // Cache widths from refs (spans for overflow slots, triggers for visible slots)
      tabRefs.current.forEach((el, idx) => {
        if (el && el.offsetWidth > 0) {
          tabWidths.current[idx] = el.offsetWidth;
        }
      });

      // Read actual computed padding and gap from the TabsList element.
      // listEl/cs are always non-null post-mount (listRef is populated before
      // this effect runs), so the `: 0` / `: null` sides of the ternaries
      // below are unreachable defensive fallbacks.
      const listEl: HTMLDivElement | null = listRef.current;
      /* v8 ignore next */
      const cs = listEl ? getComputedStyle(listEl) : null;
      /* v8 ignore next */
      const pl = cs ? parseFloat(cs.paddingLeft) || 0 : 0;
      /* v8 ignore next */
      const pr = cs ? parseFloat(cs.paddingRight) || 0 : 0;
      // gap property on flex containers
      /* v8 ignore next 3 */
      const gap = cs
        ? parseFloat(cs.columnGap || cs.gap?.split(' ')[0] || '0') || 0
        : 0;

      // Actual pixel budget inside the list's padding
      const available = container.clientWidth - pl - pr;

      // Width of the "N Mais ▾" button (prefer measured, fallback to constant).
      // moreBtnRef is always populated post-mount (the button renders
      // unconditionally), so the `?? 0` null-ref fallback is unreachable.
      const moreWidth =
        /* v8 ignore next 3 */
        (moreBtnRef.current?.offsetWidth ?? 0) > 0
          ? moreBtnRef.current!.offsetWidth
          : 96;

      const total = items.length;
      if (total === 0) return;

      let used = 0;
      let count = 0;

      for (let i = 0; i < total; i++) {
        const w = tabWidths.current[i] ?? 80;
        const gapBefore = count > 0 ? gap : 0;
        const allFit = count + 1 === total;
        // When all remaining tabs will fit, no "Mais" button needed
        const budget = allFit
          ? available
          : available - moreWidth - (count > 0 ? gap : 0);

        if (used + gapBefore + w <= budget) {
          used += gapBefore + w;
          count++;
        } else {
          break;
        }
      }

      setVisibleCount(count);
    };

    const observer = new ResizeObserver(calculate);
    observer.observe(container);
    calculate();
    return () => observer.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length]);

  // Compute visible set
  const rawVisible = Math.min(Math.max(0, visibleCount), items.length);
  const activeIndex = items.findIndex((t) => t.value === activeValue);

  let visibleIdxs: number[];
  if (rawVisible >= items.length) {
    visibleIdxs = items.map((_, i) => i);
  } else {
    visibleIdxs = Array.from({ length: rawVisible }, (_, i) => i);
    // Force the active tab to always appear (replaces the last visible slot)
    if (activeIndex >= rawVisible && activeIndex >= 0) {
      visibleIdxs[rawVisible - 1] = activeIndex;
      visibleIdxs.sort((a, b) => a - b);
    }
  }

  const visibleSet = new Set(visibleIdxs);
  const overflowIdxs = items.map((_, i) => i).filter((i) => !visibleSet.has(i));
  const activeInOverflow = activeIndex >= 0 && !visibleSet.has(activeIndex);

  return (
    <div
      ref={containerRef}
      className={cn('relative w-full overflow-x-hidden', className)}
    >
      {/* Measurement spans — always in DOM for ALL items */}
      {items.map((item, idx) => (
        <span
          key={`m-${item.value}`}
          ref={(el) => { tabRefs.current[idx] = el; }}
          aria-hidden="true"
          className={cn(
            'invisible absolute shrink-0 whitespace-nowrap',
            triggerClassName,
          )}
        >
          {item.label}
        </span>
      ))}

      {/* "N Mais" measurement span — always rendered so we can measure its width */}
      <button
        ref={moreBtnRef}
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        className={cn(
          'invisible absolute pointer-events-none shrink-0 inline-flex items-center gap-1',
          triggerClassName,
        )}
      >
        00&nbsp;{moreLabel}
        <ChevronDown className="size-3" />
      </button>

      <TabsList
        ref={listRef as unknown as React.Ref<HTMLDivElement>}
        className={cn('w-full', listClassName)}
      >
        {visibleIdxs.map((idx) => {
          const item = items[idx];
          /* v8 ignore next -- unreachable: visibleIdxs is always derived from valid indices into items (capped at items.length, activeIndex is a real findIndex result) */
          if (!item) return null;
          return (
            <TabsTrigger
              key={item.value}
              value={item.value}
              className={cn('shrink-0', triggerClassName)}
            >
              {item.label}
            </TabsTrigger>
          );
        })}

        {overflowIdxs.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'relative -ml-px inline-flex shrink-0 items-center justify-center gap-1',
                  'rounded-t-md rounded-b-none border border-border',
                  'bg-muted/60 font-medium text-muted-foreground transition-colors',
                  'hover:bg-muted hover:text-foreground',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  'ml-auto',
                  triggerClassName,
                  activeInOverflow &&
                    'z-10 -mb-px border-b-0 bg-background pb-px text-foreground',
                )}
              >
                {overflowIdxs.length}&nbsp;{moreLabel}
                <ChevronDown className="size-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {overflowIdxs.map((idx) => {
                const item = items[idx];
                /* v8 ignore next -- unreachable: overflowIdxs is always derived from valid indices into items (the complement of visibleIdxs, itself always in-range) */
                if (!item) return null;
                return (
                  <DropdownMenuItem
                    key={item.value}
                    onSelect={() => onValueChange(item.value)}
                    className={cn(
                      item.value === activeValue &&
                        'bg-accent text-accent-foreground',
                    )}
                  >
                    {item.label}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </TabsList>
    </div>
  );
}
