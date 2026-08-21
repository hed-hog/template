import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from './command';

describe('Command', () => {
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

  it('renderiza itens e filtra pelo texto digitado', () => {
    render(
      <Command>
        <CommandInput placeholder="Buscar..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado</CommandEmpty>
          <CommandGroup heading="Frutas">
            <CommandItem value="maçã">Maçã</CommandItem>
            <CommandItem value="banana">Banana</CommandItem>
            <CommandSeparator />
            <CommandItem value="uva">
              Uva
              <CommandShortcut>⌘U</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );

    expect(screen.getByText('Maçã')).toBeInTheDocument();
    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.getByText('⌘U')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Buscar...'), {
      target: { value: 'banana' },
    });

    expect(screen.getByText('Banana')).toBeInTheDocument();
    expect(screen.queryByText('Maçã')).not.toBeInTheDocument();
  });

  it('mostra o estado vazio quando nada corresponde à busca', () => {
    render(
      <Command>
        <CommandInput placeholder="Buscar..." />
        <CommandList>
          <CommandEmpty>Nenhum resultado</CommandEmpty>
          <CommandGroup heading="Frutas">
            <CommandItem value="maçã">Maçã</CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar...'), {
      target: { value: 'zzz-nao-existe' },
    });

    expect(screen.getByText('Nenhum resultado')).toBeInTheDocument();
  });

  it('dispara onSelect ao selecionar um item', () => {
    const onSelect = vi.fn();

    render(
      <Command>
        <CommandList>
          <CommandGroup heading="Ações">
            <CommandItem value="salvar" onSelect={onSelect}>
              Salvar
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>,
    );

    fireEvent.click(screen.getByText('Salvar'));

    expect(onSelect).toHaveBeenCalledWith('salvar');
  });

  it('renderiza um ícone customizado no input quando fornecido', () => {
    render(
      <Command>
        <CommandInput
          placeholder="Buscar..."
          icon={<span data-testid="custom-icon">*</span>}
        />
      </Command>,
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renderiza o CommandDialog com título/descrição padrão e botão de fechar', () => {
    render(
      <CommandDialog open onOpenChange={() => {}}>
        <CommandList>
          <CommandItem value="item">Item</CommandItem>
        </CommandList>
      </CommandDialog>,
    );

    expect(screen.getByText('Command Palette')).toBeInTheDocument();
    expect(
      screen.getByText('Search for a command to run...'),
    ).toBeInTheDocument();
    expect(screen.getByText('Item')).toBeInTheDocument();
    expect(screen.getByText('Close')).toBeInTheDocument();
  });

  it('renderiza o CommandDialog com título/descrição customizados e sem botão de fechar', () => {
    render(
      <CommandDialog
        open
        onOpenChange={() => {}}
        title="Meu título"
        description="Minha descrição"
        showCloseButton={false}
        className="custom-class"
      >
        <CommandList>
          <CommandItem value="item">Item</CommandItem>
        </CommandList>
      </CommandDialog>,
    );

    expect(screen.getByText('Meu título')).toBeInTheDocument();
    expect(screen.getByText('Minha descrição')).toBeInTheDocument();
    expect(screen.queryByText('Close')).not.toBeInTheDocument();
  });
});
