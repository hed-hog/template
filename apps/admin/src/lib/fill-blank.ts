/**
 * Fill-blank (lacuna) statement helpers.
 *
 * A fill-blank statement stores its gaps as positional markers `[[1]]`, `[[2]]`, …
 * (1-based, in reading order). The marker does NOT carry the answer — the expected
 * answers live separately (ordered), so the statement is safe to send to the student.
 *
 * These helpers are shared by the admin editor, the exam attempt screen and any
 * preview. They are pure (no React) so they can be reused anywhere.
 */

export type FillBlankPart =
  | { kind: 'text'; text: string }
  | { kind: 'blank'; index: number }; // index is 1-based

export type FillBlankAnswer = { answer: string; alternatives: string[] };

const MARKER_GLOBAL = /\[\[(\d+)\]\]/g;
const MARKER_TEST = /\[\[\d+\]\]/;

/** True when the statement already uses positional gap markers. */
export function hasFillBlankMarkers(statement: string | null | undefined): boolean {
  return MARKER_TEST.test(statement ?? '');
}

/** Number of positional gap markers in the statement. */
export function countFillBlankMarkers(statement: string | null | undefined): number {
  const matches = (statement ?? '').match(MARKER_GLOBAL);
  return matches ? matches.length : 0;
}

/** Splits a statement into ordered text / blank parts for rendering. */
export function parseFillBlankStatement(
  statement: string | null | undefined,
): FillBlankPart[] {
  const value = statement ?? '';
  const parts: FillBlankPart[] = [];
  let lastIndex = 0;
  const re = new RegExp(MARKER_GLOBAL);
  let match: RegExpExecArray | null;

  while ((match = re.exec(value)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ kind: 'text', text: value.slice(lastIndex, match.index) });
    }
    parts.push({ kind: 'blank', index: Number(match[1]) });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < value.length) {
    parts.push({ kind: 'text', text: value.slice(lastIndex) });
  }

  return parts;
}

/** Replaces gap markers with a visible blank (for plain-text previews). */
export function renderFillBlankPreview(
  statement: string | null | undefined,
  blank = '_____',
): string {
  return (statement ?? '').replace(MARKER_GLOBAL, blank);
}

// ── Word tokenization (for the "click words to make a gap" editor) ──────────────

export type StatementSegment = {
  /** Raw segment text (word or whitespace run). */
  value: string;
  /** Whether this segment is a selectable word (has a letter/number core). */
  isWord: boolean;
  /** Leading punctuation kept outside the gap. */
  pre: string;
  /** The word core that becomes the gap answer. */
  core: string;
  /** Trailing punctuation kept outside the gap. */
  post: string;
};

// Sentence punctuation stripped from a word's edges (kept outside the gap).
// Operator characters (-, >, =, &, |, etc.) are intentionally NOT here, so
// tokens like "?->", "=>" or "&&" stay intact and can become gaps.
const EDGE_PUNCT = /[.,;:!?¿¡…"'«»(){}[\]‘’“”]/;
// Has at least one letter or digit.
const HAS_ALNUM = /[\p{L}\p{N}]/u;

/** Splits plain text into word / whitespace segments, isolating each word's core. */
export function splitStatementSegments(text: string): StatementSegment[] {
  if (!text) return [];
  return text.split(/(\s+)/).map((value) => {
    if (value.length === 0 || /^\s+$/.test(value)) {
      return { value, isWord: false, pre: '', core: '', post: '' };
    }
    // Purely symbolic tokens (operators like ?->, =>, &&) are selectable as-is.
    if (!HAS_ALNUM.test(value)) {
      return { value, isWord: true, pre: '', core: value, post: '' };
    }
    // Otherwise strip only leading/trailing sentence punctuation, keeping inner
    // operators (e.g. "null." → core "null"; "x?->y" → core "x?->y").
    let start = 0;
    let end = value.length;
    while (start < end && EDGE_PUNCT.test(value.charAt(start))) start += 1;
    while (end > start && EDGE_PUNCT.test(value.charAt(end - 1))) end -= 1;
    const pre = value.slice(0, start);
    const core = value.slice(start, end);
    const post = value.slice(end);
    return { value, isWord: core.length > 0, pre, core, post };
  });
}

// ── HTML → plain text (rich-text statements pasted/switched into fill-blank) ────

const LOOKS_LIKE_HTML = /<\/?[a-z][\s\S]*>/i;
const BLOCK_BREAK_TAGS = /<\/(p|div|li|h[1-6]|blockquote|tr)>|<br\s*\/?>/gi;
const ANY_TAG = /<[^>]+>/g;
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&([a-z]+);/gi, (entity, name) => NAMED_ENTITIES[name.toLowerCase()] ?? entity);
}

