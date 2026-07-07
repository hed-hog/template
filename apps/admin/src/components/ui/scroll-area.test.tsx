import '@testing-library/jest-dom/vitest';
import * as ScrollAreaPrimitive from '@radix-ui/react-scroll-area';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import { ScrollArea, ScrollBar } from './scroll-area';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
      unobserve: vi.fn(),
    }))
  );
});

describe('ScrollArea', () => {
  it('renderiza viewport e o slot base com a className aplicada', () => {
    const { container } = render(
      <ScrollArea className="h-40">
        <div>conteúdo</div>
      </ScrollArea>
    );
    expect(container.querySelector('[data-slot="scroll-area"]')).toHaveClass('h-40');
    expect(container.querySelector('[data-slot="scroll-area-viewport"]')).toBeInTheDocument();
    expect(container.textContent).toContain('conteúdo');
  });

  it('renderiza a scrollbar com type="always" (sempre visível)', () => {
    // Radix's default scrollbar type is "hover", which gates the scrollbar
    // behind pointerenter/leave events and Presence — never satisfied in jsdom.
    // `type="always"` renders the scrollbar unconditionally so we can assert
    // the markup the ScrollBar component itself produces. (The thumb itself
    // additionally requires a measured content/viewport overflow ratio, which
    // jsdom never reports since there's no real layout engine — its JSX is
    // still executed and covered via this render regardless.)
    const { container } = render(
      <ScrollArea type="always">
        <div>conteúdo</div>
      </ScrollArea>
    );
    expect(container.querySelector('[data-slot="scroll-area-scrollbar"]')).toBeInTheDocument();
  });
});

describe('ScrollBar', () => {
  // ScrollAreaScrollbar relies on Radix's ScrollArea context, so it must be
  // rendered inside a ScrollAreaPrimitive.Root (the ScrollBar component
  // itself is exported standalone for composition, but Radix requires the
  // surrounding provider at runtime). `type="always"` avoids the
  // visibility/overflow Presence gating that jsdom never satisfies.
  function renderScrollBar(props: React.ComponentProps<typeof ScrollBar> = {}) {
    return render(
      <ScrollAreaPrimitive.Root type="always">
        <ScrollBar {...props} />
      </ScrollAreaPrimitive.Root>
    );
  }

  it('usa orientação vertical por padrão', () => {
    const { container } = renderScrollBar();
    const el = container.querySelector('[data-slot="scroll-area-scrollbar"]');
    expect(el).toHaveAttribute('data-orientation', 'vertical');
    expect(el).toHaveClass('h-full');
  });

  it('aplica classes específicas para orientação horizontal', () => {
    const { container } = renderScrollBar({ orientation: 'horizontal' });
    const el = container.querySelector('[data-slot="scroll-area-scrollbar"]');
    expect(el).toHaveAttribute('data-orientation', 'horizontal');
    expect(el).toHaveClass('flex-col');
  });

  it('mescla className customizada', () => {
    const { container } = renderScrollBar({ className: 'custom-bar' });
    expect(container.querySelector('[data-slot="scroll-area-scrollbar"]')).toHaveClass(
      'custom-bar'
    );
  });
});
