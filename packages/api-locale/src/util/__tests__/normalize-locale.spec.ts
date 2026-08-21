import { describe, expect, it } from '@jest/globals';
import { normalizeLocaleCode } from '../normalize-locale';

describe('normalizeLocaleCode', () => {
  it('reduz a tag regional ao code da tabela `locale`', () => {
    expect(normalizeLocaleCode('pt-BR')).toBe('pt');
    expect(normalizeLocaleCode('pt-PT')).toBe('pt');
    expect(normalizeLocaleCode('en-US')).toBe('en');
  });

  // Plataforma nativa (Android) entrega o locale com `_`.
  it('aceita separador de underscore', () => {
    expect(normalizeLocaleCode('pt_BR')).toBe('pt');
  });

  it('normaliza caixa e espaco', () => {
    expect(normalizeLocaleCode('PT')).toBe('pt');
    expect(normalizeLocaleCode('  En-Us  ')).toBe('en');
  });

  it('usa o primeiro idioma de um Accept-Language completo', () => {
    expect(normalizeLocaleCode('pt-BR,pt;q=0.9,en;q=0.8')).toBe('pt');
    expect(normalizeLocaleCode('en-US,en;q=0.9,pt;q=0.8')).toBe('en');
  });

  it('descarta o peso quando o idioma vem sozinho', () => {
    expect(normalizeLocaleCode('pt;q=0.9')).toBe('pt');
  });

  it('devolve null para entrada ausente ou sem idioma', () => {
    expect(normalizeLocaleCode(undefined)).toBeNull();
    expect(normalizeLocaleCode(null)).toBeNull();
    expect(normalizeLocaleCode('')).toBeNull();
    expect(normalizeLocaleCode('   ')).toBeNull();
    expect(normalizeLocaleCode('*')).toBeNull();
    expect(normalizeLocaleCode('123')).toBeNull();
  });

  // O code nao existir na tabela e problema de quem consulta, nao daqui.
  it('nao valida se o idioma existe no sistema', () => {
    expect(normalizeLocaleCode('de-DE')).toBe('de');
  });
});
