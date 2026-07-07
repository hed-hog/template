import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockLocale = 'pt-BR';
vi.mock('next-intl', () => ({
  useLocale: () => mockLocale,
}));

type CalendarSelectHandler = (range: unknown) => void;

vi.mock('@/components/ui/calendar', () => ({
  Calendar: (props: { onSelect?: CalendarSelectHandler }) => (
    <div data-testid="calendar-stub">
      <button
        type="button"
        onClick={() =>
          props.onSelect?.({
            from: new Date(2024, 0, 10),
            to: new Date(2024, 0, 15),
          })
        }
      >
        set-full-range
      </button>
      <button
        type="button"
        onClick={() =>
          props.onSelect?.({
            from: new Date(2024, 2, 5),
            to: undefined,
          })
        }
      >
        set-from-only
      </button>
    </div>
  ),
}));

import {
  DateRangePicker,
  formatDateRangeLabel,
} from './date-range-picker';

function openPicker(placeholderText = 'Selecionar período') {
  fireEvent.click(screen.getByText(placeholderText, { selector: 'span' }));
}

function setup(props: Partial<React.ComponentProps<typeof DateRangePicker>> = {}) {
  const onFromDateChange = vi.fn();
  const onToDateChange = vi.fn();
  render(
    <DateRangePicker
      fromDate=""
      toDate=""
      onFromDateChange={onFromDateChange}
      onToDateChange={onToDateChange}
      {...props}
    />,
  );
  return { onFromDateChange, onToDateChange };
}

describe('formatDateRangeLabel', () => {
  it('retorna null quando não há datas', () => {
    expect(formatDateRangeLabel('', '')).toBeNull();
  });

  it('formata intervalo completo', () => {
    expect(formatDateRangeLabel('2024-01-10', '2024-01-15')).toBe(
      '10/01/2024 – 15/01/2024',
    );
  });

  it('formata apenas data inicial', () => {
    expect(formatDateRangeLabel('2024-01-10', '')).toBe(
      'A partir de 10/01/2024',
    );
  });

  it('formata apenas data final', () => {
    expect(formatDateRangeLabel('', '2024-01-15')).toBe('Até 15/01/2024');
  });
});