/** Converts rich-text HTML (e.g. from the statement's WYSIWYG editor) into plain text. */
export function htmlToPlainText(value: string): string {
  if (!value || !LOOKS_LIKE_HTML.test(value)) return value ?? '';
  return decodeHtmlEntities(
    value.replace(BLOCK_BREAK_TAGS, ' ').replace(ANY_TAG, ''),
  )
    .replace(/\s+/g, ' ')
    .trim();
}

function splitAlternatives(text: string): string[] {
  return text
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

/**
 * Builds the stored statement (with `[[n]]` markers) plus the ordered answers,
 * from the plain sentence + the set of word indices marked as gaps.
 */
export function buildFillBlankStatement(
  text: string,
  blankWordIndices: Set<number>,
  alternativesByWordIndex: Map<number, string> = new Map(),
): { statement: string; blanks: FillBlankAnswer[] } {
  const segments = splitStatementSegments(text);
  const blanks: FillBlankAnswer[] = [];
  let wordIndex = -1;
  let blankNumber = 0;

  const statement = segments
    .map((segment) => {
      if (!segment.isWord) return segment.value;
      wordIndex += 1;
      if (!blankWordIndices.has(wordIndex)) return segment.value;

      blankNumber += 1;
      blanks.push({
        answer: segment.core,
        alternatives: splitAlternatives(alternativesByWordIndex.get(wordIndex) ?? ''),
      });
      return `${segment.pre}[[${blankNumber}]]${segment.post}`;
    })
    .join('');

  return { statement, blanks };
}

/** Counts the word segments inside a plain-text string. */
function countWords(text: string): number {
  return splitStatementSegments(text).filter((segment) => segment.isWord).length;
}

/**
 * Reconstructs the editor working state (plain sentence + which word indices are
 * gaps + per-gap alternatives) from a stored statement + ordered answers.
 *
 * Single-word answers round-trip exactly; a multi-word answer collapses to its
 * last word (v1 limitation — gaps are single words).
 */
export function reconstructFillBlankState(
  statement: string | null | undefined,
  blanks: FillBlankAnswer[],
): { text: string; blankWordIndices: Set<number>; alternativesByWordIndex: Map<number, string> } {
  const blankWordIndices = new Set<number>();
  const alternativesByWordIndex = new Map<number, string>();

  // A statement saved from a rich-text editor (e.g. after switching question
  // types, or a legacy question authored before this editor existed) may still
  // carry HTML markup; strip it once, up front, before it reaches the
  // plain-text tokenizer. Markers (`[[n]]`) are plain text and survive intact.
  const cleanStatement = htmlToPlainText(statement ?? '');

  if (!hasFillBlankMarkers(cleanStatement)) {
    // Legacy question (no markers): keep the text as-is, nothing pre-selected.
    return { text: cleanStatement, blankWordIndices, alternativesByWordIndex };
  }

  const parts = parseFillBlankStatement(cleanStatement);
  let text = '';

  for (const part of parts) {
    if (part.kind === 'text') {
      text += part.text;
      continue;
    }
    const answer = blanks[part.index - 1]?.answer ?? '';
    text += answer;
    const wordIndex = countWords(text) - 1;
    if (wordIndex >= 0) {
      blankWordIndices.add(wordIndex);
      alternativesByWordIndex.set(
        wordIndex,
        (blanks[part.index - 1]?.alternatives ?? []).join(', '),
      );
    }
  }

  return { text, blankWordIndices, alternativesByWordIndex };
}
