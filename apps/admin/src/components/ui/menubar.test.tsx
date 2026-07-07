import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// jsdom has no PointerEvent constructor, so @testing-library/dom's
// fireEvent.pointerDown(...) silently drops init fields like `button`/
// `ctrlKey` (Radix Menubar's trigger checks those to decide whether to
// open). Polyfill a minimal PointerEvent based on MouseEvent so those
// fields actually reach the handler, matching the pattern Radix itself
// recommends for jsdom-based tests.
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    pointerId?: number;
    pointerType?: string;

    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
      this.pointerId = params.pointerId;
      this.pointerType = params.pointerType;
    }
  }
  // @ts-expect-error - test-only jsdom polyfill
  window.PointerEvent = PointerEventPolyfill;
}

// Radix Menubar relies on pointer-capture / scroll APIs jsdom doesn't implement.
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
  Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

function openMenu(triggerText: string) {
  const trigger = screen.getByText(triggerText);
  fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false, pointerType: 'mouse' });
  return trigger;
}

import {
  Menubar,
  MenubarCheckboxItem,
  MenubarContent,
  MenubarGroup,
  MenubarItem,
  MenubarLabel,
  MenubarMenu,
  MenubarPortal,
  MenubarRadioGroup,
  MenubarRadioItem,
  MenubarSeparator,
  MenubarShortcut,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from './menubar';

function FullMenubar({
  onCheckedChange,
  onRadioChange,
  onItemSelect,
}: {
  onCheckedChange?: (checked: boolean) => void;
  onRadioChange?: (value: string) => void;
  onItemSelect?: () => void;
}) {
  const [checked, setChecked] = useState(false);
  const [radioValue, setRadioValue] = useState('one');

  return (
    <Menubar>
      <MenubarMenu>
        <MenubarTrigger>Arquivo</MenubarTrigger>
        <MenubarPortal>
          <MenubarContent>
            <MenubarGroup>
              <MenubarLabel>Ações</MenubarLabel>
              <MenubarItem onSelect={onItemSelect}>
                Novo
                <MenubarShortcut>Ctrl+N</MenubarShortcut>
              </MenubarItem>
              <MenubarItem inset>Item com recuo</MenubarItem>
              <MenubarItem variant="destructive">Excluir</MenubarItem>
              <MenubarItem disabled>Desabilitado</MenubarItem>
            </MenubarGroup>

            <MenubarSeparator />

            <MenubarCheckboxItem
              checked={checked}
              onCheckedChange={(value) => {
                setChecked(value);
                onCheckedChange?.(value);
              }}
            >
              Mostrar barra de status
            </MenubarCheckboxItem>

            <MenubarSeparator />

            <MenubarRadioGroup
              value={radioValue}
              onValueChange={(value) => {
                setRadioValue(value);
                onRadioChange?.(value);
              }}
            >
              <MenubarRadioItem value="one">Opção 1</MenubarRadioItem>
              <MenubarRadioItem value="two">Opção 2</MenubarRadioItem>
            </MenubarRadioGroup>

            <MenubarSeparator />

            <MenubarSub>
              <MenubarSubTrigger>Mais opções</MenubarSubTrigger>
              <MenubarPortal>
                <MenubarSubContent>
                  <MenubarItem>Sub item</MenubarItem>
                </MenubarSubContent>
              </MenubarPortal>
            </MenubarSub>

            <MenubarSub>
              <MenubarSubTrigger inset>Sub com recuo</MenubarSubTrigger>
              <MenubarPortal>
                <MenubarSubContent>
                  <MenubarItem>Outro sub item</MenubarItem>
                </MenubarSubContent>
              </MenubarPortal>
            </MenubarSub>
          </MenubarContent>
        </MenubarPortal>
      </MenubarMenu>
    </Menubar>
  );
}

describe('Menubar', () => {
  it('abre o menu ao clicar no gatilho e mostra os itens', async () => {
    render(<FullMenubar />);

    expect(screen.queryByText('Novo')).not.toBeInTheDocument();

    openMenu('Arquivo');

    expect(await screen.findByText('Novo')).toBeInTheDocument();
    expect(screen.getByText('Ctrl+N')).toBeInTheDocument();
    expect(screen.getByText('Item com recuo')).toBeInTheDocument();
    expect(screen.getByText('Excluir')).toBeInTheDocument();
    expect(screen.getByText('Desabilitado')).toBeInTheDocument();
    expect(screen.getByText('Ações')).toBeInTheDocument();
    expect(screen.getByText('Mostrar barra de status')).toBeInTheDocument();
    expect(screen.getByText('Opção 1')).toBeInTheDocument();
    expect(screen.getByText('Opção 2')).toBeInTheDocument();
    expect(screen.getByText('Mais opções')).toBeInTheDocument();
    expect(screen.getByText('Sub com recuo')).toBeInTheDocument();
  });

  it('seleciona um item e dispara onSelect', async () => {
    const onItemSelect = vi.fn();
    render(<FullMenubar onItemSelect={onItemSelect} />);

    openMenu('Arquivo');
    const item = await screen.findByText('Novo');
    fireEvent.click(item);

    expect(onItemSelect).toHaveBeenCalled();
  });

  it('alterna o checkbox item e reflete o estado marcado', async () => {
    const onCheckedChange = vi.fn();
    render(<FullMenubar onCheckedChange={onCheckedChange} />);

    openMenu('Arquivo');
    const checkboxItem = await screen.findByText('Mostrar barra de status');
    fireEvent.click(checkboxItem);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('seleciona um item do grupo de rádio', async () => {
    const onRadioChange = vi.fn();
    render(<FullMenubar onRadioChange={onRadioChange} />);

    openMenu('Arquivo');
    const radioItem = await screen.findByText('Opção 2');
    fireEvent.click(radioItem);

    expect(onRadioChange).toHaveBeenCalledWith('two');
  });

  it('não dispara onSelect em item desabilitado', async () => {
    const onItemSelect = vi.fn();
    render(<FullMenubar onItemSelect={onItemSelect} />);

    openMenu('Arquivo');
    const disabledItem = await screen.findByText('Desabilitado');
    fireEvent.click(disabledItem);

    expect(onItemSelect).not.toHaveBeenCalled();
  });

  it('renderiza item com variante destructive', async () => {
    render(<FullMenubar />);

    openMenu('Arquivo');
    const destructiveItem = await screen.findByText('Excluir');
    expect(destructiveItem.closest('[data-slot="menubar-item"]')).toHaveAttribute(
      'data-variant',
      'destructive',
    );
  });

  it('aplica data-inset em itens e sub-triggers com inset', async () => {
    render(<FullMenubar />);

    openMenu('Arquivo');
    const insetItem = await screen.findByText('Item com recuo');
    expect(insetItem.closest('[data-slot="menubar-item"]')).toHaveAttribute(
      'data-inset',
      'true',
    );

    const insetSubTrigger = screen.getByText('Sub com recuo');
    expect(
      insetSubTrigger.closest('[data-slot="menubar-sub-trigger"]'),
    ).toHaveAttribute('data-inset', 'true');
  });

  it('abre o submenu ao clicar no sub-trigger e mostra o MenubarSubContent', async () => {
    render(<FullMenubar />);

    openMenu('Arquivo');
    const subTrigger = await screen.findByText('Mais opções');
    fireEvent.click(subTrigger);

    expect(await screen.findByText('Sub item')).toBeInTheDocument();
  });

  it('aceita className customizada no Menubar raiz', () => {
    const { container } = render(
      <Menubar className="custom-menubar">
        <MenubarMenu>
          <MenubarTrigger>Arquivo</MenubarTrigger>
          <MenubarPortal>
            <MenubarContent>
              <MenubarItem>Item</MenubarItem>
            </MenubarContent>
          </MenubarPortal>
        </MenubarMenu>
      </Menubar>,
    );

    expect(container.querySelector('[data-slot="menubar"]')).toHaveClass(
      'custom-menubar',
    );
  });
});
