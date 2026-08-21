import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Tabs } from '@/components/ui/tabs';
import { TabsOverflowList, type TabItem } from './tabs-overflow-list';

// jsdom has no ResizeObserver; the component only needs it to exist and be
// observable/disconnectable — the initial synchronous `calculate()` call
// inside useLayoutEffect is what actually drives the measurements in tests.
class FakeResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

/**
 * Stubs the measurement DOM reads the component performs:
 * - container.clientWidth (the outer relative/overflow-x-hidden div)
 * - each measurement <span aria-hidden> offsetWidth, keyed by its text (the item label)
 * - the "N Mais" measurement <button aria-hidden> offsetWidth
 *
 * These are defined on the prototypes (not on instances, since elements don't
 * exist until render() runs) and are re-defined per test.
 */
function stubMeasurements({
  containerWidth,
  moreWidth,
  itemWidths,
}: {
  containerWidth: number;
  moreWidth: number;
  itemWidths: Record<string, number>;
}) {
  Object.defineProperty(HTMLDivElement.prototype, 'clientWidth', {
    configurable: true,
    get() {
      const className = (this as HTMLDivElement).className ?? '';
      if (
        typeof className === 'string' &&
        className.includes('overflow-x-hidden')
      ) {
        return containerWidth;
      }
      return 0;
    },
  });

  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      const el = this as HTMLElement;
      if (el.tagName === 'BUTTON' && el.getAttribute('aria-hidden') === 'true') {
        return moreWidth;
      }
      if (el.tagName === 'SPAN' && el.getAttribute('aria-hidden') === 'true') {
        const label = el.textContent ?? '';
        return itemWidths[label] ?? 0;
      }
      return 0;
    },
  });
}

function makeItems(count: number): TabItem[] {
  return Array.from({ length: count }, (_, i) => ({
    value: `tab-${i}`,
    label: `Aba ${i}`,
  }));
}

function widthsFor(items: TabItem[], width: number) {
  return Object.fromEntries(items.map((item) => [String(item.label), width]));
}

function renderList(
  items: TabItem[],
  activeValue: string,
  onValueChange: (value: string) => void,
) {
  return render(
    <Tabs defaultValue={activeValue}>
      <TabsOverflowList
        items={items}
        activeValue={activeValue}
        onValueChange={onValueChange}
      />
    </Tabs>,
  );
}

