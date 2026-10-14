import '@testing-library/jest-dom/vitest';
import { fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StickyHorizontalScroll } from './sticky-horizontal-scroll';

function renderWithTable() {
  return render(
    <StickyHorizontalScroll>
      <div data-slot="table-container">
        <table>
          <tbody>
            <tr>
              <td>linha</td>
            </tr>
          </tbody>
        </table>
      </div>
    </StickyHorizontalScroll>
  );
}

function mockWidths(scrollWidth: number, clientWidth: number) {
  vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(
    scrollWidth
  );
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(
    clientWidth
  );
}

describe('StickyHorizontalScroll', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('não mostra a barra quando a tabela cabe', () => {
    mockWidths(800, 800);
    const { container } = renderWithTable();

    expect(
      container.querySelector('[data-slot="sticky-horizontal-scrollbar"]')
    ).toBeNull();
  });

  it('mostra a barra e sincroniza a rolagem quando a tabela transborda', () => {
    mockWidths(1200, 600);
    const { container } = renderWithTable();

    const bar = container.querySelector<HTMLElement>(
      '[data-slot="sticky-horizontal-scrollbar"]'
    );
    const tableContainer = container.querySelector<HTMLElement>(
      '[data-slot="table-container"]'
    );

    expect(bar).not.toBeNull();
    expect(bar?.firstElementChild).toHaveStyle({ width: '1200px' });

    bar!.scrollLeft = 150;
    fireEvent.scroll(bar!);
    expect(tableContainer!.scrollLeft).toBe(150);

    tableContainer!.scrollLeft = 40;
    fireEvent.scroll(tableContainer!);
    expect(bar!.scrollLeft).toBe(40);
  });
});
