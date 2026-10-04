'use client';

import {
  addMonths,
  format,
  isSameMonth,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type RefObject,
} from 'react';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  applyDateMask,
  dateToMask,
  isDateMaskInvalid,
  isDateMaskPartial,
  maskToDate,
  onlyDateDigits,
} from '@/lib/date-mask';
import { cn } from '@/lib/utils';

export type PresetId =
  | 'today'
  | 'yesterday'
  | 'last7Days'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'last30Days'
  | 'last90Days'
  | 'thisYear';

const PRESET_IDS: PresetId[] = [
  'today',
  'yesterday',
  'last7Days',
  'thisWeek',
  'lastWeek',
  'thisMonth',
  'lastMonth',
  'last30Days',
  'last90Days',
  'thisYear',
];

function toISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function isoToDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  return new Date(y, m - 1, d);
}

/**
 * Datas de um preset. Exportado para que uma pagina possa "voltar ao padrao"
 * (um botao Limpar, por exemplo) sem reimplementar a aritmetica de periodo.
 */
export function getPresetDates(preset: PresetId): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return { from: toISO(today), to: toISO(today) };

    case 'yesterday': {
      const d = new Date(today);
      d.setDate(d.getDate() - 1);
      return { from: toISO(d), to: toISO(d) };
    }

    case 'last7Days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from: toISO(from), to: toISO(today) };
    }

    case 'thisWeek': {
      const from = new Date(today);
      const day = today.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      from.setDate(today.getDate() + diff);
      return { from: toISO(from), to: toISO(today) };
    }

    case 'lastWeek': {
      const from = new Date(today);
      const day = today.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      from.setDate(today.getDate() + diffToMonday - 7);
      const to = new Date(from);
      to.setDate(from.getDate() + 6);
      return { from: toISO(from), to: toISO(to) };
    }

    case 'thisMonth': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from: toISO(from), to: toISO(today) };
    }

    case 'lastMonth': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from: toISO(from), to: toISO(to) };
    }

    case 'last30Days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from: toISO(from), to: toISO(today) };
    }

    case 'last90Days': {
      const from = new Date(today);
      from.setDate(from.getDate() - 89);
      return { from: toISO(from), to: toISO(today) };
    }

    case 'thisYear': {
      const from = new Date(today.getFullYear(), 0, 1);
      return { from: toISO(from), to: toISO(today) };
    }
  }
}

export function formatDateRangeLabel(
  fromDate: string,
  toDate: string
): string | null {
  if (!fromDate && !toDate) return null;
  const fmt = (d: string) => {
    /* v8 ignore next -- unreachable: every call site below already guards on fromDate/toDate being truthy before calling fmt */
    if (!d) return '?';
    const [y, m, day] = d.split('-');
    return `${day}/${m}/${y}`;
  };
  if (fromDate && toDate) return `${fmt(fromDate)} – ${fmt(toDate)}`;
  if (fromDate) return `A partir de ${fmt(fromDate)}`;
  return `Até ${fmt(toDate)}`;
}

/**
 * Período de trás pra frente vira período válido: quem digita 31/08 no "De"
 * e 01/08 no "Até" quis agosto, não um intervalo impossível. A troca sai na
 * confirmação — sair do campo ou aplicar — pra não mexer nos valores debaixo
 * dos dedos de quem ainda está digitando.
 */
function normalizeRange(range: DateRange | undefined): DateRange | undefined {
  if (range?.from && range.to && range.to < range.from) {
    return { from: range.to, to: range.from };
  }

  return range;
}

/**
 * Qual mês deixar no painel da esquerda depois de uma data digitada: o "De"
 * vai pro painel da esquerda e o "Até" pro da direita. Mês que já está à
 * vista não move nada — o calendário não pode dar um pulo a cada data
 * confirmada — e quando as duas pontas caem no mesmo mês ele fica à
 * esquerda, senão o "De" sairia da tela.
 */
