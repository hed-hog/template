import { describe, expect, it } from 'vitest';

import { formatBytes } from './format-bytes';

describe('formatBytes', () => {
  it('usa a unidade que cabe no valor', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(1_048_576)).toBe('1 MB');
    expect(formatBytes(1_073_741_824)).toBe('1 GB');
  });

  // Uma casa só onde ela diferencia: 1 MB e 1,4 MB sao arquivos diferentes,
  // 1 KB e 1,5 KB nao mudam nada ao lado de um nome de anexo.
  it('mostra decimal a partir de MB, e so abaixo de 10', () => {
    expect(formatBytes(1_468_006)).toBe('1.4 MB');
    expect(formatBytes(52_428_800)).toBe('50 MB');
    expect(formatBytes(1536)).toBe('2 KB');
  });

  // `size` chega 0 para anexo antigo gravado antes da coluna existir.
  it('devolve 0 B para valor ausente ou invalido', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(null)).toBe('0 B');
    expect(formatBytes(undefined)).toBe('0 B');
    expect(formatBytes(-1)).toBe('0 B');
    expect(formatBytes(Number.NaN)).toBe('0 B');
  });

  // Sem o teto, um valor absurdo cairia num indice inexistente da tabela.
  it('para na maior unidade conhecida', () => {
    expect(formatBytes(Math.pow(1024, 6))).toContain('TB');
  });
});
