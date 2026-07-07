'use client';

import { format } from 'date-fns';
import { enUS, ptBR } from 'date-fns/locale';
import { CalendarIcon, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { useLocale } from 'next-intl';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

type PresetId =
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

const PRESETS: { id: PresetId; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'last7Days', label: 'Últimos 7 dias' },
  { id: 'thisWeek', label: 'Esta semana' },
  { id: 'lastWeek', label: 'Semana passada' },
  { id: 'thisMonth', label: 'Este mês' },
  { id: 'lastMonth', label: 'Mês passado' },
  { id: 'last30Days', label: 'Últimos 30 dias' },
  { id: 'last90Days', label: 'Últimos 90 dias' },
  { id: 'thisYear', label: 'Este ano' },
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

function getPresetDates(preset: PresetId): { from: string; to: string } {
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
}

export function DateRangePicker({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  defaultPreset,
  storageKey,
  className,
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
  const initializedRef = useRef(false);

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
      setCalendarMonth(isoToDate(fromDate) ?? new Date());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const hasRange = Boolean(fromDate || toDate);
  const displayText = formatDateRangeLabel(fromDate, toDate);

  const draftLabel = draft?.from
    ? formatDateRangeLabel(toISO(draft.from), draft.to ? toISO(draft.to) : '')
    : null;

  function applyPreset(preset: PresetId) {
    const { from, to } = getPresetDates(preset);
    setDraft({ from: isoToDate(from), to: isoToDate(to) });
    setShowYearMonth(false);
  }

  function applyDraft() {
    const from = draft?.from ? toISO(draft.from) : '';
    const to = draft?.to ? toISO(draft.to) : '';
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
    setDraft({
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
              !hasRange && 'text-muted-foreground'
            )}
          >
            <CalendarIcon className="size-4 shrink-0" />
            <span>{displayText ?? 'Selecionar período'}</span>
          </Button>
        </PopoverTrigger>

        <PopoverContent
          className="max-h-[80vh] w-auto overflow-auto p-0"
          align="start"
        >
          <div className="flex flex-col divide-y sm:flex-row sm:divide-x sm:divide-y-0">
            {/* Predefined suggestions */}
            <div className="flex min-w-37 flex-col gap-0.5 p-2">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-sm"
                  onClick={() => applyPreset(preset.id)}
                >
                  {preset.label}
                </Button>
              ))}
              <div className="my-1 border-t" />
              <Button
                variant={showYearMonth ? 'secondary' : 'ghost'}
                size="sm"
                className="w-full justify-between text-sm"
                onClick={() => setShowYearMonth((value) => !value)}
              >
                Outros anos
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
                        aria-label="Década anterior"
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
                        aria-label="Próxima década"
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>
                    <div className="flex max-h-72 flex-col gap-0.5 overflow-auto">
                      {yearsList.map((year) => (
                        <Button
                          key={year}
                          variant={pickerYear === year ? 'secondary' : 'ghost'}
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
                  onSelect={setDraft}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  locale={dateLocale}
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
                <span className="text-xs text-muted-foreground">
                  {draftLabel ?? 'Selecione um período'}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => setDraft(undefined)}
                  >
                    Limpar
                  </Button>
                  <Button size="sm" onClick={applyDraft}>
                    Aplicar
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
          aria-label="Limpar período"
        >
          <X className="size-4" />
        </Button>
      )}
    </div>
  );
}
