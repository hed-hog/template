import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let mockLocale = 'pt-BR';

/**
 * Os rótulos do componente vêm de `core.DateRangePicker`. O mock devolve o
 * texto pt-BR real para as asserções continuarem falando a língua da tela.
 */
const messages: Record<string, string> = {
  placeholder: 'Selecionar período',
  apply: 'Aplicar',
  clear: 'Limpar',
  clearTooltip: 'Limpar período',
  otherYears: 'Outros anos',
  fromLabel: 'De',
  toLabel: 'Até',
  datePlaceholder: 'dd/mm/aaaa',
  invalidDate: 'Data inválida',
  previousDecade: 'Década anterior',
  nextDecade: 'Próxima década',
  'presets.today': 'Hoje',
  'presets.yesterday': 'Ontem',
  'presets.last7Days': 'Últimos 7 dias',
  'presets.thisWeek': 'Esta semana',
  'presets.lastWeek': 'Semana passada',
  'presets.thisMonth': 'Este mês',
  'presets.lastMonth': 'Mês passado',
  'presets.last30Days': 'Últimos 30 dias',
  'presets.last90Days': 'Últimos 90 dias',
  'presets.thisYear': 'Este ano',
};

vi.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: () => (key: string) => messages[key] ?? key,
}));

type CalendarSelectHandler = (range: unknown) => void;

