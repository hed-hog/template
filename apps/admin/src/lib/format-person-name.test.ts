import { describe, it, expect } from 'vitest';
import { formatPersonName } from './format-person-name';

/**
 * Mesmos 25 casos de referência de
 * packages/api-prisma/src/format-person-name.spec.ts — as duas implementações
 * precisam concordar, ou o campo mostra um resultado diferente do que o backend salva.
 */
describe('formatPersonName', () => {
  describe('recaixa o que está inteiramente em maiúsculo ou minúsculo', () => {
    const cases: Array<[string, string]> = [
      ['APARECIDA DA SILVA', 'Aparecida da Silva'],
      [
        'drielle jhenyffer da silva colares santana',
        'Drielle Jhenyffer da Silva Colares Santana',
      ],
      ['MARCSOS VINICIUS MOREIRA BARACHO', 'Marcsos Vinicius Moreira Baracho'],
      ['ISABELLE FERREIRA ALVES VIEIRA', 'Isabelle Ferreira Alves Vieira'],
      ['DANIEL LEANDRO DE OLIVEIRA LEÃO', 'Daniel Leandro de Oliveira Leão'],
      ['natalia firmino silva de souza', 'Natalia Firmino Silva de Souza'],
      ['JOSÉ', 'José'],
    ];

    it.each(cases)('%s -> %s', (input, expected) => {
      expect(formatPersonName(input)).toBe(expected);
    });
  });

  it('mantém o conectivo em maiúsculo quando ele abre o nome', () => {
    expect(formatPersonName('DA SILVA JUNIOR')).toBe('Da Silva Junior');
  });

  it('deixa os conectivos do meio em minúsculo', () => {
    expect(formatPersonName('MARIA DOS SANTOS E COSTA')).toBe(
      'Maria dos Santos e Costa'
    );
  });

  it('preserva numeral dinástico', () => {
    expect(formatPersonName('JOAO PEDRO III')).toBe('Joao Pedro III');
  });

  it('capitaliza depois de apóstrofo, hífen e ponto', () => {
    expect(formatPersonName("d'avila sant'ana")).toBe("D'Avila Sant'Ana");
    expect(formatPersonName('ana-maria de souza')).toBe('Ana-Maria de Souza');
    expect(formatPersonName('j.p. da costa')).toBe('J.P. da Costa');
  });

  describe('não toca em nome que já tem caixa mista', () => {
    const untouched = [
      'João da Silva',
      'Yasmin Côrtes Franco Souza',
      'McDonald',
      "D'Ávila",
      'Usuário removido',
      'Usuário 42',
      'Anônimo (para avaliações)',
    ];

    it.each(untouched)('%s', (input) => {
      expect(formatPersonName(input)).toBe(input);
    });
  });

  it('não recaixa e-mail gravado no campo nome', () => {
    expect(formatPersonName('joao@example.com')).toBe('joao@example.com');
  });

  it('normaliza espaços mesmo sem recaixar', () => {
    expect(formatPersonName('  Ana   Maria  ')).toBe('Ana Maria');
    expect(formatPersonName('  MARIA   JOSE  ')).toBe('Maria Jose');
  });

  it('devolve string vazia para valor ausente', () => {
    expect(formatPersonName(null)).toBe('');
    expect(formatPersonName(undefined)).toBe('');
    expect(formatPersonName('   ')).toBe('');
  });

  it('não mexe em string sem letra', () => {
    expect(formatPersonName('12345')).toBe('12345');
  });
});
