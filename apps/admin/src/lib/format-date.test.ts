import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  formatDate,
  formatDateOnly,
  formatDateTime,
  parseDateOnly,
} from './format-date';

const makeGetSetting =
  (map: Record<string, unknown>) =>
  (key: string): any =>
    map[key];

describe('formatDate', () => {
  afterEach(() => vi.restoreAllMocks());

  it('formata uma data válida no formato configurado (UTC)', () => {
    const get = makeGetSetting({ 'date-format': 'dd/MM/yyyy', timezone: 'UTC' });
    expect(formatDate('2024-01-15T10:00:00Z', get)).toBe('15/01/2024');
  });

  it('normaliza tokens DD/YYYY para dd/yyyy', () => {
    const get = makeGetSetting({ 'date-format': 'DD/MM/YYYY', timezone: 'UTC' });
    expect(formatDate('2024-01-15T10:00:00Z', get)).toBe('15/01/2024');
  });

  it('retorna "—" para datas inválidas / nulas', () => {
    const get = makeGetSetting({});
    expect(formatDate('not-a-date', get)).toBe('—');
    expect(formatDate(null, get)).toBe('—');
    expect(formatDate(undefined, get)).toBe('—');
  });

  it('usa o locale pt-BR ou en-US para nomes de mês', () => {
    const get = makeGetSetting({ 'date-format': 'dd MMMM yyyy', timezone: 'UTC' });
    expect(formatDate('2024-01-15T10:00:00Z', get, 'pt-BR')).toContain('janeiro');
    expect(formatDate('2024-01-15T10:00:00Z', get, 'en-US')).toContain('January');
  });

  it('timezone inválido faz fallback para UTC e avisa', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const get = makeGetSetting({ 'date-format': 'dd/MM/yyyy', timezone: 'Nope/Zone' });
    expect(formatDate('2024-01-15T10:00:00Z', get)).toBe('15/01/2024');
    expect(warn).toHaveBeenCalled();
  });

  it('não desloca o dia de uma string date-only em fuso negativo', () => {
    const get = makeGetSetting({
      'date-format': 'dd/MM/yyyy',
      timezone: 'America/Sao_Paulo',
    });
    expect(formatDate('2026-08-11', get)).toBe('11/08/2026');
  });

  it('continua aplicando o fuso em timestamps reais', () => {
    const get = makeGetSetting({
      'date-format': 'dd/MM/yyyy',
      timezone: 'America/Sao_Paulo',
    });
    expect(formatDate('2026-08-11T01:00:00Z', get)).toBe('10/08/2026');
  });
});

describe('parseDateOnly', () => {
  it('lê o dia de calendário de uma string date-only', () => {
    const date = parseDateOnly('2026-08-11');
    expect(date?.getFullYear()).toBe(2026);
    expect(date?.getMonth()).toBe(7);
    expect(date?.getDate()).toBe(11);
  });

  it('ignora a parte de hora de um ISO em meia-noite UTC', () => {
    const date = parseDateOnly('2026-08-11T00:00:00.000Z');
    expect(date?.getDate()).toBe(11);
    expect(date?.getMonth()).toBe(7);
  });

  it('retorna null para valores sem data reconhecível', () => {
    expect(parseDateOnly('')).toBeNull();
    expect(parseDateOnly(null)).toBeNull();
    expect(parseDateOnly(undefined)).toBeNull();
    expect(parseDateOnly('11/08/2026')).toBeNull();
  });

  it('devolve o próprio Date quando já recebe um', () => {
    const input = new Date(2026, 7, 11, 12, 0, 0);
    expect(parseDateOnly(input)).toBe(input);
    expect(parseDateOnly(new Date(NaN))).toBeNull();
  });
});

describe('formatDateOnly', () => {
  const saoPaulo = makeGetSetting({
    'date-format': 'dd/MM/yyyy',
    timezone: 'America/Sao_Paulo',
  });

  it('mantém o dia de uma string date-only', () => {
    expect(formatDateOnly('2026-08-11', saoPaulo)).toBe('11/08/2026');
  });

  it('mantém o dia de um ISO gravado em meia-noite UTC', () => {
    expect(formatDateOnly('2026-08-11T00:00:00.000Z', saoPaulo)).toBe(
      '11/08/2026'
    );
  });

  it('respeita o formato configurado e o locale', () => {
    const get = makeGetSetting({
      'date-format': 'DD MMMM YYYY',
      timezone: 'America/Sao_Paulo',
    });
    expect(formatDateOnly('2026-08-11', get, 'pt-BR')).toContain('agosto');
    expect(formatDateOnly('2026-08-11', get, 'en-US')).toContain('August');
  });

  it('retorna "—" para valor inválido / nulo', () => {
    expect(formatDateOnly(null, saoPaulo)).toBe('—');
    expect(formatDateOnly(undefined, saoPaulo)).toBe('—');
    expect(formatDateOnly('not-a-date', saoPaulo)).toBe('—');
  });
});

describe('formatDateTime', () => {
  afterEach(() => vi.restoreAllMocks());

  it('combina data e hora com os formatos configurados', () => {
    const get = makeGetSetting({
      'date-format': 'dd/MM/yyyy',
      'time-format': 'HH:mm',
      timezone: 'UTC',
    });
    expect(formatDateTime('2024-01-15T13:45:00Z', get)).toBe('15/01/2024 13:45');
  });

  it('retorna "—" para valor inválido', () => {
    expect(formatDateTime('bad', makeGetSetting({}))).toBe('—');
  });

  it('timezone inválido faz fallback para UTC', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const get = makeGetSetting({
      'date-format': 'dd/MM/yyyy',
      'time-format': 'HH:mm',
      timezone: 'Bad/Zone',
    });
    expect(formatDateTime('2024-01-15T13:45:00Z', get)).toBe('15/01/2024 13:45');
  });
});