vi.mock('@/components/ui/calendar', () => ({
  Calendar: (props: {
    month?: Date;
    onSelect?: CalendarSelectHandler;
    onMonthChange?: (month: Date) => void;
  }) => (
    <div data-testid="calendar-stub">
      {/* O mês visível é o que a regra de "onde cai a data digitada" decide. */}
      <span data-testid="calendar-month">
        {props.month
          ? `${props.month.getFullYear()}-${String(
              props.month.getMonth() + 1
            ).padStart(2, '0')}`
          : ''}
      </span>
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
      <button
        type="button"
        onClick={() => props.onMonthChange?.(new Date(2024, 0, 1))}
      >
        set-month-jan-2024
      </button>
      {/* Tecla já tratada por outro handler não pode ser sequestrada. */}
      <button type="button" onKeyDown={(event) => event.preventDefault()}>
        swallow-key
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

/**
 * Digita dígito a dígito, como o usuário faz — a máscara monta o resto. Focar
 * seleciona o conteúdo, então o primeiro dígito substitui o que havia no campo.
 */
function typeDigits(label: string, digits: string) {
  let value = '';

  for (const digit of digits) {
    value += digit;
    fireEvent.change(screen.getByLabelText(label), { target: { value } });
  }
}

function fieldValue(label: string) {
  return (screen.getByLabelText(label) as HTMLInputElement).value;
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
    // Sincronização reversa: escolher pelo calendário reescreve os campos.
    expect(fieldValue('De')).toBe('10/01/2024');
    expect(fieldValue('Até')).toBe('15/01/2024');

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
    expect(fieldValue('De')).toBe('05/03/2024');
    expect(fieldValue('Até')).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(onFromDateChange).toHaveBeenCalledWith('2024-03-05');
    expect(onToDateChange).toHaveBeenCalledWith('');
  });

  it('limpa o rascunho dentro do popover e aplica um rascunho vazio', async () => {
    const { onFromDateChange, onToDateChange } = setup();
    openPicker();

    fireEvent.click(await screen.findByText('set-full-range'));
    expect(fieldValue('De')).toBe('10/01/2024');

    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(fieldValue('De')).toBe('');
    expect(fieldValue('Até')).toBe('');

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

    // O campo é semeado pela data interpretada, não pela string crua.
    expect(await screen.findByLabelText('De')).toHaveValue('');
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

  it('abre com os campos preenchidos a partir das props', async () => {
    setup({ fromDate: '2024-01-10', toDate: '2024-01-15' });
    openPicker('10/01/2024 – 15/01/2024');

    expect(await screen.findByLabelText('De')).toHaveValue('10/01/2024');
    expect(screen.getByLabelText('Até')).toHaveValue('15/01/2024');
  });

  it('digita um intervalo completo e aplica', async () => {
    const { onFromDateChange, onToDateChange } = setup({
      storageKey: 'typed-range',
    });
    openPicker();
    await screen.findByLabelText('De');

    typeDigits('De', '01082026');
    typeDigits('Até', '31082026');

    expect(fieldValue('De')).toBe('01/08/2026');
    expect(fieldValue('Até')).toBe('31/08/2026');

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(onFromDateChange).toHaveBeenCalledWith('2026-08-01');
    expect(onToDateChange).toHaveBeenCalledWith('2026-08-31');
  });

  it('monta a máscara enquanto digita, sem barra à direita', async () => {
    setup();
    openPicker();
    const input = await screen.findByLabelText('De');

    fireEvent.change(input, { target: { value: '0' } });
    expect(fieldValue('De')).toBe('0');

    fireEvent.change(input, { target: { value: '01' } });
    expect(fieldValue('De')).toBe('01');

    fireEvent.change(input, { target: { value: '010' } });
    expect(fieldValue('De')).toBe('01/0');

    fireEvent.change(input, { target: { value: '01/08' } });
    expect(fieldValue('De')).toBe('01/08');

    fireEvent.change(input, { target: { value: '01/082' } });
    expect(fieldValue('De')).toBe('01/08/2');
  });

  it('avança o foco para "Até" no oitavo dígito', async () => {
    setup();
    openPicker();
    await screen.findByLabelText('De');

    typeDigits('De', '01082026');

    expect(document.activeElement).toBe(screen.getByLabelText('Até'));
  });

  it('não desfaz a data quando o auto-avanço tira o foco do campo', async () => {
    const { onFromDateChange, onToDateChange } = setup({
      fromDate: '2024-01-10',
      toDate: '2024-01-15',
    });
    openPicker('10/01/2024 – 15/01/2024');

    // Com o campo realmente focado, o focus() do auto-avanço dispara o blur
    // ainda dentro do mesmo handler — e o blur não pode reconciliar com o
    // rascunho do render anterior, que ainda não viu o oitavo dígito.
    (await screen.findByLabelText('De')).focus();
    typeDigits('De', '05012024');

    expect(fieldValue('De')).toBe('05/01/2024');
    expect(document.activeElement).toBe(screen.getByLabelText('Até'));

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(onFromDateChange).toHaveBeenCalledWith('2024-01-05');
    expect(onToDateChange).toHaveBeenCalledWith('2024-01-15');
  });

  it('remasca texto colado com outros separadores', async () => {
    setup();
    openPicker();
    const input = await screen.findByLabelText('De');

    fireEvent.change(input, { target: { value: '01-08-2026' } });

    expect(fieldValue('De')).toBe('01/08/2026');
  });

  it('ignora entrada pela metade e a desfaz ao sair do campo', async () => {
    const { onFromDateChange } = setup();
    openPicker();
    const input = await screen.findByLabelText('De');

    typeDigits('De', '0108');
    expect(fieldValue('De')).toBe('01/08');

    fireEvent.blur(input);
    expect(fieldValue('De')).toBe('');

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(onFromDateChange).toHaveBeenCalledWith('');
  });

  it.each([
    ['dia impossível', '32082026'],
    ['mês impossível', '01132026'],
    ['30 de fevereiro', '30022024'],
    ['ano fora de faixa', '01080026'],
  ])('marca %s como inválido e trava o Aplicar', async (_label, digits) => {
    const { onFromDateChange } = setup();
    openPicker();
    await screen.findByLabelText('De');

    typeDigits('De', digits);

    expect(screen.getByLabelText('De')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('button', { name: 'Aplicar' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Data inválida');

    // Texto inválido não se desfaz sozinho: fica na tela pra ser corrigido.
    fireEvent.blur(screen.getByLabelText('De'));
    expect(fieldValue('De')).not.toBe('');
    expect(onFromDateChange).not.toHaveBeenCalled();
  });

  it('esvaziar um campo limpa só aquele lado do período', async () => {
    const { onFromDateChange, onToDateChange } = setup();
    openPicker();

    fireEvent.click(await screen.findByText('set-full-range'));
    fireEvent.change(screen.getByLabelText('De'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(onFromDateChange).toHaveBeenCalledWith('');
    expect(onToDateChange).toHaveBeenCalledWith('2024-01-15');
  });

  it('esvaziar o "Até" limpa só o fim do período', async () => {
    const { onFromDateChange, onToDateChange } = setup();
    openPicker();

    fireEvent.click(await screen.findByText('set-full-range'));
    fireEvent.change(screen.getByLabelText('Até'), { target: { value: '' } });

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(onFromDateChange).toHaveBeenCalledWith('2024-01-10');
    expect(onToDateChange).toHaveBeenCalledWith('');
  });

  it('inverte os campos ao sair quando o início fica depois do fim', async () => {
    setup();
    openPicker();

    fireEvent.click(await screen.findByText('set-full-range'));
    typeDigits('De', '20012024');
    expect(fieldValue('De')).toBe('20/01/2024');

    fireEvent.blur(screen.getByLabelText('De'));

    expect(fieldValue('De')).toBe('15/01/2024');
    expect(fieldValue('Até')).toBe('20/01/2024');
  });

  it('aplica o período já invertido quando o início ficou depois do fim', async () => {
    const { onFromDateChange, onToDateChange } = setup();
    openPicker();

    fireEvent.click(await screen.findByText('set-full-range'));
    typeDigits('De', '20012024');
    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(onFromDateChange).toHaveBeenCalledWith('2024-01-15');
    expect(onToDateChange).toHaveBeenCalledWith('2024-01-20');
  });

  it('preserva o fim quando o início digitado é anterior a ele', async () => {
    setup();
    openPicker();

    fireEvent.click(await screen.findByText('set-full-range'));
    typeDigits('De', '05012024');

    expect(fieldValue('Até')).toBe('15/01/2024');
  });

  it('Enter dentro do campo aplica o período', async () => {
    const { onFromDateChange, onToDateChange } = setup();
    openPicker();
    await screen.findByLabelText('De');

    typeDigits('De', '01082026');
    typeDigits('Até', '31082026');
    fireEvent.keyDown(screen.getByLabelText('Até'), { key: 'Enter' });

    expect(onFromDateChange).toHaveBeenCalledWith('2026-08-01');
    expect(onToDateChange).toHaveBeenCalledWith('2026-08-31');
  });

  it('Enter não aplica com o campo inválido, e outras teclas não interferem', async () => {
    const { onFromDateChange } = setup();
    openPicker();
    await screen.findByLabelText('De');

    typeDigits('De', '32082026');
    fireEvent.keyDown(screen.getByLabelText('De'), { key: 'Tab' });
    fireEvent.keyDown(screen.getByLabelText('De'), { key: 'Enter' });

    expect(onFromDateChange).not.toHaveBeenCalled();
  });

  it('seleciona o conteúdo ao focar, pra digitar por cima', async () => {
    setup({ fromDate: '2024-01-10', toDate: '2024-01-15' });
    openPicker('10/01/2024 – 15/01/2024');

    const input = (await screen.findByLabelText('De')) as HTMLInputElement;
    fireEvent.focus(input);

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe('10/01/2024'.length);
  });

  it('sincroniza os campos ao clicar num preset', async () => {
    setup();
    openPicker();

    fireEvent.click(await screen.findByText('Hoje'));

    const today = new Date();
    const expected = `${String(today.getDate()).padStart(2, '0')}/${String(
      today.getMonth() + 1
    ).padStart(2, '0')}/${today.getFullYear()}`;

    expect(fieldValue('De')).toBe(expected);
    expect(fieldValue('Até')).toBe(expected);
  });

  it('sincroniza os campos ao escolher ano e mês em "Outros anos"', async () => {
    setup();
    openPicker();

    fireEvent.click(await screen.findByText('Outros anos'));
    const currentYear = new Date().getFullYear();
    fireEvent.click(screen.getByText(String(currentYear)));
    fireEvent.click(await screen.findByText('Janeiro'));

    expect(fieldValue('De')).toBe(`01/01/${currentYear}`);
    expect(fieldValue('Até')).toBe(`31/01/${currentYear}`);
  });

  describe('mês visível depois de uma data digitada', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2024, 0, 10, 12, 0, 0));
    });

    it('leva o mês do "De" para o painel da esquerda', async () => {
      setup();
      openPicker();
      await screen.findByLabelText('De');

      typeDigits('De', '01032026');

      expect(screen.getByTestId('calendar-month')).toHaveTextContent('2026-03');
    });

    it('leva o mês do "Até" para o painel da direita', async () => {
      setup();
      openPicker();
      await screen.findByLabelText('Até');

      typeDigits('Até', '01062026');

      expect(screen.getByTestId('calendar-month')).toHaveTextContent('2026-05');
    });

    it('não mexe no calendário quando o mês digitado já está à vista', async () => {
      setup();
      openPicker();
      await screen.findByLabelText('De');

      typeDigits('De', '01082026');
      typeDigits('Até', '10092026');

      expect(screen.getByTestId('calendar-month')).toHaveTextContent('2026-08');
    });

    it('deixa o mês à esquerda quando as duas pontas caem nele', async () => {
      setup();
      openPicker();
      await screen.findByLabelText('De');

      typeDigits('De', '05082026');
      // Tira o calendário de agosto pra não cair no caso "já está à vista".
      fireEvent.click(screen.getByText('set-month-jan-2024'));
      expect(screen.getByTestId('calendar-month')).toHaveTextContent('2024-01');

      typeDigits('Até', '20082026');

      expect(screen.getByTestId('calendar-month')).toHaveTextContent('2026-08');
    });
  });

  describe('digitar com o foco fora dos campos', () => {
    it('começa a preencher o "De" com o dígito teclado', async () => {
      setup();
      openPicker();

      fireEvent.keyDown(await screen.findByText('set-full-range'), {
        key: '3',
      });

      expect(fieldValue('De')).toBe('3');
      expect(document.activeElement).toBe(screen.getByLabelText('De'));
    });

    it('preserva o fim já escolhido ao recomeçar o início', async () => {
      setup();
      openPicker();

      fireEvent.click(await screen.findByText('set-full-range'));
      fireEvent.keyDown(screen.getByText('set-full-range'), { key: '2' });

      expect(fieldValue('De')).toBe('2');
      expect(fieldValue('Até')).toBe('15/01/2024');
    });

    it('ignora letra, atalho e tecla já tratada por outro handler', async () => {
      setup();
      openPicker();

      const target = await screen.findByText('set-full-range');
      fireEvent.keyDown(target, { key: 'a' });
      fireEvent.keyDown(target, { key: '1', ctrlKey: true });
      fireEvent.keyDown(target, { key: '2', metaKey: true });
      fireEvent.keyDown(target, { key: '3', altKey: true });
      fireEvent.keyDown(screen.getByText('swallow-key'), { key: '4' });

      expect(fieldValue('De')).toBe('');
    });

    it('não sequestra a digitação quando o foco já está num campo', async () => {
      setup();
      openPicker();

      fireEvent.keyDown(await screen.findByLabelText('Até'), { key: '5' });

      expect(fieldValue('De')).toBe('');
      expect(fieldValue('Até')).toBe('');
    });
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