function monthForTypedDate(
  field: 'from' | 'to',
  typed: Date,
  range: DateRange | undefined,
  current: Date | undefined
): Date {
  const target = startOfMonth(typed);

  if (current) {
    const left = startOfMonth(current);

    if (isSameMonth(target, left) || isSameMonth(target, addMonths(left, 1))) {
      return left;
    }
  }

  if (field === 'from') {
    return target;
  }

  if (range?.from && isSameMonth(range.from, typed)) {
    return target;
  }

  return subMonths(target, 1);
}

interface DateFieldProps {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  invalid: boolean;
  invalidMessage: string;
  inputRef: RefObject<HTMLInputElement | null>;
  onValueChange: (value: string) => void;
  onBlur: () => void;
  onEnter: () => void;
}

function DateField({
  id,
  label,
  placeholder,
  value,
  invalid,
  invalidMessage,
  inputRef,
  onValueChange,
  onBlur,
  onEnter,
}: DateFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="flex items-center gap-1.5">
      <Label htmlFor={id} className="shrink-0 text-xs text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        ref={inputRef}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="done"
        maxLength={10}
        placeholder={placeholder}
        value={value}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? errorId : undefined}
        className="h-8 w-28 px-2 text-center text-sm tabular-nums"
        onChange={(event) => onValueChange(event.target.value)}
        // Clicar e digitar sempre substitui: a máscara é da esquerda pra
        // direita, então editar no meio da string só confunde o cursor.
        onFocus={(event) => event.currentTarget.select()}
        onBlur={onBlur}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return;
          // O popover é portalizado, então o campo não pertence ao <form> de
          // nenhuma tela e não existe submit implícito — o preventDefault
          // fica de cinto e suspensório.
          event.preventDefault();
          onEnter();
        }}
      />
      {invalid && (
        <span id={errorId} role="alert" className="sr-only">
          {invalidMessage}
        </span>
      )}
    </div>
  );
}

function readStoredRange(key: string): { from: string; to: string } | null {
  /* v8 ignore next -- SSR-only guard, unreachable under jsdom where window is always defined */
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { from?: unknown; to?: unknown };
    if (typeof parsed.from === 'string' && typeof parsed.to === 'string') {
      return { from: parsed.from, to: parsed.to };
    }
  } catch {
    // ignore invalid values
  }
  return null;
}

function writeStoredRange(key: string, from: string, to: string) {
  /* v8 ignore next -- SSR-only guard, unreachable under jsdom where window is always defined */
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ from, to }));
  } catch {
    // ignore quota/serialization errors
  }
}

export interface DateRangePickerProps {
  fromDate: string;
  toDate: string;
  onFromDateChange: (date: string) => void;
  onToDateChange: (date: string) => void;
  defaultPreset?: PresetId;
  /** Key to persist the applied range in localStorage (rehydrated on load). */
  storageKey?: string;
  className?: string;
  /** Classes do botão que abre o calendário (ex.: esticar no celular). */
  triggerClassName?: string;
}

