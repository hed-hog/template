import { describe, expect, it } from 'vitest';

import {
  applyDateMask,
  dateToMask,
  isDateMaskInvalid,
  isDateMaskPartial,
  maskToDate,
  onlyDateDigits,
} from './date-mask';

describe('onlyDateDigits', () => {
  it('mantém só os dígitos', () => {
    expect(onlyDateDigits('01/08/2026')).toBe('01082026');
    expect(onlyDateDigits('abc')).toBe('');
  });

  it('trunca no oitavo dígito', () => {
    expect(onlyDateDigits('0108202699')).toBe('01082026');
  });
});

describe('applyDateMask', () => {
  it('não emite barra à direita (senão o Backspace trava no separador)', () => {
    expect(applyDateMask('')).toBe('');
    expect(applyDateMask('0')).toBe('0');
    expect(applyDateMask('01')).toBe('01');
    expect(applyDateMask('0108')).toBe('01/08');
  });

  it('abre o separador só atrás de dígito já digitado', () => {
    expect(applyDateMask('010')).toBe('01/0');
    expect(applyDateMask('01082')).toBe('01/08/2');
    expect(applyDateMask('01082026')).toBe('01/08/2026');
  });

  it('remasca o que já vem com separador e ignora o excedente', () => {
    expect(applyDateMask('01-08-2026')).toBe('01/08/2026');
    expect(applyDateMask('01/08/2026')).toBe('01/08/2026');
    expect(applyDateMask('010820269')).toBe('01/08/2026');
  });

  it('descarta texto sem dígito', () => {
    expect(applyDateMask('abc')).toBe('');
  });
});

describe('maskToDate', () => {
  it('interpreta uma data completa', () => {
    const date = maskToDate('01/08/2026');
    expect(date).toEqual(new Date(2026, 7, 1));
  });

  it('não interpreta entrada parcial', () => {
    expect(maskToDate('')).toBeNull();
    expect(maskToDate('01/08')).toBeNull();
    // Ano ainda sendo digitado: `0026` não pode virar o ano 26.
    expect(maskToDate('01/08/202')).toBeNull();
  });

  it('recusa dia impossível', () => {
    expect(maskToDate('32/08/2026')).toBeNull();
    expect(maskToDate('00/08/2026')).toBeNull();
  });

  it('recusa mês impossível', () => {
    expect(maskToDate('01/13/2026')).toBeNull();
    expect(maskToDate('01/00/2026')).toBeNull();
  });

  it('recusa 30 de fevereiro (o new Date corrigiria em silêncio)', () => {
    expect(maskToDate('30/02/2024')).toBeNull();
    expect(maskToDate('29/02/2023')).toBeNull();
  });

  it('aceita 29 de fevereiro em ano bissexto', () => {
    expect(maskToDate('29/02/2024')).toEqual(new Date(2024, 1, 29));
  });

  it('recusa ano fora da faixa', () => {
    expect(maskToDate('01/08/0026')).toBeNull();
    expect(maskToDate('01/08/3026')).toBeNull();
  });
});

describe('isDateMaskInvalid', () => {
  it('não acusa entrada parcial', () => {
    expect(isDateMaskInvalid('')).toBe(false);
    expect(isDateMaskInvalid('01/08')).toBe(false);
  });

  it('não acusa data válida', () => {
    expect(isDateMaskInvalid('01/08/2026')).toBe(false);
  });

  it('acusa data completa impossível', () => {
    expect(isDateMaskInvalid('32/08/2026')).toBe(true);
  });
});

describe('dateToMask', () => {
  it('formata com zero à esquerda', () => {
    expect(dateToMask(new Date(2026, 7, 1))).toBe('01/08/2026');
    expect(dateToMask(new Date(2026, 11, 31))).toBe('31/12/2026');
  });

  it('devolve vazio sem data', () => {
    expect(dateToMask(null)).toBe('');
    expect(dateToMask(undefined)).toBe('');
  });
});

describe('isDateMaskPartial', () => {
  it('acusa data pela metade', () => {
    expect(isDateMaskPartial('0')).toBe(true);
    expect(isDateMaskPartial('01/08')).toBe(true);
    expect(isDateMaskPartial('01/08/202')).toBe(true);
  });

  it('não acusa campo vazio nem data completa', () => {
    expect(isDateMaskPartial('')).toBe(false);
    expect(isDateMaskPartial('01/08/2026')).toBe(false);
    expect(isDateMaskPartial('32/08/2026')).toBe(false);
  });
});
