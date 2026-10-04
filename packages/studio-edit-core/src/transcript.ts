import { type Ticks, ticksFromMs } from './time';

/**
 * Transcrição de um microfone no tempo do take.
 *
 * Corrigir uma palavra muda `correctedText`, nunca o tempo nem o áudio: a
 * transcrição é um índice para achar e decidir trechos, não a fala em si.
 */
export interface TranscriptWord {
  id: number;
  start: Ticks;
  end: Ticks;
  text: string;
  correctedText: string | null;
  /** Probabilidade que o modelo devolveu; nunca mostrada como percentual de acerto. */
  confidence: number | null;
}

export interface TranscriptSegment {
  /** Índices em `words`, inclusive. */
  first: number;
  last: number;
  start: Ticks;
  end: Ticks;
  text: string;
}

export function wordText(word: Pick<TranscriptWord, 'text' | 'correctedText'>): string {
  return word.correctedText ?? word.text;
}

const SENTENCE_END = /[.!?…]["')\]]?$/;

/**
 * Agrupa as palavras em frases: quebra na pontuação final, numa pausa maior
 * que `maxGapMs` ou quando a frase passa de `maxWords`. É a unidade que a tela
 * mostra e que o LLM recebe numerada.
 */
export function segmentWords(
  words: TranscriptWord[],
  options: { maxGapMs?: number; maxWords?: number } = {},
): TranscriptSegment[] {
  const maxGap = ticksFromMs(options.maxGapMs ?? 900);
  const maxWords = options.maxWords ?? 40;
  const segments: TranscriptSegment[] = [];
  let first = 0;

  for (let index = 0; index < words.length; index += 1) {
    const word = words[index]!;
    const next = words[index + 1];
    const closes =
      !next ||
      SENTENCE_END.test(wordText(word).trim()) ||
      next.start - word.end > maxGap ||
      index - first + 1 >= maxWords;
    if (closes) {
      const slice = words.slice(first, index + 1);
      segments.push({
        first,
        last: index,
        start: slice[0]!.start,
        end: word.end,
        text: slice.map(wordText).join(' ').replace(/\s+([,.!?;:…])/g, '$1').trim(),
      });
      first = index + 1;
    }
  }
  return segments;
}

/**
 * Leva um intervalo às fronteiras das palavras que ele toca: nunca começa nem
 * termina no meio de uma palavra. Sem palavra no intervalo, devolve como veio.
 */
export function snapRangeToWords(
  words: TranscriptWord[],
  start: Ticks,
  end: Ticks,
): { start: Ticks; end: Ticks } {
  const touched = words.filter((word) => word.end > start && word.start < end);
  if (touched.length === 0) return { start, end };
  return {
    start: Math.min(start, touched[0]!.start),
    end: Math.max(end, touched[touched.length - 1]!.end),
  };
}

export function wordsInRange(words: TranscriptWord[], start: Ticks, end: Ticks): TranscriptWord[] {
  return words.filter((word) => word.end > start && word.start < end);
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Procura uma palavra ou expressão, sem diferenciar acento nem maiúscula.
 * Devolve o intervalo de palavras de cada ocorrência.
 */
export function searchTranscript(
  words: TranscriptWord[],
  query: string,
): Array<{ first: number; last: number; start: Ticks; end: Ticks }> {
  const terms = normalize(query).split(' ').filter(Boolean);
  if (terms.length === 0) return [];
  const normalized = words.map((word) => normalize(wordText(word)));
  const hits: Array<{ first: number; last: number; start: Ticks; end: Ticks }> = [];

  for (let index = 0; index + terms.length <= words.length; index += 1) {
    const matches = terms.every((term, offset) => {
      const candidate = normalized[index + offset]!;
      return offset === terms.length - 1 ? candidate.startsWith(term) : candidate === term;
    });
    if (matches) {
      const last = index + terms.length - 1;
      hits.push({ first: index, last, start: words[index]!.start, end: words[last]!.end });
    }
  }
  return hits;
}