export function DateRangePicker({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  defaultPreset,
  storageKey,
  className,
  triggerClassName,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<DateRange | undefined>(undefined);
  const currentYear = new Date().getFullYear();
  const [decadeStart, setDecadeStart] = useState(currentYear - 9);
  const [pickerYear, setPickerYear] = useState<number | null>(null);
  const [showYearMonth, setShowYearMonth] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(
    undefined
  );
  const [fromText, setFromText] = useState('');
  const [toText, setToText] = useState('');
  const fromRef = useRef<HTMLInputElement>(null);
  const toRef = useRef<HTMLInputElement>(null);
  const autoAdvancingRef = useRef(false);
  const fromFieldId = useId();
  const toFieldId = useId();
  const initializedRef = useRef(false);

  const t = useTranslations('core.DateRangePicker');
  const locale = useLocale();
  const dateLocale = locale.startsWith('pt') ? ptBR : enUS;
  const monthNames = useMemo(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const name = format(new Date(2020, index, 1), 'LLLL', {
          locale: dateLocale,
        });
        return name.charAt(0).toUpperCase() + name.slice(1);
      }),
    [dateLocale]
  );

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    // Doesn't overwrite if the parent already came with a defined range.
    if (fromDate || toDate) return;

    const stored = storageKey ? readStoredRange(storageKey) : null;
    if (stored) {
      onFromDateChange(stored.from);
      onToDateChange(stored.to);
      return;
    }

    if (defaultPreset) {
      const { from, to } = getPresetDates(defaultPreset);
      onFromDateChange(from);
      onToDateChange(to);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Syncs the draft with the applied filter whenever the popover opens.
  useEffect(() => {
    if (open) {
      setDraft({
        from: isoToDate(fromDate),
        to: isoToDate(toDate),
      });
      setShowYearMonth(false);
      setPickerYear(null);
      setDecadeStart(currentYear - 9);
      // Semeado por isoToDate, não pela string crua: prop malformada abre com
      // o campo vazio em vez de mostrar uma data impossível.
      setFromText(dateToMask(isoToDate(fromDate)));
      setToText(dateToMask(isoToDate(toDate)));
      setCalendarMonth(isoToDate(fromDate) ?? new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hasRange = Boolean(fromDate || toDate);
  const displayText = formatDateRangeLabel(fromDate, toDate);

  const fromInvalid = isDateMaskInvalid(fromText);
  const toInvalid = isDateMaskInvalid(toText);
  const canApply = !fromInvalid && !toInvalid;

  /**
   * Funil de toda mudança do rascunho que não vem da digitação — calendário,
   * preset, mês, Limpar. Reescrever os dois textos no mesmo ato dispensa um
   * buffer de edição, que seria justamente o que brigaria com quem digita.
   */
  function commitDraft(next: DateRange | undefined) {
    const normalized = normalizeRange(next);
    setDraft(normalized);
    setFromText(dateToMask(normalized?.from));
    setToText(dateToMask(normalized?.to));
  }

  function handleFieldChange(field: 'from' | 'to', raw: string) {
    const masked = applyDateMask(raw);

    if (field === 'from') {
      setFromText(masked);
    } else {
      setToText(masked);
    }

    const digits = onlyDateDigits(masked);

    // Campo esvaziado: limpa só aquele lado do rascunho.
    if (digits.length === 0) {
      setDraft(
        field === 'from'
          ? { from: undefined, to: draft?.to }
          : { from: draft?.from, to: undefined }
      );
      return;
    }

    // Pela metade: não interpreta. O calendário não pode pular enquanto o ano
    // ainda está sendo digitado, e "0026" não é o ano 26.
    if (digits.length < 8) {
      return;
    }

    const parsed = maskToDate(masked);

    // 32/08, mês 13, 30 de fevereiro: mantém o texto na tela pra ser
    // corrigido — o anel vermelho avisa e o Aplicar trava.
    if (!parsed) {
      return;
    }

    const next =
      field === 'from'
        ? { from: parsed, to: draft?.to }
        : { from: draft?.from, to: parsed };

    setDraft(normalizeRange(next));
    setCalendarMonth((current) =>
      monthForTypedDate(field, parsed, next, current)
    );

    if (field === 'from') {
      // O foco sai daqui na hora, e o blur dispara junto, ainda dentro deste
      // handler: sem a marca ele reconciliaria o campo com o rascunho do
      // render anterior — que ainda nao conhece o que acabou de ser digitado —
      // e apagaria a data. Como o blur e sincrono, a marca se apaga na linha
      // seguinte e nunca fica presa.
      autoAdvancingRef.current = true;
      toRef.current?.focus();
      autoAdvancingRef.current = false;
    }
  }

  /**
   * Ao sair do campo os textos acertam o passo com o rascunho: par invertido
   * troca de lugar (o rascunho já trocou durante a digitação) e data pela
   * metade volta ao que está valendo, pra nenhum campo prometer um filtro que
   * o Aplicar não vai levar. Texto inválido fica como está — anel vermelho e
   * Aplicar travado perdem o sentido se o campo se desfizer sozinho.
   */
  function handleFieldBlur() {
    if (autoAdvancingRef.current) return;

    const typedFrom = maskToDate(fromText);
    const typedTo = maskToDate(toText);

    if (typedFrom && typedTo && typedTo < typedFrom) {
      setFromText(toText);
      setToText(fromText);
      return;
    }

    if (isDateMaskPartial(fromText)) {
      setFromText(dateToMask(draft?.from));
    }

    if (isDateMaskPartial(toText)) {
      setToText(dateToMask(draft?.to));
    }
  }

  function handleFieldEnter() {
    if (!canApply) return;
    applyDraft();
  }

  /**
   * Número digitado em qualquer lugar do popover começa a preencher a data
   * inicial. O react-day-picker só intercepta setas, PageUp/Down, Home e End
   * — dígito nenhum é consumido por ele, então o evento chega até aqui.
   */
  function handlePopoverKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.defaultPrevented) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (!/^\d$/.test(event.key)) return;
    // Já está digitando num dos campos: não sequestra.
    if ((event.target as HTMLElement).tagName === 'INPUT') return;

    event.preventDefault();
    setFromText(event.key);
    setDraft({ from: undefined, to: draft?.to });
    fromRef.current?.focus();
  }

  function applyPreset(preset: PresetId) {
    const { from, to } = getPresetDates(preset);
    commitDraft({ from: isoToDate(from), to: isoToDate(to) });
    setShowYearMonth(false);
  }

  function applyDraft() {
    const normalized = normalizeRange(draft);
    const from = normalized?.from ? toISO(normalized.from) : '';
    const to = normalized?.to ? toISO(normalized.to) : '';
    onFromDateChange(from);
    onToDateChange(to);
    if (storageKey) writeStoredRange(storageKey, from, to);
    setOpen(false);
  }

  function clearRange() {
    onFromDateChange('');
    onToDateChange('');
    if (storageKey) writeStoredRange(storageKey, '', '');
  }

  const decadeEnd = decadeStart + 9;
  const canGoNextDecade = decadeEnd < currentYear;
  const yearsList = Array.from({ length: 10 }, (_, index) => decadeEnd - index);

  function selectMonth(year: number, monthIndex: number) {
    commitDraft({
      from: new Date(year, monthIndex, 1),
      to: new Date(year, monthIndex + 1, 0),
    });
    setCalendarMonth(new Date(year, monthIndex, 1));
  }

  const isSelectedMonth = (year: number, monthIndex: number) =>
    !!draft?.from &&
    draft.from.getFullYear() === year &&
    draft.from.getMonth() === monthIndex;

  return (
    <div className={cn('flex items-center gap-1', className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'h-9 gap-2 px-3 text-sm font-normal',
              !hasRange && 'text-muted-foreground',
              triggerClassName
            )}
          >
            <CalendarIcon className="size-4 shrink-0" />
            <span>{displayText ?? t('placeholder')}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="max-h-[80vh] w-auto overflow-auto p-0"
          align="start"
          onKeyDown={handlePopoverKeyDown}
        >
          <div className="flex flex-col divide-y sm:flex-row sm:divide-x sm:divide-y-0">
            {/* Predefined suggestions */}
            <div className="flex min-w-37 flex-col gap-0.5 p-2">
              {PRESET_IDS.map((presetId) => (
                <Button
                  key={presetId}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => applyPreset(presetId)}
                >
                  {t(`presets.${presetId}`)}
                </Button>
              ))}
              <div className="my-1 border-t" />
              <Button
                variant={showYearMonth ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-between text-sm"
                onClick={() => setShowYearMonth((value) => !value)}
              >
                {t('otherYears')}
                <ChevronRight className="size-4 shrink-0" />
              </Button>
            </div>

            {/* Year/month picker (optional) + calendars + actions */}
            <div className="flex flex-col">
              <div className="flex min-h-72 flex-col divide-y sm:flex-row sm:divide-x sm:divide-y-0">
                {showYearMonth && (
                  <>
                    {/* Year list with decade navigation */}
                    <div className="flex min-w-32 flex-col p-2">
                      <div className="flex items-center justify-between gap-1 px-1 pb-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => setDecadeStart((value) => value - 10)}
                          tooltip={t('previousDecade')}
                        >
                          <ChevronLeft className="size-4" />
                        </Button>
                        <span className="text-xs font-medium">
                          {decadeStart} – {decadeEnd}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          disabled={!canGoNextDecade}
                          onClick={() =>
                            setDecadeStart((value) =>
                              Math.min(value + 10, currentYear - 9)
                            )
                          }
                          tooltip={t('nextDecade')}
                        >
                          <ChevronRight className="size-4" />
                        </Button>
                      </div>
                      <div className="flex max-h-72 flex-col gap-0.5 overflow-auto">
                        {yearsList.map((year) => (
                          <Button
                            key={year}
                            variant={
                              pickerYear === year ? 'secondary' : 'ghost'
                            }
                            size="sm"
                            className="w-full justify-start text-sm"
                            onClick={() => {
                              setPickerYear(year);
                              setCalendarMonth(new Date(year, 0, 1));
                            }}
                          >
                            {year}
                          </Button>
                        ))}
                      </div>
                    </div>

                    {/* Months of the selected year */}
                    {pickerYear !== null && (
                      <div className="flex max-h-72 min-w-36 flex-col gap-0.5 overflow-auto p-2">
                        {monthNames.map((label, monthIndex) => (
                          <Button
                            key={label}
                            variant={
                              isSelectedMonth(pickerYear, monthIndex)
                                ? 'default'
                                : 'ghost'
                            }
                            size="sm"
                            className="w-full justify-start text-sm"
                            onClick={() => selectMonth(pickerYear, monthIndex)}
                          >
                            {label}
                          </Button>
                        ))}
                      </div>
                    )}
                  </>
                )}
                <Calendar
                  mode="range"
                  numberOfMonths={2}
                  selected={draft}
                  onSelect={commitDraft}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  locale={dateLocale}
                  autoFocus
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t px-3 py-2">
                <div className="flex items-center gap-3">
                  <DateField
                    id={fromFieldId}
                    label={t('fromLabel')}
                    placeholder={t('datePlaceholder')}
                    value={fromText}
                    invalid={fromInvalid}
                    invalidMessage={t('invalidDate')}
                    inputRef={fromRef}
                    onValueChange={(value) => handleFieldChange('from', value)}
                    onBlur={handleFieldBlur}
                    onEnter={handleFieldEnter}
                  />
                  <DateField
                    id={toFieldId}
                    label={t('toLabel')}
                    placeholder={t('datePlaceholder')}
                    value={toText}
                    invalid={toInvalid}
                    invalidMessage={t('invalidDate')}
                    inputRef={toRef}
                    onValueChange={(value) => handleFieldChange('to', value)}
                    onBlur={handleFieldBlur}
                    onEnter={handleFieldEnter}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => commitDraft(undefined)}
                  >
                    {t('clear')}
                  </Button>
                  <Button size="sm" onClick={applyDraft} disabled={!canApply}>
                    {t('apply')}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {hasRange && (
        <Button
          variant="ghost"
          size="icon"
          className="size-9 shrink-0 text-muted-foreground hover:text-foreground"
          onClick={clearRange}
          tooltip={t('clearTooltip')}
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
