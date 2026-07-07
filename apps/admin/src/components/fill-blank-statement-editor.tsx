'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  buildFillBlankStatement,
  reconstructFillBlankState,
  splitStatementSegments,
  type FillBlankAnswer,
} from '@/lib/fill-blank';
import { X } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface FillBlankStatementEditorLabels {
  sentence: string;
  sentencePlaceholder: string;
  hint: string;
  blanksTitle: string;
  empty: string;
  alternativesPlaceholder: string;
  blankWord: (n: number) => string;
  removeBlank: string;
  extraWordsTitle: string;
  extraWordsHint: string;
  extraWordsPlaceholder: string;
  addWord: string;
  removeWord: string;
}

const DEFAULT_LABELS: FillBlankStatementEditorLabels = {
  sentence: 'Frase',
  sentencePlaceholder: 'Digite a frase completa…',
  hint: 'Clique nas palavras para transformá-las em lacunas.',
  blanksTitle: 'Lacunas',
  empty: 'Nenhuma lacuna marcada ainda. Clique nas palavras acima.',
  alternativesPlaceholder: 'Outras respostas aceitas (separadas por vírgula)',
  blankWord: (n) => `Lacuna ${n}`,
  removeBlank: 'Remover lacuna',
  extraWordsTitle: 'Palavras extras no banco',
  extraWordsHint: 'Palavras que aparecem no banco de palavras do aluno sem serem a resposta de nenhuma lacuna.',
  extraWordsPlaceholder: 'Digite uma palavra e pressione Enter (separe várias por vírgula)',
  addWord: 'Adicionar',
  removeWord: 'Remover palavra',
};

interface FillBlankStatementEditorProps {
  statement: string;
  blanks: FillBlankAnswer[];
  extraWords: string[];
  onChange: (next: { statement: string; blanks: FillBlankAnswer[]; extraWords: string[] }) => void;
  labels?: Partial<FillBlankStatementEditorLabels>;
}

/**
 * Editor for fill-blank (lacuna) statements: the author types the full sentence and
 * clicks the words that should become gaps. Each selected word is the expected answer
 * and may have optional accepted alternatives. Emits the stored statement (with `[[n]]`
 * markers) plus the ordered answers.
 */
