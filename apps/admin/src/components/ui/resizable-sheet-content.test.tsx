import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

// jsdom has no PointerEvent constructor, and the plain `Event` fallback used by
// @testing-library's createEvent/fireEvent.pointerX helpers silently drops
// unknown init keys like `clientX`. Build the native event manually and stamp
// `clientX` on as an own property so both React's synthetic PointerEvent
// (pointerdown, delegated through the button) and the raw window listeners
// (pointermove/pointerup, added via addEventListener) can read it.
function firePointer(type: 'pointerdown' | 'pointermove' | 'pointerup', target: EventTarget, clientX: number) {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clientX', { value: clientX, configurable: true });
  fireEvent(target, event);
}

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const { mobileState, sheetWidthState, setPersistedWidth } = vi.hoisted(() => ({
  mobileState: { value: false },
  sheetWidthState: { value: 640 },
  setPersistedWidth: vi.fn(),
}));

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mobileState.value,
}));

vi.mock('@/hooks/use-persisted-sheet-width', () => ({
  usePersistedSheetWidth: () => [sheetWidthState.value, setPersistedWidth],
}));

import { Sheet } from './sheet';
import { ResizableSheetContent } from './resizable-sheet-content';

function setup(props: Partial<ComponentProps<typeof ResizableSheetContent>> = {}) {
  return render(
    <Sheet open>
      <ResizableSheetContent sheetId="test-sheet" {...props}>
        <p>Conteúdo</p>
      </ResizableSheetContent>
    </Sheet>,
  );
}

function getSheetContentEl() {
  return screen.getByText('Conteúdo').closest('[data-slot="sheet-content"]') as HTMLElement;
}

describe('ResizableSheetContent', () => {
  beforeEach(() => {
    mobileState.value = false;
    sheetWidthState.value = 640;
    setPersistedWidth.mockClear();
    Object.defineProperty(window, 'innerWidth', { writable: true, value: 1024 });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza a alça de redimensionamento por padrão (lado direito, desktop)', () => {
    setup();
    const handle = screen.getByRole('button', { name: 'Resize panel' });
    expect(handle).toBeInTheDocument();
    expect(handle.className).toContain('-left-1.5');
  });

  it('renderiza a alça no lado esquerdo com posicionamento inverso', () => {
    setup({ side: 'left' });
    const handle = screen.getByRole('button', { name: 'Resize panel' });
    expect(handle.className).toContain('-right-1.5');
  });

  it('não renderiza a alça quando enableResize é falso', () => {
    setup({ enableResize: false });
    expect(screen.queryByRole('button', { name: 'Resize panel' })).not.toBeInTheDocument();
  });

  it('não renderiza a alça em mobile e aplica largura de tela cheia', () => {
    mobileState.value = true;
    setup();
    expect(screen.queryByRole('button', { name: 'Resize panel' })).not.toBeInTheDocument();
    const content = getSheetContentEl();
    expect(content.className).toContain('w-screen');
    expect(content.style.width).toBe('100vw');
    expect(content.style.maxWidth).toBe('100vw');
  });

  it('não renderiza a alça para os lados top/bottom e não aplica largura no estilo', () => {
    setup({ side: 'top' });
    expect(screen.queryByRole('button', { name: 'Resize panel' })).not.toBeInTheDocument();
    const content = getSheetContentEl();
    expect(content.style.width).toBe('');
  });

  it('renderiza normalmente quando maxWidth é infinito antes de conhecer a viewport', () => {
    setup({ maxWidth: Number.POSITIVE_INFINITY });
    expect(screen.getByRole('button', { name: 'Resize panel' })).toBeInTheDocument();
  });

  it('arrasta a alça e persiste a nova largura ao soltar (lado direito)', () => {
    setup({ minWidth: 300, maxWidth: 900 });
    const handle = screen.getByRole('button', { name: 'Resize panel' });

    firePointer('pointerdown', handle, 500);
    firePointer('pointermove', window, 450);
    firePointer('pointerup', window, 450);

    // startWidth 640, deltaX -50, side=right => 640 - (-50) = 690
    expect(setPersistedWidth).toHaveBeenCalledWith(690);
  });

  it('faz clamp no mínimo ao arrastar além do limite inferior', () => {
    setup({ minWidth: 300, maxWidth: 900 });
    const handle = screen.getByRole('button', { name: 'Resize panel' });

    firePointer('pointerdown', handle, 500);
    firePointer('pointermove', window, 5000);
    firePointer('pointerup', window, 5000);

    expect(setPersistedWidth).toHaveBeenCalledWith(300);
  });

  it('faz clamp no máximo ao arrastar além do limite superior', () => {
    setup({ minWidth: 300, maxWidth: 900 });
    const handle = screen.getByRole('button', { name: 'Resize panel' });

    firePointer('pointerdown', handle, 500);
    firePointer('pointermove', window, -5000);
    firePointer('pointerup', window, -5000);

    expect(setPersistedWidth).toHaveBeenCalledWith(900);
  });

  it('arrasta a alça do lado esquerdo somando o delta', () => {
    setup({ side: 'left', minWidth: 300, maxWidth: 900 });
    const handle = screen.getByRole('button', { name: 'Resize panel' });

    firePointer('pointerdown', handle, 500);
    firePointer('pointermove', window, 550);
    firePointer('pointerup', window, 550);

    // startWidth 640, deltaX +50, side=left => 640 + 50 = 690
    expect(setPersistedWidth).toHaveBeenCalledWith(690);
  });

  it('soltar sem mover não persiste (previewWidth nulo)', () => {
    setup();
    const handle = screen.getByRole('button', { name: 'Resize panel' });

    firePointer('pointerdown', handle, 500);
    firePointer('pointerup', window, 500);

    expect(setPersistedWidth).not.toHaveBeenCalled();
  });

  it('remove os listeners de pointermove/pointerup ao desmontar durante o redimensionamento', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = setup();
    const handle = screen.getByRole('button', { name: 'Resize panel' });

    firePointer('pointerdown', handle, 500);
    unmount();

    expect(removeSpy).toHaveBeenCalledWith('pointermove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('pointerup', expect.any(Function));
  });

  it('aplica className adicional recebida via props', () => {
    setup({ className: 'custom-sheet-class' });
    expect(getSheetContentEl().className).toContain('custom-sheet-class');
  });
});
