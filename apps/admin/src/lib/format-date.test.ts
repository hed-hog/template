import { describe, it, expect, vi, afterEach } from 'vitest';
import { formatDate, formatDateTime } from './format-date';

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

  it('aceita um objeto Date diretamente', () => {
    const get = makeGetSetting({ 'date-format': 'dd/MM/yyyy', timezone: 'UTC' });
    expect(formatDate(new Date('2024-01-15T10:00:00Z'), get)).toBe('15/01/2024');
  });

  it('usa os padrões dd/MM/yyyy e UTC quando as configurações não existem', () => {
    const get = makeGetSetting({});
    expect(formatDate('2024-01-15T10:00:00Z', get)).toBe('15/01/2024');
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

  it('usa os padrões dd/MM/yyyy, HH:mm e UTC quando as configurações não existem', () => {
    const get = makeGetSetting({});
    expect(formatDateTime('2024-01-15T13:45:00Z', get)).toBe('15/01/2024 13:45');
  });

  it('usa o locale en-US quando informado', () => {
    const get = makeGetSetting({
      'date-format': 'dd MMMM yyyy',
      'time-format': 'HH:mm',
      timezone: 'UTC',
    });
    expect(formatDateTime('2024-01-15T13:45:00Z', get, 'en-US')).toContain('January');
  });
});