export function FillBlankStatementEditor({
  statement,
  blanks,
  extraWords,
  onChange,
  labels: labelOverrides,
}: FillBlankStatementEditorProps) {
  const labels = { ...DEFAULT_LABELS, ...labelOverrides };

  const initial = useMemo(
    () => reconstructFillBlankState(statement, blanks),
    // Initialise once per mount; the sheet remounts per question.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [text, setText] = useState(initial.text);
  const [blankIndices, setBlankIndices] = useState<Set<number>>(
    initial.blankWordIndices,
  );
  const [alternatives, setAlternatives] = useState<Map<number, string>>(
    initial.alternativesByWordIndex,
  );
  const [extraWordList, setExtraWordList] = useState<string[]>(extraWords);
  const [extraWordInput, setExtraWordInput] = useState('');

  const segments = useMemo(() => splitStatementSegments(text), [text]);

  // Selected gaps in reading order, with their word index + current core word.
  const selectedBlanks = useMemo(() => {
    const result: { wordIndex: number; core: string }[] = [];
    let wordIndex = -1;
    for (const segment of segments) {
      if (!segment.isWord) continue;
      wordIndex += 1;
      if (blankIndices.has(wordIndex)) {
        result.push({ wordIndex, core: segment.core });
      }
    }
    return result;
  }, [segments, blankIndices]);

  function emit(
    nextText: string,
    nextIndices: Set<number>,
    nextAlternatives: Map<number, string>,
    nextExtraWords: string[],
  ) {
    onChange({
      ...buildFillBlankStatement(nextText, nextIndices, nextAlternatives),
      extraWords: nextExtraWords,
    });
  }

  function handleTextChange(value: string) {
    setText(value);
    // Drop selections/alternatives that fall outside the new word count.
    const wordCount = splitStatementSegments(value).filter((s) => s.isWord).length;
    const nextIndices = new Set(
      [...blankIndices].filter((index) => index < wordCount),
    );
    const nextAlternatives = new Map(
      [...alternatives].filter(([index]) => index < wordCount),
    );
    setBlankIndices(nextIndices);
    setAlternatives(nextAlternatives);
    emit(value, nextIndices, nextAlternatives, extraWordList);
  }

  function toggleBlank(wordIndex: number) {
    const nextIndices = new Set(blankIndices);
    const nextAlternatives = new Map(alternatives);
    if (nextIndices.has(wordIndex)) {
      nextIndices.delete(wordIndex);
      nextAlternatives.delete(wordIndex);
    } else {
      nextIndices.add(wordIndex);
    }
    setBlankIndices(nextIndices);
    setAlternatives(nextAlternatives);
    emit(text, nextIndices, nextAlternatives, extraWordList);
  }

  function updateAlternatives(wordIndex: number, value: string) {
    const nextAlternatives = new Map(alternatives);
    nextAlternatives.set(wordIndex, value);
    setAlternatives(nextAlternatives);
    emit(text, blankIndices, nextAlternatives, extraWordList);
  }

  function addExtraWords(raw: string) {
    const candidates = raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    if (candidates.length === 0) return;

    const existing = new Set(extraWordList.map((word) => word.toLowerCase()));
    const nextExtraWords = [...extraWordList];
    for (const candidate of candidates) {
      const key = candidate.toLowerCase();
      if (existing.has(key)) continue;
      existing.add(key);
      nextExtraWords.push(candidate);
    }

    setExtraWordList(nextExtraWords);
    setExtraWordInput('');
    emit(text, blankIndices, alternatives, nextExtraWords);
  }

  function removeExtraWord(word: string) {
    const nextExtraWords = extraWordList.filter((item) => item !== word);
    setExtraWordList(nextExtraWords);
    emit(text, blankIndices, alternatives, nextExtraWords);
  }

  // Render the clickable words; assign a stable word index as we go.
  let runningWordIndex = -1;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="text-sm font-medium">{labels.sentence}</p>
        <Textarea
          value={text}
          onChange={(event) => handleTextChange(event.target.value)}
          placeholder={labels.sentencePlaceholder}
          rows={3}
        />
        <p className="text-xs text-muted-foreground">{labels.hint}</p>
      </div>

      {text.trim().length > 0 && (
        <div className="flex flex-wrap gap-x-1 gap-y-1.5 rounded-lg border bg-muted/20 p-3 text-sm leading-relaxed">
          {segments.map((segment, segmentIndex) => {
            if (!segment.isWord) {
              if (/^\s+$/.test(segment.value)) {
                return <span key={segmentIndex}>{' '}</span>;
              }
              return <span key={segmentIndex}>{segment.value}</span>;
            }
            runningWordIndex += 1;
            const wordIndex = runningWordIndex;
            const isBlank = blankIndices.has(wordIndex);
            return (
              <button
                key={segmentIndex}
                type="button"
                onClick={() => toggleBlank(wordIndex)}
                className={cn(
                  'rounded px-1 transition-colors',
                  isBlank
                    ? 'bg-amber-500/20 text-amber-700 underline decoration-dashed underline-offset-4 dark:text-amber-300'
                    : 'hover:bg-foreground/10',
                )}
              >
                {segment.value}
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {labels.blanksTitle}
          {selectedBlanks.length > 0 && ` (${selectedBlanks.length})`}
        </p>
        {selectedBlanks.length === 0 ? (
          <p className="py-1 text-xs text-muted-foreground">{labels.empty}</p>
        ) : (
          <div className="space-y-2">
            {selectedBlanks.map((blank, position) => (
              <div
                key={blank.wordIndex}
                className="space-y-2 rounded-lg border bg-background p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium">
                    {labels.blankWord(position + 1)}
                    <span className="ml-1.5 rounded bg-amber-500/15 px-1.5 py-0.5 font-semibold text-amber-700 dark:text-amber-300">
                      {blank.core}
                    </span>
                  </p>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-6 shrink-0"
                    onClick={() => toggleBlank(blank.wordIndex)}
                    aria-label={labels.removeBlank}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
                <Input
                  value={alternatives.get(blank.wordIndex) ?? ''}
                  onChange={(event) =>
                    updateAlternatives(blank.wordIndex, event.target.value)
                  }
                  placeholder={labels.alternativesPlaceholder}
                  className="h-8 text-sm"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {labels.extraWordsTitle}
          {extraWordList.length > 0 && ` (${extraWordList.length})`}
        </p>
        <p className="text-xs text-muted-foreground">{labels.extraWordsHint}</p>
        <div className="flex gap-2">
          <Input
            value={extraWordInput}
            onChange={(event) => setExtraWordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              addExtraWords(extraWordInput);
            }}
            placeholder={labels.extraWordsPlaceholder}
            className="h-8 text-sm"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            onClick={() => addExtraWords(extraWordInput)}
          >
            {labels.addWord}
          </Button>
        </div>
        {extraWordList.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {extraWordList.map((word) => (
              <span
                key={word}
                className="flex items-center gap-1 rounded-full bg-sky-500/15 py-0.5 pl-2.5 pr-1 text-xs font-medium text-sky-700 dark:text-sky-300"
              >
                {word}
                <button
                  type="button"
                  onClick={() => removeExtraWord(word)}
                  aria-label={labels.removeWord}
                  className="rounded-full p-0.5 hover:bg-sky-500/20"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