describe('DateRangePicker', () => {
  beforeEach(() => {
    mockLocale = 'pt-BR';
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
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('exibe o placeholder quando não há intervalo selecionado e não mostra botão de limpar', () => {
    setup();
    expect(screen.getByText('Selecionar período')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Limpar período' }),
    ).not.toBeInTheDocument();
  });

  it('exibe o rótulo formatado quando há intervalo e mostra o botão de limpar', () => {
    setup({ fromDate: '2024-01-10', toDate: '2024-01-15' });
    expect(screen.getByText('10/01/2024 – 15/01/2024')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Limpar período' }),
    ).toBeInTheDocument();
  });

  it('limpa o intervalo pelo botão externo e persiste no storage', () => {
    const { onFromDateChange, onToDateChange } = setup({
      fromDate: '2024-01-10',
      toDate: '2024-01-15',
      storageKey: 'my-range',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Limpar período' }));

    expect(onFromDateChange).toHaveBeenCalledWith('');
    expect(onToDateChange).toHaveBeenCalledWith('');
    expect(JSON.parse(window.localStorage.getItem('my-range') ?? '{}')).toEqual({
      from: '',
      to: '',
    });
  });

  it('abre o popover e aplica um preset', async () => {
    const { onFromDateChange, onToDateChange } = setup();
    openPicker();

    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    fireEvent.click(await screen.findByText('Hoje'));
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(onFromDateChange).toHaveBeenCalledWith(iso);
    expect(onToDateChange).toHaveBeenCalledWith(iso);
  });

  it('percorre todos os presets sem erros (branch coverage do switch)', async () => {
    setup();
    openPicker();

    const presetLabels = [
      'Hoje',
      'Ontem',
      'Últimos 7 dias',
      'Esta semana',
      'Semana passada',
      'Este mês',
      'Mês passado',
      'Últimos 30 dias',
      'Últimos 90 dias',
      'Este ano',
    ];

    for (const label of presetLabels) {
      fireEvent.click(await screen.findByText(label));
    }

    expect(await screen.findByText('Aplicar')).toBeInTheDocument();
  });

  it('cobre o ramo "thisWeek"/"lastWeek" quando hoje é domingo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 2024-01-07 is a Sunday.
    vi.setSystemTime(new Date(2024, 0, 7, 12, 0, 0));

    setup();
    openPicker();

    fireEvent.click(await screen.findByText('Esta semana'));
    fireEvent.click(await screen.findByText('Semana passada'));

    expect(await screen.findByText('Aplicar')).toBeInTheDocument();
  });

  it('cobre o ramo "thisWeek"/"lastWeek" quando hoje não é domingo', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 2024-01-10 is a Wednesday.
    vi.setSystemTime(new Date(2024, 0, 10, 12, 0, 0));

    setup();
    openPicker();

    fireEvent.click(await screen.findByText('Esta semana'));
    fireEvent.click(await screen.findByText('Semana passada'));

    expect(await screen.findByText('Aplicar')).toBeInTheDocument();
  });

  it('seleciona um intervalo completo pelo calendário (stub) e aplica', async () => {
    const { onFromDateChange, onToDateChange } = setup({ storageKey: 'range-key' });
    openPicker();

    fireEvent.click(await screen.findByText('set-full-range'));
    expect(screen.getByText('10/01/2024 – 15/01/2024')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(onFromDateChange).toHaveBeenCalledWith('2024-01-10');
    expect(onToDateChange).toHaveBeenCalledWith('2024-01-15');
    expect(JSON.parse(window.localStorage.getItem('range-key') ?? '{}')).toEqual({
      from: '2024-01-10',
      to: '2024-01-15',
    });
  });

  it('seleciona apenas uma data inicial (draft com "to" indefinido) e aplica', async () => {
    const { onFromDateChange, onToDateChange } = setup();
    openPicker();

    fireEvent.click(await screen.findByText('set-from-only'));
    expect(screen.getByText('A partir de 05/03/2024')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(onFromDateChange).toHaveBeenCalledWith('2024-03-05');
    expect(onToDateChange).toHaveBeenCalledWith('');
  });

  it('limpa o rascunho dentro do popover e aplica um rascunho vazio', async () => {
    const { onFromDateChange, onToDateChange } = setup();
    openPicker();

    fireEvent.click(await screen.findByText('set-full-range'));
    expect(screen.getByText('10/01/2024 – 15/01/2024')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(screen.getByText('Selecione um período')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(onFromDateChange).toHaveBeenCalledWith('');
    expect(onToDateChange).toHaveBeenCalledWith('');
  });

  it('navega para "Outros anos", seleciona ano e mês, e navega entre décadas', async () => {
    setup();
    openPicker();

    fireEvent.click(await screen.findByText('Outros anos'));

    const currentYear = new Date().getFullYear();
    const initialYearLabel = String(currentYear);
    expect(screen.getByText(initialYearLabel)).toBeInTheDocument();

    // Next decade is disabled initially (decadeEnd === currentYear).
    expect(
      screen.getByRole('button', { name: 'Próxima década' }),
    ).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Década anterior' }));
    expect(
      screen.getByRole('button', { name: 'Próxima década' }),
    ).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Próxima década' }));

    fireEvent.click(screen.getByText(initialYearLabel));

    // Month names appear once a year is selected; "Janeiro" (pt-BR) is
    // unambiguous among the preset/year buttons, so click it directly.
    const monthButton = await screen.findByText('Janeiro');
    fireEvent.click(monthButton);

    // Clicking the now-selected month again exercises the "selected" branch
    // of isSelectedMonth (variant becomes "default" instead of "ghost").
    fireEvent.click(screen.getByText('Janeiro'));
    expect(
      screen.getByText('Janeiro').closest('button'),
    ).toHaveAttribute('data-slot', 'button');

    // Toggle "Outros anos" off.
    fireEvent.click(screen.getByText('Outros anos'));
  });

  it('usa locale en-US para os nomes dos meses', async () => {
    mockLocale = 'en-US';
    setup();
    openPicker();

    fireEvent.click(await screen.findByText('Outros anos'));
    const currentYear = new Date().getFullYear();
    fireEvent.click(screen.getByText(String(currentYear)));

    expect(screen.getByText('January')).toBeInTheDocument();
  });

  it('inicializa a partir do storage quando fromDate/toDate estão vazios', () => {
    window.localStorage.setItem(
      'stored-key',
      JSON.stringify({ from: '2024-05-01', to: '2024-05-10' }),
    );
    const { onFromDateChange, onToDateChange } = setup({
      storageKey: 'stored-key',
    });

    expect(onFromDateChange).toHaveBeenCalledWith('2024-05-01');
    expect(onToDateChange).toHaveBeenCalledWith('2024-05-10');
  });

  it('ignora storage inválido (JSON malformado) e não aplica preset se não houver', () => {
    window.localStorage.setItem('bad-key', '{not-json');
    const { onFromDateChange, onToDateChange } = setup({
      storageKey: 'bad-key',
    });

    expect(onFromDateChange).not.toHaveBeenCalled();
    expect(onToDateChange).not.toHaveBeenCalled();
  });

  it('ignora storage com valores não-string', () => {
    window.localStorage.setItem(
      'numeric-key',
      JSON.stringify({ from: 1, to: 2 }),
    );
    const { onFromDateChange, onToDateChange } = setup({
      storageKey: 'numeric-key',
      defaultPreset: 'today',
    });

    // Falls through to defaultPreset since stored values aren't valid strings.
    expect(onFromDateChange).toHaveBeenCalled();
    expect(onToDateChange).toHaveBeenCalled();
  });

  it('usa defaultPreset quando não há storageKey nem valores iniciais', () => {
    const { onFromDateChange, onToDateChange } = setup({
      defaultPreset: 'yesterday',
    });

    expect(onFromDateChange).toHaveBeenCalled();
    expect(onToDateChange).toHaveBeenCalled();
  });

  it('não chama callbacks na montagem quando não há storage nem defaultPreset', () => {
    const { onFromDateChange, onToDateChange } = setup();
    expect(onFromDateChange).not.toHaveBeenCalled();
    expect(onToDateChange).not.toHaveBeenCalled();
  });

  it('inicializa apenas uma vez sob React.StrictMode (efeito de montagem em duplicidade)', () => {
    const onFromDateChange = vi.fn();
    const onToDateChange = vi.fn();

    render(
      <StrictMode>
        <DateRangePicker
          fromDate=""
          toDate=""
          onFromDateChange={onFromDateChange}
          onToDateChange={onToDateChange}
          defaultPreset="yesterday"
        />
      </StrictMode>,
    );

    // StrictMode double-invokes the mount effect in development; the
    // `initializedRef` guard must ensure the preset is only applied once.
    expect(onFromDateChange).toHaveBeenCalledTimes(1);
    expect(onToDateChange).toHaveBeenCalledTimes(1);
  });

  it('não sobrescreve quando fromDate/toDate já vêm preenchidos', () => {
    window.localStorage.setItem(
      'ignored-key',
      JSON.stringify({ from: '2020-01-01', to: '2020-01-02' }),
    );
    const { onFromDateChange, onToDateChange } = setup({
      fromDate: '2024-01-01',
      toDate: '2024-01-02',
      storageKey: 'ignored-key',
    });

    expect(onFromDateChange).not.toHaveBeenCalled();
    expect(onToDateChange).not.toHaveBeenCalled();
  });

  it('trata fromDate malformado (mês zero) como indefinido ao abrir o popover', async () => {
    setup({ fromDate: '2024-00-10', toDate: '' });
    openPicker('A partir de 10/00/2024');
  });

  it('ignora erros ao persistir no storage (setItem lança exceção)', () => {
    const setItemSpy = vi
      .spyOn(window.localStorage.__proto__, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota exceeded');
      });

    setup({
      fromDate: '2024-01-10',
      toDate: '2024-01-15',
      storageKey: 'broken-key',
    });

    fireEvent.click(screen.getByRole('button', { name: 'Limpar período' }));

    setItemSpy.mockRestore();
  });

  it('aceita className customizada', () => {
    const { container } = render(
      <DateRangePicker
        fromDate=""
        toDate=""
        onFromDateChange={vi.fn()}
        onToDateChange={vi.fn()}
        className="custom-class"
      />,
    );
    expect(container.firstElementChild).toHaveClass('custom-class');
  });
});
