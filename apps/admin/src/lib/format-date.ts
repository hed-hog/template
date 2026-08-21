import { format as formatDateFnsPlain } from 'date-fns';
import { format as formatDateFns, toZonedTime } from 'date-fns-tz';
import { enUS, ptBR } from 'date-fns/locale';

const DATE_ONLY_PREFIX = /^(\d{4})-(\d{2})-(\d{2})/;
const DATE_ONLY_EXACT = /^\d{4}-\d{2}-\d{2}$/;

function isValidTimezone(timezone: string): boolean {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function normalizeDateFormat(format: string): string {
  return format.replace(/DD/g, 'dd').replace(/YYYY/g, 'yyyy');
}

function toDateValue(
  value: string | number | Date | null | undefined
): Date | null {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    return new Date(value);
  }

  return null;
}

function isValidDate(value: Date | null): value is Date {
  return !!value && !Number.isNaN(value.getTime());
}

/**
 * Interpreta um valor date-only ('2026-08-11' ou '2026-08-11T00:00:00.000Z')
 * como dia de calendário, ancorado ao meio-dia local. Colunas de data no banco
 * são gravadas como meia-noite UTC; converter esse instante para um fuso
 * negativo devolveria o dia anterior. O meio-dia impede qualquer offset de
 * empurrar o valor para outro dia.
 */
export function parseDateOnly(
  value: string | Date | null | undefined
): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== 'string') {
    return null;
  }

  const match = DATE_ONLY_PREFIX.exec(value.trim());

  if (!match) {
    return null;
  }

  return new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    12,
    0,
    0,
    0
  );
}

/**
 * Mesmo contrato de `formatDate` (respeita a setting `date-format` e o locale),
 * mas nunca aplica a setting `timezone` — use para valores que representam um
 * dia de calendário, não um instante.
 */
export function formatDateOnly(
  dateString: string | Date | null | undefined,
  getSettingValue: (key: string) => any,
  currentLocaleCode: string = 'pt-BR'
): string {
  const date = parseDateOnly(dateString);

  if (!isValidDate(date)) {
    return '—';
  }

  const rawDateFormat = getSettingValue('date-format') || 'dd/MM/yyyy';
  const dateFormat = normalizeDateFormat(rawDateFormat);
  const locale = currentLocaleCode.startsWith('pt') ? ptBR : enUS;
  return formatDateFnsPlain(date, dateFormat, { locale });
}

export function formatDate(
  dateString: string | number | Date | null | undefined,
  getSettingValue: (key: string) => any,
  currentLocaleCode: string = 'pt-BR'
): string {
  // 'YYYY-MM-DD' não carrega instante algum: aplicar fuso aqui devolveria o dia
  // anterior em qualquer offset negativo.
  if (typeof dateString === 'string' && DATE_ONLY_EXACT.test(dateString.trim())) {
    return formatDateOnly(dateString, getSettingValue, currentLocaleCode);
  }

  const date = toDateValue(dateString);

  if (!isValidDate(date)) {
    return '—';
  }

  const rawDateFormat = getSettingValue('date-format') || 'dd/MM/yyyy';
  const dateFormat = normalizeDateFormat(rawDateFormat);
  let timezone = getSettingValue('timezone') || 'UTC';

  if (!isValidTimezone(timezone)) {
    console.warn(`Invalid timezone "${timezone}", falling back to UTC`);
    timezone = 'UTC';
  }

  const zonedDate = toZonedTime(date, timezone);
  const locale = currentLocaleCode.startsWith('pt') ? ptBR : enUS;
  return formatDateFns(zonedDate, dateFormat, { timeZone: timezone, locale });
}

export function formatDateTime(
  dateString: string | number | Date | null | undefined,
  getSettingValue: (key: string) => any,
  currentLocaleCode: string = 'pt-BR'
): string {
  const date = toDateValue(dateString);

  if (!isValidDate(date)) {
    return '—';
  }

  const rawDateFormat = getSettingValue('date-format') || 'dd/MM/yyyy';
  const dateFormat = normalizeDateFormat(rawDateFormat);
  const timeFormat = getSettingValue('time-format') || 'HH:mm';
  let timezone = getSettingValue('timezone') || 'UTC';

  if (!isValidTimezone(timezone)) {
    console.warn(`Invalid timezone "${timezone}", falling back to UTC`);
    timezone = 'UTC';
  }

  const zonedDate = toZonedTime(date, timezone);
  const locale = currentLocaleCode.startsWith('pt') ? ptBR : enUS;
  const dateTimeFormat = `${dateFormat} ${timeFormat}`;
  return formatDateFns(zonedDate, dateTimeFormat, {
    timeZone: timezone,
    locale,
  });
}
