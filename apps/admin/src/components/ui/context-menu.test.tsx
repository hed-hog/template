import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  ContextMenu,
  ContextMenuCheckboxItem,
  ContextMenuContent,
  ContextMenuGroup,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuPortal,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from './context-menu';

function openMenu(trigger: HTMLElement) {
  fireEvent.contextMenu(trigger);
}

describe('ContextMenu', () => {
  it('abre o menu com o clique direito e exibe grupo, itens, checkbox, radio, separador e atalho', async () => {
    const onSelectItem = vi.fn();
    const onCheckedChange = vi.fn();

    function Harness() {
      const [checked, setChecked] = useState(false);
      const [radioValue, setRadioValue] = useState('a');
      return (
        <ContextMenu>
          <ContextMenuTrigger>Área de contexto</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuLabel>Ações</ContextMenuLabel>
            <ContextMenuLabel inset>Ações com recuo</ContextMenuLabel>
            <ContextMenuGroup>
              <ContextMenuItem onSelect={onSelectItem}>
                Item padrão
                <ContextMenuShortcut>⌘I</ContextMenuShortcut>
              </ContextMenuItem>
              <ContextMenuItem inset variant="destructive">
                Excluir
              </ContextMenuItem>
            </ContextMenuGroup>
            <ContextMenuSeparator />
            <ContextMenuCheckboxItem
              checked={checked}
              onCheckedChange={(value) => {
                setChecked(value);
                onCheckedChange(value);
              }}
            >
              Mostrar detalhes
            </ContextMenuCheckboxItem>
            <ContextMenuRadioGroup value={radioValue} onValueChange={setRadioValue}>
              <ContextMenuRadioItem value="a">Opção A</ContextMenuRadioItem>
              <ContextMenuRadioItem value="b">Opção B</ContextMenuRadioItem>
            </ContextMenuRadioGroup>
            <ContextMenuSub>
              <ContextMenuSubTrigger>Mais opções</ContextMenuSubTrigger>
              <ContextMenuPortal>
                <ContextMenuSubContent>
                  <ContextMenuItem>Sub item</ContextMenuItem>
                </ContextMenuSubContent>
              </ContextMenuPortal>
            </ContextMenuSub>
            <ContextMenuSub>
              <ContextMenuSubTrigger inset>Com recuo</ContextMenuSubTrigger>
              <ContextMenuSubContent>
                <ContextMenuItem>Sub item 2</ContextMenuItem>
              </ContextMenuSubContent>
            </ContextMenuSub>
          </ContextMenuContent>
        </ContextMenu>
      );
    }

    render(<Harness />);

    openMenu(screen.getByText('Área de contexto'));

    expect(await screen.findByText('Item padrão')).toBeInTheDocument();
    expect(screen.getByText('Excluir')).toBeInTheDocument();
    expect(screen.getByText('⌘I')).toBeInTheDocument();
    expect(screen.getByText('Ações')).toBeInTheDocument();
    expect(screen.getByText('Ações com recuo')).toBeInTheDocument();
    expect(screen.getByText('Mostrar detalhes')).toBeInTheDocument();
    expect(screen.getByText('Opção A')).toBeInTheDocument();
    expect(screen.getByText('Opção B')).toBeInTheDocument();
    expect(screen.getByText('Mais opções')).toBeInTheDocument();
    expect(screen.getByText('Com recuo')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Item padrão'));
    expect(onSelectItem).toHaveBeenCalled();

    openMenu(screen.getByText('Área de contexto'));
    fireEvent.click(await screen.findByText('Mostrar detalhes'));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('permite selecionar uma opção do grupo de rádio', async () => {
    function Harness() {
      const [radioValue, setRadioValue] = useState('a');
      return (
        <ContextMenu>
          <ContextMenuTrigger>Área de contexto</ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuRadioGroup value={radioValue} onValueChange={setRadioValue}>
              <ContextMenuRadioItem value="a">Opção A</ContextMenuRadioItem>
              <ContextMenuRadioItem value="b">Opção B</ContextMenuRadioItem>
            </ContextMenuRadioGroup>
          </ContextMenuContent>
        </ContextMenu>
      );
    }

    render(<Harness />);
    openMenu(screen.getByText('Área de contexto'));

    const optionB = await screen.findByText('Opção B');
    fireEvent.click(optionB);

    // Reopen to confirm the radio value changed
    openMenu(screen.getByText('Área de contexto'));
    const reopenedOptionB = await screen.findByText('Opção B');
    expect(reopenedOptionB.closest('[role="menuitemradio"]')).toHaveAttribute(
      'data-state',
      'checked',
    );
  });
});
