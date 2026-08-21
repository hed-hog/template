import { format as formatDateFns, toZonedTime } from 'date-fns-tz';
import { enUS, ptBR } from 'date-fns/locale';

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

export function formatDate(
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
