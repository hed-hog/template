import { describe, it, expect } from 'vitest';
import {
  buildFillBlankStatement,
  countFillBlankMarkers,
  hasFillBlankMarkers,
  htmlToPlainText,
  parseFillBlankStatement,
  reconstructFillBlankState,
  renderFillBlankPreview,
  splitStatementSegments,
} from './fill-blank';

describe('hasFillBlankMarkers', () => {
  it('detecta marcadores posicionais', () => {
    expect(hasFillBlankMarkers('Fill [[1]] gap')).toBe(true);
    expect(hasFillBlankMarkers('has [[12]] two digits')).toBe(true);
  });

  it('é falso para texto sem marcadores / vazio / nulo', () => {
    expect(hasFillBlankMarkers('no markers')).toBe(false);
    expect(hasFillBlankMarkers('')).toBe(false);
    expect(hasFillBlankMarkers(null)).toBe(false);
    expect(hasFillBlankMarkers(undefined)).toBe(false);
    expect(hasFillBlankMarkers('[[]]')).toBe(false); // sem dígito
  });
});

describe('countFillBlankMarkers', () => {
  it('conta as ocorrências', () => {
    expect(countFillBlankMarkers('a [[1]] b [[2]] c')).toBe(2);
    expect(countFillBlankMarkers('[[1]] [[1]]')).toBe(2);
    expect(countFillBlankMarkers('none')).toBe(0);
    expect(countFillBlankMarkers(null)).toBe(0);
  });
});

describe('parseFillBlankStatement', () => {
  it('divide texto/lacunas em ordem', () => {
    expect(parseFillBlankStatement('Hello [[1]] world')).toEqual([
      { kind: 'text', text: 'Hello ' },
      { kind: 'blank', index: 1 },
      { kind: 'text', text: ' world' },
    ]);
  });

  it('lacunas adjacentes e no início/fim', () => {
    expect(parseFillBlankStatement('[[1]][[2]]')).toEqual([
      { kind: 'blank', index: 1 },
      { kind: 'blank', index: 2 },
    ]);
    expect(parseFillBlankStatement('[[1]] tail')).toEqual([
      { kind: 'blank', index: 1 },
      { kind: 'text', text: ' tail' },
    ]);
  });

  it('texto puro e vazio/nulo', () => {
    expect(parseFillBlankStatement('plain')).toEqual([{ kind: 'text', text: 'plain' }]);
    expect(parseFillBlankStatement('')).toEqual([]);
    expect(parseFillBlankStatement(null)).toEqual([]);
  });
});

describe('renderFillBlankPreview', () => {
  it('substitui marcadores pelo placeholder padrão', () => {
    expect(renderFillBlankPreview('a [[1]] b [[2]]')).toBe('a _____ b _____');
  });

  it('aceita placeholder customizado e trata nulo', () => {
    expect(renderFillBlankPreview('a [[1]] b', '__')).toBe('a __ b');
    expect(renderFillBlankPreview(null)).toBe('');
  });
});

describe('splitStatementSegments', () => {
  it('texto vazio retorna lista vazia', () => {
    expect(splitStatementSegments('')).toEqual([]);
  });

  it('separa palavras de espaços em branco', () => {
    const segs = splitStatementSegments('hello world');
    expect(segs.map((s) => s.value)).toEqual(['hello', ' ', 'world']);
    expect(segs.filter((s) => s.isWord)).toHaveLength(2);
  });

  it('isola a pontuação de borda mantendo o core', () => {
    const [seg] = splitStatementSegments('null.');
    expect(seg).toMatchObject({ isWord: true, pre: '', core: 'null', post: '.' });
  });

  it('strip de aspas nas duas bordas', () => {
    const [seg] = splitStatementSegments('"hi"');
    expect(seg).toMatchObject({ pre: '"', core: 'hi', post: '"' });
  });

  it('tokens puramente simbólicos permanecem intactos como palavra', () => {
    const [seg] = splitStatementSegments('=>');
    expect(seg).toMatchObject({ isWord: true, core: '=>', pre: '', post: '' });
  });
});

