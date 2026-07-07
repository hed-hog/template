import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';

// next-intl needs i18n context; we return the key itself.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { SearchBar, type SearchBarControl } from './search-bar';

afterEach(() => {
  vi.useRealTimers();
});

describe('SearchBar — campo de busca', () => {
  it('usa o placeholder informado e propaga onSearchChange', () => {
    const onSearchChange = vi.fn();
    render(
      <SearchBar
        searchQuery=""
        onSearchChange={onSearchChange}
        placeholder="Buscar contatos"
      />
    );
    const input = screen.getByPlaceholderText('Buscar contatos');
    fireEvent.change(input, { target: { value: 'ana' } });
    expect(onSearchChange).toHaveBeenCalledWith('ana');
  });

  it('submeter o formulário dispara onSearch', () => {
    const onSearch = vi.fn();
    const { container } = render(
      <SearchBar searchQuery="x" onSearchChange={() => {}} onSearch={onSearch} />
    );
    fireEvent.submit(container.querySelector('form')!);
    expect(onSearch).toHaveBeenCalledTimes(1);
  });
});

describe('SearchBar — debounce por ref', () => {
  it('chama onSearch após o debounce', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(
      <SearchBar
        searchQuery="a"
        onSearchChange={() => {}}
        onSearch={onSearch}
        debounceMs={300}
      />
    );
    expect(onSearch).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onSearch).toHaveBeenCalledTimes(1);
  });

  it('sem debounceMs não agenda chamada automática', () => {
    vi.useFakeTimers();
    const onSearch = vi.fn();
    render(
      <SearchBar searchQuery="a" onSearchChange={() => {}} onSearch={onSearch} />
    );
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(onSearch).not.toHaveBeenCalled();
  });
});

describe('SearchBar — controles (select vs date)', () => {
  it('controle de data com label renderiza o rótulo e propaga a mudança', () => {
    const onChange = vi.fn();
    const controls: SearchBarControl[] = [
      {
        id: 'from',
        type: 'date',
        value: '2024-01-01',
        onChange,
        label: 'De',
      },
    ];
    const { container } = render(
      <SearchBar
        searchQuery=""
        onSearchChange={() => {}}
        controls={controls}
      />
    );
    expect(screen.getByText('De')).toBeInTheDocument();
    const dateInput = container.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '2024-02-02' } });
    expect(onChange).toHaveBeenCalledWith('2024-02-02');
  });

  it('filtro legacy vira um select prefixado em normalizedControls', () => {
    render(
      <SearchBar
        searchQuery=""
        onSearchChange={() => {}}
        filters={{
          value: '',
          options: [
            { label: 'Ativos', value: 'active' },
            { label: 'Inativos', value: 'inactive' },
          ],
          onChange: () => {},
          placeholder: 'Filtrar por status',
        }}
      />
    );
    // The trigger (Radix Select) displays the placeholder when there's no value.
    expect(screen.getByText('Filtrar por status')).toBeInTheDocument();
  });

  it('controle de data sem label renderiza como Input simples e propaga a mudança', () => {
    const onChange = vi.fn();
    const controls: SearchBarControl[] = [
      {
        id: 'to',
        type: 'date',
        value: '2024-01-01',
        onChange,
        min: '2024-01-01',
        max: '2024-12-31',
      },
    ];
    const { container } = render(
      <SearchBar searchQuery="" onSearchChange={() => {}} controls={controls} />
    );
    const dateInput = container.querySelector(
      'input[type="date"]'
    ) as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
    fireEvent.change(dateInput, { target: { value: '2024-03-03' } });
    expect(onChange).toHaveBeenCalledWith('2024-03-03');
  });

  it('controle do tipo select renderiza o placeholder do próprio controle', () => {
    const controls: SearchBarControl[] = [
      {
        id: 'status',
        type: 'select',
        value: '',
        onChange: () => {},
        options: [{ label: 'Ativo', value: 'active' }],
        placeholder: 'Status do controle',
      },
    ];
    render(
      <SearchBar searchQuery="" onSearchChange={() => {}} controls={controls} />
    );
    expect(screen.getByText('Status do controle')).toBeInTheDocument();
  });

  it('controle do tipo select sem placeholder próprio usa o placeholder de filtro padrão', () => {
    const controls: SearchBarControl[] = [
      {
        id: 'status',
        type: 'select',
        value: '',
        onChange: () => {},
        options: [{ label: 'Ativo', value: 'active' }],
      },
    ];
    render(
      <SearchBar searchQuery="" onSearchChange={() => {}} controls={controls} />
    );
    expect(screen.getByText('filterPlaceholder')).toBeInTheDocument();
  });
});

describe('SearchBar — botão de busca, afterSearchButton e actions', () => {
  it('esconde o botão de busca quando showSearchButton é false', () => {
    render(
      <SearchBar
        searchQuery=""
        onSearchChange={() => {}}
        showSearchButton={false}
      />
    );
    expect(
      screen.queryByRole('button', { name: 'btnBuscar' })
    ).not.toBeInTheDocument();
  });

  it('renderiza afterSearchButton quando informado', () => {
    render(
      <SearchBar
        searchQuery=""
        onSearchChange={() => {}}
        afterSearchButton={<button>Extra</button>}
      />
    );
    expect(screen.getByText('Extra')).toBeInTheDocument();
  });

  it('não renderiza o wrapper de afterSearchButton quando não informado', () => {
    const { container } = render(
      <SearchBar searchQuery="" onSearchChange={() => {}} />
    );
    expect(screen.getByRole('button', { name: 'btnBuscar' })).toBeInTheDocument();
    // no extra shrink-0 wrapper besides the search button's own container
    expect(container.querySelectorAll('.shrink-0').length).toBe(1);
  });

  it('renderiza actions quando informado', () => {
    render(
      <SearchBar
        searchQuery=""
        onSearchChange={() => {}}
        actions={<button>Ação extra</button>}
      />
    );
    expect(screen.getByText('Ação extra')).toBeInTheDocument();
  });

  it('não renderiza o wrapper de actions quando não informado', () => {
    const { container } = render(
      <SearchBar searchQuery="" onSearchChange={() => {}} />
    );
    expect(container.querySelector('.sm\\:ml-auto')).not.toBeInTheDocument();
  });
});

describe('SearchBar — onSearch padrão', () => {
  it('usa uma função no-op quando onSearch não é informado', () => {
    const { container } = render(
      <SearchBar searchQuery="" onSearchChange={() => {}} />
    );
    expect(() =>
      fireEvent.submit(container.querySelector('form')!)
    ).not.toThrow();
  });
});
