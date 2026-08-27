import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

// Mesmo motivo do teste do ResizableSheetContent: o jsdom não tem
// PointerEvent, e o fallback do @testing-library descarta `clientX`.
function firePointer(
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  target: EventTarget,
  clientX: number
) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clientX', {
    value: clientX,
    configurable: true,
  });
  fireEvent(target as Node, event);
}

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const { dockedState, sheetWidthState, setPersistedWidth } = vi.hoisted(() => ({
  dockedState: { value: true },
  sheetWidthState: { value: 640 },
  setPersistedWidth: vi.fn(),
}));

vi.mock('@/hooks/use-media-query', () => ({
  useMediaQuery: () => dockedState.value,
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => false,
}));

vi.mock('@/hooks/use-persisted-sheet-width', () => ({
  usePersistedSheetWidth: () => [sheetWidthState.value, setPersistedWidth],
}));

import {
  DockablePanel,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from './dockable-panel';

const onOpenChange = vi.fn();

function setup(props: Partial<ComponentProps<typeof DockablePanel>> = {}) {
  return render(
    <DockablePanel
      panelId="test-panel"
      open
      onOpenChange={onOpenChange}
      defaultWidth={520}
      minWidth={320}
      maxWidth={860}
      {...props}
    >
      <PanelHeader>
        <PanelTitle>Configurações</PanelTitle>
        <PanelDescription>Descrição do painel</PanelDescription>
      </PanelHeader>
      <p>Conteúdo</p>
    </DockablePanel>
  );
}

function getDockedPanel() {
  return document.querySelector(
    '[data-slot="dockable-panel"]'
  ) as HTMLElement | null;
}

function getSheetContent() {
  return document.querySelector(
    '[data-slot="sheet-content"]'
  ) as HTMLElement | null;
}

describe('DockablePanel', () => {
  beforeEach(() => {
    dockedState.value = true;
    sheetWidthState.value = 640;
    setPersistedWidth.mockClear();
    onOpenChange.mockClear();
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      value: 1600,
    });
  });

  it('ancora como aside quando a tela é larga', () => {
    setup();

    const panel = getDockedPanel();
    expect(panel).toBeInTheDocument();
    expect(panel?.tagName).toBe('ASIDE');
    expect(getSheetContent()).not.toBeInTheDocument();
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('cai para folha sobreposta quando a tela é estreita', () => {
    dockedState.value = false;
    setup();

    expect(getDockedPanel()).not.toBeInTheDocument();
    expect(getSheetContent()).toBeInTheDocument();
  });

  it('não renderiza nada quando ancorado e fechado', () => {
    setup({ open: false });

    expect(getDockedPanel()).not.toBeInTheDocument();
    expect(screen.queryByText('Conteúdo')).not.toBeInTheDocument();
  });

  it('aplica a largura persistida e a alça de arrasto no modo ancorado', () => {
    setup();

    expect(getDockedPanel()?.style.width).toBe('640px');
    expect(
      screen.getByRole('button', { name: 'Resize panel' })
    ).toBeInTheDocument();
  });

  it('persiste a nova largura ao arrastar a alça do painel ancorado', () => {
    setup();
    const handle = screen.getByRole('button', { name: 'Resize panel' });

    firePointer('pointerdown', handle, 900);
    firePointer('pointermove', window, 850);
    firePointer('pointerup', window, 850);

    // startWidth 640, deltaX -50, borda esquerda de um painel à direita => 690
    expect(setPersistedWidth).toHaveBeenCalledWith(690);
  });

  it('reserva espaço para o vizinho quando containerWidth é informado', () => {
    // container 900 - 480 reservados = teto de 420, abaixo dos 640 salvos
    setup({ containerWidth: 900 });

    expect(getDockedPanel()?.style.width).toBe('420px');
  });

  it('fecha pelo X do painel ancorado', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'close' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('rotula a região ancorada pelo título do painel', () => {
    setup();

    const panel = getDockedPanel();
    const title = screen.getByRole('heading', { name: 'Configurações' });

    expect(title.tagName).toBe('H2');
    expect(panel?.getAttribute('aria-labelledby')).toBe(title.id);
    expect(panel).not.toHaveAttribute('aria-label');
  });

  it('usa o label explícito quando o painel não tem título próprio', () => {
    setup({ label: 'Propriedades do bloco' });

    const panel = getDockedPanel();
    expect(panel).toHaveAttribute('aria-label', 'Propriedades do bloco');
    expect(panel).not.toHaveAttribute('aria-labelledby');
  });

  it('mantém título e descrição visíveis no modo folha', () => {
    dockedState.value = false;
    setup();

    expect(screen.getByText('Configurações')).toBeInTheDocument();
    expect(screen.getByText('Descrição do painel')).toBeInTheDocument();
  });
});