describe('buildFillBlankStatement', () => {
  it('marca a palavra selecionada e coleta a resposta', () => {
    const { statement, blanks } = buildFillBlankStatement('the cat sat', new Set([1]));
    expect(statement).toBe('the [[1]] sat');
    expect(blanks).toEqual([{ answer: 'cat', alternatives: [] }]);
  });

  it('numera múltiplas lacunas na ordem e preserva pontuação de borda', () => {
    const { statement, blanks } = buildFillBlankStatement('the cat.', new Set([0, 1]));
    expect(statement).toBe('[[1]] [[2]].');
    expect(blanks.map((b) => b.answer)).toEqual(['the', 'cat']);
  });

  it('parseia alternativas separadas por vírgula', () => {
    const { blanks } = buildFillBlankStatement(
      'the cat sat',
      new Set([1]),
      new Map([[1, 'feline, kitty']]),
    );
    expect(blanks[0]?.alternatives).toEqual(['feline', 'kitty']);
  });

  it('sem seleção mantém o texto e não gera lacunas', () => {
    const { statement, blanks } = buildFillBlankStatement('the cat sat', new Set());
    expect(statement).toBe('the cat sat');
    expect(blanks).toEqual([]);
  });
});

describe('htmlToPlainText', () => {
  it('remove tags simples', () => {
    expect(htmlToPlainText('<p>Ola mundo</p>')).toBe('Ola mundo');
  });

  it('remove tags aninhadas mantendo o texto', () => {
    expect(
      htmlToPlainText(
        '<p>Em HTML, os atributos <code>id</code> e <code>class</code> ajudam.</p>',
      ),
    ).toBe('Em HTML, os atributos id e class ajudam.');
  });

  it('separa blocos com espaco em vez de colar palavras', () => {
    expect(htmlToPlainText('<p>Primeiro</p><p>Segundo</p>')).toBe('Primeiro Segundo');
    expect(htmlToPlainText('Linha um<br>Linha dois')).toBe('Linha um Linha dois');
  });

  it('decodifica entidades HTML comuns e numericas', () => {
    expect(htmlToPlainText('<p>a &amp; b &lt;c&gt; &nbsp;d&#39;s&nbsp;</p>')).toBe(
      "a & b <c> d's",
    );
  });

  it('mantem texto puro inalterado', () => {
    expect(htmlToPlainText('texto simples sem tags')).toBe('texto simples sem tags');
    expect(htmlToPlainText('')).toBe('');
  });
});

describe('reconstructFillBlankState', () => {
  it('faz round-trip de resposta de palavra única', () => {
    const { text, blankWordIndices, alternativesByWordIndex } = reconstructFillBlankState(
      'the [[1]] sat',
      [{ answer: 'cat', alternatives: [] }],
    );
    expect(text).toBe('the cat sat');
    expect([...blankWordIndices]).toEqual([1]);
    expect(alternativesByWordIndex.get(1)).toBe('');
  });

  it('junta as alternativas com vírgula', () => {
    const { alternativesByWordIndex } = reconstructFillBlankState('a [[1]]', [
      { answer: 'b', alternatives: ['c', 'd'] },
    ]);
    expect(alternativesByWordIndex.get(1)).toBe('c, d');
  });

  it('enunciado legado (sem marcadores) mantém o texto e nada selecionado', () => {
    const { text, blankWordIndices } = reconstructFillBlankState('plain text', []);
    expect(text).toBe('plain text');
    expect(blankWordIndices.size).toBe(0);
  });

  it('enunciado legado salvo como HTML (rich text) chega como texto puro', () => {
    const { text } = reconstructFillBlankState(
      '<p>Em HTML, os atributos <code>id</code> e <code>class</code> ajudam.</p>',
      [],
    );
    expect(text).toBe('Em HTML, os atributos id e class ajudam.');
  });

  it('remove HTML de trechos de texto entre marcadores', () => {
    const { text } = reconstructFillBlankState('<p>the [[1]] sat</p>', [
      { answer: 'cat', alternatives: [] },
    ]);
    expect(text).toBe('the cat sat');
  });

  it('resposta multi-palavra colapsa para a última palavra', () => {
    const { text, blankWordIndices } = reconstructFillBlankState('[[1]] end', [
      { answer: 'two words', alternatives: [] },
    ]);
    expect(text).toBe('two words end');
    // aponta para "words" (índice 1), não para "two"
    expect([...blankWordIndices]).toEqual([1]);
  });
});