describe('TabsOverflowList', () => {
  beforeEach(() => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
    Element.prototype.setPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('mostra todas as abas visíveis quando todas cabem no espaço disponível', () => {
    const items = makeItems(4);
    stubMeasurements({
      containerWidth: 1000,
      moreWidth: 96,
      itemWidths: widthsFor(items, 50),
    });

    renderList(items, 'tab-0', vi.fn());

    items.forEach((item) => {
      expect(screen.getByRole('tab', { name: String(item.label) })).toBeInTheDocument();
    });
    expect(screen.queryByRole('button', { name: /Mais/ })).not.toBeInTheDocument();
  });

  it('colapsa abas que não cabem em um dropdown "N Mais" e permite selecionar uma delas', async () => {
    const items = makeItems(4);
    stubMeasurements({
      containerWidth: 200,
      moreWidth: 50,
      itemWidths: widthsFor(items, 80),
    });
    const onValueChange = vi.fn();

    renderList(items, 'tab-0', onValueChange);

    // Only the first tab fits; the rest collapse into the overflow dropdown.
    expect(screen.getByRole('tab', { name: 'Aba 0' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Aba 1' })).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /3\s*Mais/ });
    expect(trigger).toBeInTheDocument();

    // jsdom has no real PointerEvent, so Radix's pointerdown-based open
    // handler never sees `button === 0`; opening via keyboard (Enter) is
    // the reliable way to trigger the dropdown in this environment.
    fireEvent.keyDown(trigger, { key: 'Enter' });

    const menu = await screen.findByRole('menu');
    const overflowItem = within(menu).getByText('Aba 2');
    fireEvent.click(overflowItem);

    expect(onValueChange).toHaveBeenCalledWith('tab-2');
  });

  it('força a aba ativa a permanecer visível mesmo quando ela estaria na posição de overflow', () => {
    const items = makeItems(4);
    stubMeasurements({
      containerWidth: 200,
      moreWidth: 50,
      itemWidths: widthsFor(items, 80),
    });

    // Without forcing, only index 0 ("Aba 0") would be visible. Making
    // "Aba 2" the active tab must force it into the visible slot instead,
    // pushing "Aba 0" into the overflow dropdown.
    renderList(items, 'tab-2', vi.fn());

    expect(screen.getByRole('tab', { name: 'Aba 2' })).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: 'Aba 0' })).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /3\s*Mais/ });
    expect(trigger).toBeInTheDocument();
  });

  it('usa a largura constante de fallback (96px) quando o botão "Mais" ainda não foi medido', () => {
    const items = makeItems(3);
    // moreWidth: 0 simulates the "N Mais" measurement button reporting an
    // offsetWidth of 0 (not yet laid out), forcing the component to fall
    // back to the hardcoded 96px constant instead of the measured value.
    stubMeasurements({
      containerWidth: 100,
      moreWidth: 0,
      itemWidths: widthsFor(items, 50),
    });

    renderList(items, 'tab-0', vi.fn());

    // available(100) - fallback moreWidth(96) = 4px budget: not even the
    // first 50px item fits, so all 3 items collapse into the dropdown.
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /3\s*Mais/ })).toBeInTheDocument();
  });

  it('usa o rótulo customizado passado via moreLabel', async () => {
    const items = makeItems(3);
    stubMeasurements({
      containerWidth: 150,
      moreWidth: 50,
      itemWidths: widthsFor(items, 80),
    });

    render(
      <Tabs defaultValue="tab-0">
        <TabsOverflowList
          items={items}
          activeValue="tab-0"
          onValueChange={vi.fn()}
          moreLabel="More"
        />
      </Tabs>,
    );

    const trigger = screen.getByRole('button', { name: /More/ });
    fireEvent.keyDown(trigger, { key: 'Enter' });
    expect(await screen.findByRole('menu')).toBeInTheDocument();
  });

  it('destaca o item ativo dentro do dropdown quando nenhuma aba cabe (visibleCount zero)', async () => {
    const items = makeItems(4);
    // Nothing fits at all (available budget goes negative), so even the
    // "force active tab visible" logic can't recover a slot — the active
    // tab itself ends up inside the overflow dropdown, highlighted.
    stubMeasurements({
      containerWidth: 10,
      moreWidth: 50,
      itemWidths: widthsFor(items, 80),
    });

    renderList(items, 'tab-1', vi.fn());

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();

    const trigger = screen.getByRole('button', { name: /4\s*Mais/ });
    fireEvent.keyDown(trigger, { key: 'Enter' });

    const menu = await screen.findByRole('menu');
    const activeMenuItem = within(menu).getByText('Aba 1').closest('[role="menuitem"]');
    expect(activeMenuItem).toHaveClass('bg-accent');
  });

  it('não quebra e não renderiza abas quando a lista de itens está vazia', () => {
    stubMeasurements({ containerWidth: 500, moreWidth: 96, itemWidths: {} });

    renderList([], 'tab-0', vi.fn());

    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mais/ })).not.toBeInTheDocument();
  });

  it('usa a largura de fallback (80px) para uma aba ainda não medida (offsetWidth zero)', () => {
    const items = makeItems(2);
    // Only "Aba 0" has a stubbed width; "Aba 1"'s measurement span reports
    // offsetWidth 0 (as if not yet laid out), forcing tabWidths.current[1]
    // to stay unset and the `?? 80` fallback to be used for it.
    stubMeasurements({
      containerWidth: 1000,
      moreWidth: 96,
      itemWidths: { 'Aba 0': 50 },
    });

    renderList(items, 'tab-0', vi.fn());

    items.forEach((item) => {
      expect(screen.getByRole('tab', { name: String(item.label) })).toBeInTheDocument();
    });
  });
});
