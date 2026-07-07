import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from './dropdown-menu';

// Radix's DropdownMenuTrigger opens on `pointerdown`, not `click`. jsdom's
// native `PointerEvent` (used by RTL's `fireEvent.pointerDown`) doesn't carry
// the properties Radix's handler expects, so we dispatch a plain event typed
// "pointerdown" instead (mirrors a real pointer interaction closely enough).
function openDropdownTrigger(trigger: HTMLElement) {
  fireEvent(
    trigger,
    new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }),
  );
}

describe('DropdownMenu', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
      })),
    );
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('abre o menu ao clicar no gatilho e exibe itens', async () => {
    const onSelectItem = vi.fn();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Abrir menu</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Ações</DropdownMenuLabel>
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={onSelectItem}>
              Editar
              <DropdownMenuShortcut>⌘E</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Excluir</DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const trigger = screen.getByText('Abrir menu');
    openDropdownTrigger(trigger);

    expect(await screen.findByText('Ações')).toBeInTheDocument();
    expect(screen.getByText('⌘E')).toBeInTheDocument();

    const deleteItem = screen.getByText('Excluir');
    expect(deleteItem.closest('[data-slot="dropdown-menu-item"]')).toHaveAttribute(
      'data-variant',
      'destructive',
    );

    fireEvent.click(screen.getByText('Editar'));
    expect(onSelectItem).toHaveBeenCalled();
  });

  it('suporta item com inset', async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent>
          <DropdownMenuItem inset>Item com recuo</DropdownMenuItem>
          <DropdownMenuLabel inset>Rótulo com recuo</DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = await screen.findByText('Item com recuo');
    expect(item.closest('[data-slot="dropdown-menu-item"]')).toHaveAttribute(
      'data-inset',
      'true',
    );
    expect(
      screen.getByText('Rótulo com recuo').closest('[data-slot="dropdown-menu-label"]'),
    ).toHaveAttribute('data-inset', 'true');
  });

  it('alterna um checkbox item', async () => {
    const onCheckedChange = vi.fn();
    function Wrapper() {
      return (
        <DropdownMenu defaultOpen>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem
              checked={false}
              onCheckedChange={onCheckedChange}
            >
              Mostrar detalhes
            </DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }
    render(<Wrapper />);

    const checkboxItem = await screen.findByText('Mostrar detalhes');
    fireEvent.click(checkboxItem);

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('seleciona um item de grupo de rádio', async () => {
    const onValueChange = vi.fn();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value="a" onValueChange={onValueChange}>
            <DropdownMenuRadioItem value="a">Opção A</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="b">Opção B</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    fireEvent.click(await screen.findByText('Opção B'));
    expect(onValueChange).toHaveBeenCalledWith('b');
  });

  it('renderiza um separador', async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent>
          <DropdownMenuItem>Item 1</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Item 2</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await screen.findByText('Item 1');
    expect(
      document.querySelector('[data-slot="dropdown-menu-separator"]'),
    ).toBeInTheDocument();
  });

  it('abre um submenu ao clicar no sub trigger', async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger inset>Mais opções</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Subitem</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const subTrigger = await screen.findByText('Mais opções');
    expect(
      subTrigger.closest('[data-slot="dropdown-menu-sub-trigger"]'),
    ).toHaveAttribute('data-inset', 'true');

    fireEvent.click(subTrigger);
    fireEvent.pointerMove(subTrigger);

    expect(await screen.findByText('Subitem')).toBeInTheDocument();
  });

  it('desabilita um item quando disabled', async () => {
    const onSelectItem = vi.fn();
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent>
          <DropdownMenuItem disabled onSelect={onSelectItem}>
            Indisponível
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const item = await screen.findByText('Indisponível');
    fireEvent.click(item);
    expect(onSelectItem).not.toHaveBeenCalled();
  });

  it('aplica className customizada ao conteúdo e sub-conteúdo', async () => {
    render(
      <DropdownMenu defaultOpen>
        <DropdownMenuContent className="custom-content" sideOffset={10}>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Submenu</DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent className="custom-sub-content">
                <DropdownMenuItem>Subitem</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    const subTrigger = await screen.findByText('Submenu');
    expect(
      document.querySelector('[data-slot="dropdown-menu-content"]'),
    ).toHaveClass('custom-content');

    fireEvent.click(subTrigger);
    fireEvent.pointerMove(subTrigger);
    await screen.findByText('Subitem');

    expect(
      document.querySelector('[data-slot="dropdown-menu-sub-content"]'),
    ).toHaveClass('custom-sub-content');
  });
});
