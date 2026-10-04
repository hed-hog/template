import { describe, expect, it } from 'vitest';

import { applyCommand, type Decision, replay } from './commands';
import { createDocument, segmentsOfTake } from './document';
import { ticksFromMs } from './time';
import { searchTranscript, segmentWords, snapRangeToWords, type TranscriptWord } from './transcript';

const ms = ticksFromMs;

function words(list: Array<[string, number, number]>): TranscriptWord[] {
  return list.map(([text, start, end], index) => ({
    id: index + 1,
    start: ms(start),
    end: ms(end),
    text,
    correctedText: null,
    confidence: null,
  }));
}

const sample = words([
  ['Vamos', 0, 300],
  ['criar', 320, 600],
  ['o', 620, 700],
  ['componente.', 720, 1200],
  ['Então', 3000, 3300],
  ['instale', 3320, 3700],
  ['o', 3720, 3800],
  ['Prisma', 3820, 4300],
]);

describe('segmentWords', () => {
  it('quebra na pontuação final e em pausa longa', () => {
    const segments = segmentWords(sample);
    expect(segments.map((segment) => segment.text)).toEqual(['Vamos criar o componente.', 'Então instale o Prisma']);
    expect(segments[1]).toMatchObject({ first: 4, last: 7, start: ms(3000), end: ms(4300) });
  });

  it('usa o texto corrigido sem mexer no tempo', () => {
    const corrected = sample.map((word) => (word.text === 'Prisma' ? { ...word, correctedText: 'Prisma ORM' } : word));
    expect(segmentWords(corrected)[1]!.text).toBe('Então instale o Prisma ORM');
    expect(segmentWords(corrected)[1]!.end).toBe(ms(4300));
  });
});

describe('snapRangeToWords', () => {
  it('nunca corta no meio de uma palavra', () => {
    expect(snapRangeToWords(sample, ms(400), ms(3500))).toEqual({ start: ms(320), end: ms(3700) });
    expect(snapRangeToWords(sample, ms(1500), ms(2500))).toEqual({ start: ms(1500), end: ms(2500) });
  });
});

describe('searchTranscript', () => {
  it('acha expressão sem diferenciar acento e maiúscula', () => {
    expect(searchTranscript(sample, 'entao INSTALE')).toEqual([{ first: 4, last: 5, start: ms(3000), end: ms(3700) }]);
    expect(searchTranscript(sample, 'compo')).toHaveLength(1);
    expect(searchTranscript(sample, '  ')).toEqual([]);
  });
});

describe('adiar sugestão', () => {
  const base = createDocument([{ takeId: 1, start: 0, end: ms(60_000) }], [1]);
  const approve: Decision['command'] = {
    type: 'approveSuggestion',
    suggestionId: 7,
    takeId: 1,
    start: ms(1000),
    end: ms(2000),
    state: 'remove',
    modified: false,
  };

  it('adiada continua aberta: aprovar depois substitui a revisão', () => {
    let doc = applyCommand(base, { decisionId: 'd1', command: { type: 'deferSuggestion', suggestionId: 7 } });
    expect(doc.reviews).toEqual([{ suggestionId: 7, status: 'deferred', modified: false, decisionId: 'd1' }]);
    expect(segmentsOfTake(doc, 1)).toHaveLength(1);

    doc = applyCommand(doc, { decisionId: 'd2', command: approve });
    expect(doc.reviews).toEqual([{ suggestionId: 7, status: 'approved', modified: false, decisionId: 'd2' }]);
    expect(() => applyCommand(doc, { decisionId: 'd3', command: { type: 'deferSuggestion', suggestionId: 7 } })).toThrow(
      /already reviewed/,
    );
  });

  it('desfazer a aprovação de uma adiada volta a adiada', () => {
    const decisions: Decision[] = [
      { decisionId: 'd1', command: { type: 'deferSuggestion', suggestionId: 7 } },
      { decisionId: 'd2', command: approve },
      { decisionId: 'd3', command: { type: 'undo', decisionId: 'd2' } },
    ];
    expect(replay(base, decisions).document.reviews).toEqual([
      { suggestionId: 7, status: 'deferred', modified: false, decisionId: 'd1' },
    ]);
  });
});
