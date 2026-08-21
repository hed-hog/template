import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { useForm } from 'react-hook-form';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PopoverContext = createContext<{
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}>({});

vi.mock('@/components/ui/popover', () => ({
  Popover: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => (
    <PopoverContext.Provider value={{ open, onOpenChange }}>
      {children}
    </PopoverContext.Provider>
  ),
  PopoverTrigger: ({ children }: { children: ReactNode }) => {
    const { open, onOpenChange } = useContext(PopoverContext);
    return (
      <span
        data-testid="popover-trigger"
        onClick={() => onOpenChange?.(!open)}
      >
        {children}
      </span>
    );
  },
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid="popover-content">{children}</div>
  ),
}));

vi.mock('@/components/ui/sheet', () => ({
  Sheet: ({
    children,
    open,
    onOpenChange,
  }: {
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) =>
    open ? (
      <div data-testid="sheet">
        <button
          type="button"
          data-testid="sheet-close"
          onClick={() => onOpenChange?.(false)}
        >
          close-sheet
        </button>
        {children}
      </div>
    ) : null,
  SheetDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
  SheetHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  SheetTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

vi.mock('@/components/ui/resizable-sheet-content', () => ({
  ResizableSheetContent: ({
    children,
    onCloseAutoFocus,
  }: {
    children: ReactNode;
    onCloseAutoFocus?: (event: Event) => void;
  }) => (
    <div>
      <button
        type="button"
        data-testid="resizable-sheet-close-auto-focus"
        onClick={() =>
          onCloseAutoFocus?.(
            new Event('closeAutoFocus', { cancelable: true }),
          )
        }
      >
        trigger-close-auto-focus
      </button>
      {children}
    </div>
  ),
}));

import {
  EntityPicker,
  type EntityPickerLoadResult,
  type EntityPickerOption,
  type EntityPickerValue,
} from './entity-picker';

const options: EntityPickerOption[] = [
  { id: 1, name: 'Alice', code: 'ALC', description: 'Primary contact' },
  { id: 2, name: 'Bob', code: 'BOB', description: 'Disabled contact' },
  { id: 3, name: 'Carla', code: 'CAR', description: 'Support contact' },
];

describe('EntityPicker', () => {
  beforeEach(() => {
    vi.useRealTimers();
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

  it('seleciona uma opção local e propaga valor/opção', () => {
    const onChange = vi.fn();

    render(
      <EntityPicker
        value={null}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        options={options}
      />,
    );

    fireEvent.click(screen.getByText('Alice'));

    expect(onChange).toHaveBeenCalledWith('1', options[0]);
  });

  it('filtra opções pelo texto de busca local', async () => {
    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        debounceMs={0}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Selecione uma pessoa'), {
      target: { value: 'support' },
    });

    await waitFor(() => {
      expect(screen.getByText('Carla')).toBeInTheDocument();
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });
  });

  it('limpa uma seleção existente', () => {
    const onChange = vi.fn();

    render(
      <EntityPicker
        value={1}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        options={options}
        cancelLabel="Limpar"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));

    expect(onChange).toHaveBeenCalledWith('', null);
  });

  it('não seleciona opção desabilitada', () => {
    const onChange = vi.fn();

    render(
      <EntityPicker
        value={null}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        options={options}
        isOptionDisabled={(option) => option.id === 2}
      />,
    );

    fireEvent.click(screen.getByText('Bob'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('cria item pelo fluxo inline mínimo e seleciona o item criado', async () => {
    const onChange = vi.fn();
    const onCreate = vi.fn(async (values: Record<string, string>) => ({
      id: 4,
      name: values.name,
    }));

    render(
      <EntityPicker
        value={null}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        entityLabel="pessoa"
        options={options}
        onCreate={onCreate}
        createFields={[{ name: 'name', label: 'Nome', required: true }]}
        createActionLabel="Criar pessoa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    expect(screen.getByText('Criar pessoa')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Nome'), {
      target: { value: 'Dora' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ name: 'Dora' });
      expect(onChange).toHaveBeenCalledWith('4', { id: 4, name: 'Dora' });
    });
  });

  it('usa resolvedores customizados de valor, rótulo, descrição e busca', async () => {
    type CustomOption = { key: string; display: string; hint: string };
    const customOptions: CustomOption[] = [
      { key: 'x1', display: 'Item Customizado', hint: 'dica extra' },
    ];

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione"
        options={customOptions}
        getOptionValue={(option) => option.key}
        getOptionLabel={(option) => option.display}
        getOptionDescription={(option) => option.hint}
        getOptionSearchText={(option) =>
          `${option.display} ${option.hint}`.toLowerCase()
        }
        debounceMs={0}
      />,
    );

    expect(screen.getByText('Item Customizado')).toBeInTheDocument();
    expect(screen.getByText('dica extra')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('Selecione'), {
      target: { value: 'dica' },
    });

    await waitFor(() => {
      expect(screen.getByText('Item Customizado')).toBeInTheDocument();
    });
  });

  it('resolve rótulo por label/título/descrição/id e usa chave baseada no rótulo quando não há id', () => {
    const fallbackOptions = [
      { id: 20, title: 'Somente Título' },
      { id: 21, description: 'Somente Descrição' },
      { id: 22 },
      { name: 'Sem Id Explícito' },
      { id: 23, label: 'Rótulo Direto' },
      {},
    ];

    const onChange = vi.fn();

    const { container } = render(
      <EntityPicker
        value={null}
        onChange={onChange}
        placeholder="Selecione"
        options={fallbackOptions}
      />,
    );

    expect(screen.getByText('Somente Título')).toBeInTheDocument();
    expect(screen.getAllByText('Somente Descrição').length).toBeGreaterThan(0);
    expect(screen.getByText('22')).toBeInTheDocument();
    expect(screen.getByText('Rótulo Direto')).toBeInTheDocument();

    // The last option has no label/name/title/description/id at all, so its
    // resolved label falls back to an empty string; it still renders as an
    // item (covering the `fallback ?? ''` branch) even though it has no
    // visible text.
    expect(
      container.querySelectorAll('[data-slot="command-item"]').length,
    ).toBe(fallbackOptions.length);

    fireEvent.click(screen.getByText('Sem Id Explícito'));

    expect(onChange).toHaveBeenCalledWith('', { name: 'Sem Id Explícito' });
  });

  it('resolve createActionLabel a partir do entityLabel quando createActionLabel não é informado', () => {
    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        onCreate={vi.fn()}
        entityLabel="pessoa"
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Criar pessoa' }),
    ).toBeInTheDocument();
  });

  it('usa "entity" como sufixo do id do sheet quando o texto normalizado fica vazio', () => {
    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="!!!"
        onCreate={vi.fn()}
      />,
    );

    expect(
      screen.getAllByRole('button', { name: 'Criar novo' }).length,
    ).toBeGreaterThan(0);
  });

  it('converte valores usando valueType number ao selecionar e ao limpar', () => {
    const onChange = vi.fn();

    render(
      <EntityPicker
        value={1}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        options={options}
        valueType="number"
        cancelLabel="Limpar"
      />,
    );

    fireEvent.click(screen.getByText('Bob'));
    expect(onChange).toHaveBeenCalledWith(2, options[1]);

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(onChange).toHaveBeenLastCalledWith(null, null);
  });

  it('usa valueType number ao selecionar a opção vazia com allowEmptySelection', () => {
    const onChange = vi.fn();

    render(
      <EntityPicker
        value={2}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        options={options}
        valueType="number"
        allowEmptySelection
        emptySelectionLabel="Nenhuma"
      />,
    );

    fireEvent.click(screen.getByText('Nenhuma'));

    expect(onChange).toHaveBeenCalledWith(null, null);
  });

  it('usa resolvedEmptyLabel como rótulo da opção vazia quando emptySelectionLabel não é informado', () => {
    render(
      <EntityPicker
        value={1}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        allowEmptySelection
      />,
    );

    expect(
      screen.getByRole('option', { name: 'Selecione uma pessoa' }),
    ).toBeInTheDocument();
  });

  it('usa noResultsLabel quando emptyStateDescription é vazio', async () => {
    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        emptyStateDescription=""
        noResultsLabel="Nada encontrado por aqui"
        debounceMs={0}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Selecione uma pessoa'), {
      target: { value: 'zzz-inexistente' },
    });

    await waitFor(() => {
      expect(screen.getByText('Nada encontrado por aqui')).toBeInTheDocument();
    });
  });

  it('usa null como valor quando o item criado não possui id', async () => {
    const onChange = vi.fn();
    const onCreate = vi.fn(async () => ({ name: 'Sem Id Criado' }));

    render(
      <EntityPicker
        value={null}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        options={options}
        onCreate={onCreate}
        createFields={[{ name: 'name', label: 'Nome' }]}
        createActionLabel="Criar pessoa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith('', { name: 'Sem Id Criado' });
    });
  });

  it('usa null como valor ao selecionar item sem id via renderCreateContent', () => {
    const onChange = vi.fn();
    const renderCreateContent = vi.fn((ctx) => (
      <button
        type="button"
        onClick={() => ctx.selectCreated({ name: 'Sem Id' } as never)}
      >
        selecionar-sem-id
      </button>
    ));

    render(
      <EntityPicker
        value={null}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        options={options}
        renderCreateContent={renderCreateContent}
        createActionLabel="Criar pessoa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    fireEvent.click(screen.getByText('selecionar-sem-id'));

    expect(onChange).toHaveBeenCalledWith('', { name: 'Sem Id' });
  });

  it('exibe "ID #" quando o valor selecionado não corresponde a nenhuma opção conhecida', () => {
    render(
      <EntityPicker
        value={999}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
      />,
    );

    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('ID #999');
  });

  it('sincroniza opções remotas quando loadOptions retorna um array simples', async () => {
    const loadOptions = vi.fn(async () => [{ id: 10, name: 'Remoto A' }]);

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        loadOptions={loadOptions}
        debounceMs={0}
      />,
    );

    await waitFor(() => {
      expect(loadOptions).toHaveBeenCalledWith({
        page: 1,
        pageSize: 20,
        search: '',
      });
      expect(screen.getByText('Remoto A')).toBeInTheDocument();
    });
  });

  it('usa valores padrão quando loadOptions retorna um objeto sem items/hasMore', async () => {
    const loadOptions = vi.fn(async () => ({}) as { items: never[] });

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        loadOptions={loadOptions}
        debounceMs={0}
        loadMoreLabel="Carregar mais"
      />,
    );

    await waitFor(() => expect(loadOptions).toHaveBeenCalled());

    expect(
      screen.queryByRole('button', { name: 'Carregar mais' }),
    ).not.toBeInTheDocument();
  });

  it('pagina resultados remotos e mescla itens quando hasMore é verdadeiro', async () => {
    const loadOptions = vi.fn(async ({ page }: { page: number }) => {
      if (page === 1) {
        return { items: [{ id: 1, name: 'Página 1' }], hasMore: true };
      }

      return { items: [{ id: 2, name: 'Página 2' }], hasMore: false };
    });

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        loadOptions={loadOptions}
        debounceMs={0}
        loadMoreLabel="Carregar mais"
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Página 1')).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    await waitFor(() => {
      expect(loadOptions).toHaveBeenCalledWith({
        page: 2,
        pageSize: 20,
        search: '',
      });
      expect(screen.getByText('Página 2')).toBeInTheDocument();
      expect(screen.getByText('Página 1')).toBeInTheDocument();
    });
  });

  it('recarrega opções remotas quando refreshToken muda', async () => {
    const loadOptions = vi.fn(async () => ({
      items: [{ id: 1, name: 'Item' }],
      hasMore: false,
    }));

    const { rerender } = render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        loadOptions={loadOptions}
        debounceMs={0}
        refreshToken={1}
      />,
    );

    await waitFor(() =>
      expect(loadOptions.mock.calls.length).toBeGreaterThanOrEqual(1),
    );

    const callsBeforeRerender = loadOptions.mock.calls.length;

    rerender(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        loadOptions={loadOptions}
        debounceMs={0}
        refreshToken={2}
      />,
    );

    await waitFor(() =>
      expect(loadOptions.mock.calls.length).toBeGreaterThan(
        callsBeforeRerender,
      ),
    );
  });

  it('recarrega opções ao abrir o popover quando ainda não há opções carregadas', async () => {
    const loadOptions = vi.fn(async () => ({ items: [], hasMore: false }));

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        loadOptions={loadOptions}
        debounceMs={0}
      />,
    );

    await waitFor(() => expect(loadOptions).toHaveBeenCalled());
    const callsAfterMount = loadOptions.mock.calls.length;

    fireEvent.click(screen.getByTestId('popover-trigger'));

    await waitFor(() =>
      expect(loadOptions.mock.calls.length).toBeGreaterThan(callsAfterMount),
    );
  });

  it('trata erro ao carregar opções remotas e limpa a lista', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const loadOptions = vi.fn(async () => {
      throw new Error('falhou');
    });

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        loadOptions={loadOptions}
        debounceMs={0}
      />,
    );

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load entity picker options.',
        expect.any(Error),
      );
    });

    consoleErrorSpy.mockRestore();
  });

  it('descarta resposta de requisição obsoleta ao buscar novamente antes da anterior resolver', async () => {
    let resolveFirst: (value: unknown) => void = () => {};
    const firstPromise = new Promise((resolve) => {
      resolveFirst = resolve;
    });

    const loadOptions = vi
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(async () => ({
        items: [{ id: 2, name: 'Segunda busca' }],
        hasMore: false,
      }));

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        loadOptions={loadOptions}
        debounceMs={0}
      />,
    );

    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText('Selecione uma pessoa'), {
      target: { value: 'segunda' },
    });

    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByText('Segunda busca')).toBeInTheDocument(),
    );

    resolveFirst({
      items: [{ id: 1, name: 'Primeira busca obsoleta' }],
      hasMore: false,
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(
      screen.queryByText('Primeira busca obsoleta'),
    ).not.toBeInTheDocument();
  });

  it('preenche o primeiro campo de criação com o texto pesquisado a partir do estado vazio', async () => {
    const onCreate = vi.fn(async () => null);

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        onCreate={onCreate}
        createFields={[{ name: 'name', label: 'Nome', required: true }]}
        createActionLabel="Criar pessoa"
        debounceMs={0}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Selecione uma pessoa'), {
      target: { value: 'Novo Contato' },
    });

    await waitFor(() => {
      expect(screen.queryByText('Alice')).not.toBeInTheDocument();
    });

    const createButtons = screen.getAllByRole('button', {
      name: 'Criar pessoa',
    });
    expect(createButtons.length).toBeGreaterThanOrEqual(2);

    fireEvent.click(createButtons[0]!);

    expect(screen.getByPlaceholderText('Nome')).toHaveValue('Novo Contato');
  });

  it('aplica mapSearchToCreateValues e createSheetId ao abrir a criação pelo botão do cabeçalho', () => {
    const mapSearchToCreateValues = vi.fn((search: string) => ({
      name: search.toUpperCase(),
    }));

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        onCreate={vi.fn()}
        createFields={[{ name: 'name', label: 'Nome' }]}
        mapSearchToCreateValues={mapSearchToCreateValues}
        createActionLabel="Criar novo item aqui"
        createSheetId="sheet-custom-id"
      />,
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Criar novo item aqui' }),
    );

    expect(mapSearchToCreateValues).toHaveBeenCalledWith('');
    expect(screen.getByPlaceholderText('Nome')).toHaveValue('');
  });

  it('usa "entity" como id do sheet de criação quando nenhuma referência está disponível', () => {
    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder=""
        onCreate={vi.fn()}
      />,
    );

    expect(
      screen.getAllByRole('button', { name: 'Criar novo' }).length,
    ).toBeGreaterThan(0);
  });

  it('captura e restaura a posição de rolagem do container pai ao abrir e fechar a criação', () => {
    const onCreate = vi.fn();

    render(
      <div data-radix-dialog-content="" style={{ overflow: 'auto' }}>
        <EntityPicker
          value={null}
          onChange={() => {}}
          placeholder="Selecione uma pessoa"
          options={options}
          onCreate={onCreate}
          createFields={[{ name: 'name', label: 'Nome' }]}
          createActionLabel="Criar pessoa"
        />
      </div>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    expect(screen.getByTestId('sheet')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sheet-close'));

    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
  });

  it('não executa handleCreate quando onCreate está ausente, e usa renderCreateContent para selecionar/fechar manualmente', () => {
    const onChange = vi.fn();
    const renderCreateContent = vi.fn((ctx) => (
      <div>
        <button type="button" onClick={() => void ctx.submitCreate()}>
          enviar-customizado
        </button>
        <button
          type="button"
          onClick={() =>
            ctx.selectCreated({ id: 99, name: 'Selecionado' } as never)
          }
        >
          selecionar-customizado
        </button>
      </div>
    ));

    render(
      <EntityPicker
        value={null}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        options={options}
        renderCreateContent={renderCreateContent}
        createActionLabel="Criar pessoa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    expect(renderCreateContent).toHaveBeenCalled();

    fireEvent.click(screen.getByText('enviar-customizado'));
    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText('selecionar-customizado'));

    expect(onChange).toHaveBeenCalledWith('99', {
      id: 99,
      name: 'Selecionado',
    });
    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
  });

  it('bloqueia a criação quando um campo obrigatório está vazio', () => {
    const onCreate = vi.fn();

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        onCreate={onCreate}
        createFields={[{ name: 'name', label: 'Nome', required: true }]}
        createActionLabel="Criar pessoa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onCreate).not.toHaveBeenCalled();
  });

  it('mantém a criação aberta quando onCreate resolve sem retornar item', async () => {
    const onChange = vi.fn();
    const onCreate = vi.fn(async () => null);

    render(
      <EntityPicker
        value={null}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        options={options}
        onCreate={onCreate}
        createFields={[{ name: 'name', label: 'Nome', required: true }]}
        createActionLabel="Criar pessoa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    fireEvent.change(screen.getByPlaceholderText('Nome'), {
      target: { value: 'Qualquer' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(onCreate).toHaveBeenCalled());

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('sheet')).toBeInTheDocument();
  });

  it('envia a criação ao pressionar Enter no campo', async () => {
    const onCreate = vi.fn(async (values: Record<string, string>) => ({
      id: 5,
      name: values.name,
    }));

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        onCreate={onCreate}
        createFields={[{ name: 'name', label: 'Nome' }]}
        createActionLabel="Criar pessoa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    fireEvent.change(screen.getByPlaceholderText('Nome'), {
      target: { value: 'Enter Pessoa' },
    });
    fireEvent.keyDown(screen.getByPlaceholderText('Nome'), { key: 'Enter' });

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith({ name: 'Enter Pessoa' });
    });
  });

  it('remove os botões salvar/cancelar quando onCreate deixa de existir com a criação já aberta', () => {
    const onCreate = vi.fn();

    const { rerender } = render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        onCreate={onCreate}
        createFields={[{ name: 'name', label: 'Nome' }]}
        createActionLabel="Criar pessoa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();

    rerender(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        createFields={[{ name: 'name', label: 'Nome' }]}
        createActionLabel="Criar pessoa"
      />,
    );

    expect(
      screen.queryByRole('button', { name: 'Salvar' }),
    ).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Nome')).toBeInTheDocument();
  });

  it('usa renderSelectedValue para customizar o valor exibido no botão', () => {
    render(
      <EntityPicker
        value={1}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        renderSelectedValue={({ label, value }) => `${label} (#${value})`}
      />,
    );

    expect(screen.getAllByRole('combobox')[0]).toHaveTextContent(
      'Alice (#1)',
    );
  });

  it('exibe o label com estado de erro e a mensagem de erro', () => {
    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        label="Responsável"
        errorMessage="Campo obrigatório"
      />,
    );

    expect(screen.getByText('Responsável')).toHaveAttribute(
      'data-error',
      'true',
    );
    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
  });

  it('desabilita interações quando disabled é verdadeiro', () => {
    const onChange = vi.fn();

    render(
      <EntityPicker
        value={1}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        options={options}
        cancelLabel="Limpar"
        disabled
      />,
    );

    expect(screen.getAllByRole('combobox')[0]).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Limpar' })).toBeDisabled();

    fireEvent.click(screen.getByTestId('popover-trigger'));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('oculta o campo de busca quando searchable é falso', () => {
    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        searchable={false}
      />,
    );

    expect(
      screen.queryByPlaceholderText('Selecione uma pessoa'),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Alice')).toBeInTheDocument();
  });

  it('exibe loadingLabel enquanto as opções remotas estão carregando', async () => {
    let resolveLoad: (
      value: EntityPickerLoadResult<EntityPickerOption>,
    ) => void = () => {};
    const loadOptions = vi.fn(
      () =>
        new Promise<EntityPickerLoadResult<EntityPickerOption>>((resolve) => {
          resolveLoad = resolve;
        }),
    );

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        loadOptions={loadOptions}
        debounceMs={0}
        loadingLabel="Aguarde..."
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Aguarde...')).toBeInTheDocument(),
    );

    resolveLoad({ items: [], hasMore: false });

    await waitFor(() =>
      expect(screen.queryByText('Aguarde...')).not.toBeInTheDocument(),
    );
  });

  it('permite selecionar valor vazio quando allowEmptySelection é verdadeiro', () => {
    const onChange = vi.fn();

    render(
      <EntityPicker
        value={1}
        onChange={onChange}
        placeholder="Selecione uma pessoa"
        options={options}
        allowEmptySelection
        emptySelectionLabel="Nenhum"
      />,
    );

    fireEvent.click(screen.getByText('Nenhum'));

    expect(onChange).toHaveBeenCalledWith('', null);
  });

  it('usa renderOption para customizar a renderização do item', () => {
    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        renderOption={({ option, isSelected }) => (
          <span>{`custom-${(option as EntityPickerOption).name}-${isSelected}`}</span>
        )}
      />,
    );

    expect(screen.getByText('custom-Alice-false')).toBeInTheDocument();
  });

  it('carrega mais opções locais ao clicar em carregar mais', () => {
    const manyOptions = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      name: `Pessoa ${index + 1}`,
    }));

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={manyOptions}
        visibleCountStep={20}
        loadMoreLabel="Carregar mais"
      />,
    );

    expect(screen.queryByText('Pessoa 21')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));

    expect(screen.getByText('Pessoa 21')).toBeInTheDocument();
  });

  it('integra com react-hook-form via Controller, incluindo estado de erro do form', () => {
    function FormHarness({
      onChange,
    }: {
      onChange?: (
        value: EntityPickerValue,
        option: EntityPickerOption | null,
      ) => void;
    }) {
      const form = useForm<{ person: string }>({
        defaultValues: { person: '' },
      });

      useEffect(() => {
        form.setError('person', {
          type: 'manual',
          message: 'Selecione uma opção',
        });
      }, [form]);

      return (
        <EntityPicker
          form={form}
          name="person"
          onChange={onChange}
          placeholder="Selecione uma pessoa"
          options={options}
        />
      );
    }

    const onChange = vi.fn();

    render(<FormHarness onChange={onChange} />);

    expect(screen.getByText('Selecione uma opção')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Alice'));

    expect(onChange).toHaveBeenCalledWith('1', options[0]);
  });

  it('fecha o sheet de criação usando closeCreate do renderCreateContent', () => {
    const renderCreateContent = vi.fn((ctx) => (
      <button type="button" onClick={ctx.closeCreate}>
        fechar-via-contexto
      </button>
    ));

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        renderCreateContent={renderCreateContent}
        createActionLabel="Criar pessoa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    expect(screen.getByTestId('sheet')).toBeInTheDocument();

    fireEvent.click(screen.getByText('fechar-via-contexto'));

    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
  });

  it('interrompe a propagação do evento de rolagem na lista de comandos', () => {
    const { container } = render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
      />,
    );

    const commandList = container.querySelector('[data-slot="command-list"]');
    expect(commandList).not.toBeNull();

    expect(() => fireEvent.wheel(commandList as Element)).not.toThrow();
  });

  it('cancela a criação pelo botão Cancelar do formulário padrão', () => {
    const onCreate = vi.fn();

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        onCreate={onCreate}
        createFields={[{ name: 'name', label: 'Nome' }]}
        createActionLabel="Criar pessoa"
        cancelLabel="Cancelar Criação"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    expect(screen.getByTestId('sheet')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Cancelar Criação' }),
    );

    expect(screen.queryByPlaceholderText('Nome')).not.toBeInTheDocument();
  });

  it('aciona onCloseAutoFocus do sheet de criação, prevenindo o comportamento padrão', () => {
    const onCreate = vi.fn();

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        onCreate={onCreate}
        createFields={[{ name: 'name', label: 'Nome' }]}
        createActionLabel="Criar pessoa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));

    expect(() =>
      fireEvent.click(
        screen.getByTestId('resizable-sheet-close-auto-focus'),
      ),
    ).not.toThrow();
  });

  it('não recarrega opções ao abrir o popover quando já existem opções remotas carregadas', async () => {
    const loadOptions = vi.fn(async () => ({
      items: [{ id: 1, name: 'Já Carregado' }],
      hasMore: false,
    }));

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        loadOptions={loadOptions}
        debounceMs={0}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText('Já Carregado')).toBeInTheDocument(),
    );
    const callsAfterMount = loadOptions.mock.calls.length;

    fireEvent.click(screen.getByTestId('popover-trigger'));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(loadOptions.mock.calls.length).toBe(callsAfterMount);
  });

  it('descarta um erro de requisição obsoleta quando uma busca mais recente já está em andamento', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    let rejectFirst: (error: unknown) => void = () => {};
    const firstPromise = new Promise((_, reject) => {
      rejectFirst = reject;
    });

    const loadOptions = vi
      .fn()
      .mockImplementationOnce(() => firstPromise)
      .mockImplementationOnce(async () => ({
        items: [{ id: 2, name: 'Busca Recente' }],
        hasMore: false,
      }));

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        loadOptions={loadOptions}
        debounceMs={0}
      />,
    );

    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText('Selecione uma pessoa'), {
      target: { value: 'recente' },
    });

    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByText('Busca Recente')).toBeInTheDocument(),
    );

    rejectFirst(new Error('obsoleta'));

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(screen.getByText('Busca Recente')).toBeInTheDocument();

    consoleErrorSpy.mockRestore();
  });

  it('restaura a posição de rolagem usando o diálogo aberto como alternativa quando não há container capturado', () => {
    const onCreate = vi.fn();

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={options}
        onCreate={onCreate}
        createFields={[{ name: 'name', label: 'Nome' }]}
        createActionLabel="Criar pessoa"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Criar pessoa' }));
    expect(screen.getByTestId('sheet')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('sheet-close'));

    expect(screen.queryByTestId('sheet')).not.toBeInTheDocument();
  });

  it('fecha o popover ao alternar onOpenChange, reiniciando o visibleCount', () => {
    const manyOptions = Array.from({ length: 25 }, (_, index) => ({
      id: index + 1,
      name: `Pessoa ${index + 1}`,
    }));

    render(
      <EntityPicker
        value={null}
        onChange={() => {}}
        placeholder="Selecione uma pessoa"
        options={manyOptions}
        visibleCountStep={20}
        loadMoreLabel="Carregar mais"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Carregar mais' }));
    expect(screen.getByText('Pessoa 21')).toBeInTheDocument();

    // Abre e fecha o popover pelo onOpenChange real do componente.
    fireEvent.click(screen.getByTestId('popover-trigger'));
    fireEvent.click(screen.getByTestId('popover-trigger'));

    expect(screen.queryByText('Pessoa 21')).not.toBeInTheDocument();
  });
});
