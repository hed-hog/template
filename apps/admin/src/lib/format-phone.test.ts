import { describe, it, expect } from 'vitest';
import { formatPhone } from './format-phone';

describe('formatPhone', () => {
  it('formata celular e fixo brasileiros', () => {
    expect(formatPhone('11992662104')).toBe('(11) 99266-2104');
    expect(formatPhone('1133334444')).toBe('(11) 3333-4444');
  });

  it('formata E.164 brasileiro com e sem o "+"', () => {
    expect(formatPhone('+5511992662104')).toBe('+55 (11) 99266-2104');
    expect(formatPhone('5511992662104')).toBe('+55 (11) 99266-2104');
    expect(formatPhone('551133334444')).toBe('+55 (11) 3333-4444');
  });

  it('ignora números já mascarados sem alterar o resultado', () => {
    expect(formatPhone('(11) 99266-2104')).toBe('(11) 99266-2104');
  });

  it('não aplica máscara brasileira em outro DDI', () => {
    // 11 dígitos, mas +1: sem a guarda viraria "(14) 15555-0123".
    expect(formatPhone('+14155550123')).toBe('+14155550123');
    expect(formatPhone('+351912345678')).toBe('+351912345678');
  });

  it('devolve o valor cru quando não reconhece o formato', () => {
    expect(formatPhone('0800 123 4567')).toBe('0800 123 4567');
    expect(formatPhone('ramal 42')).toBe('ramal 42');
    expect(formatPhone('123')).toBe('123');
  });

  it('devolve string vazia para valor ausente', () => {
    expect(formatPhone('')).toBe('');
    expect(formatPhone(null)).toBe('');
    expect(formatPhone(undefined)).toBe('');
  });
});
