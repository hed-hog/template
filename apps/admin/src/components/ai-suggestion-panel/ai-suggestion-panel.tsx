'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronDown,
  ChevronUp,
  PencilLine,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Wand2,
} from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';

export type AiSuggestionPanelStatus =
  | 'pending'
  | 'ready'
  | 'failed'
  | 'discarded'
  | 'used';

export type AiSuggestionPanelFeedback = 'helpful' | 'not_helpful';

/** O rascunho, ja no formato do painel (cada modulo adapta o seu). */
export type AiSuggestionPanelSuggestion = {
  id: number | string;
  status: AiSuggestionPanelStatus;
  /** Texto puro do rascunho. */
  text: string | null;
  error?: string | null;
  feedback?: AiSuggestionPanelFeedback | null;
  model?: string | null;
  /** `auto`: a IA gerou sozinha quando o item chegou. */
  origin?: 'auto' | 'manual' | null;
};

/** Textos do painel: vem do i18n de quem usa, o painel nao tem namespace. */
export type AiSuggestionPanelLabels = {
  title: string;
  emptyHint: string;
  generate: string;
  refine: string;
  refinePlaceholder: string;
  send: string;
  /** "Editar" (inline ou no compositor, conforme `onUseInComposer`). */
  edit: string;
  /** Fecha a edicao inline. */
  editDone?: string;
  discard: string;
  helpful: string;
  notHelpful: string;
  expand: string;
  collapse: string;
  /** Mensagem quando o rascunho falhou e nao veio `error`. */
  failed: string;
  /** Selo do rascunho gerado sozinho. */
  autoBadge?: string;
  model?: (model: string) => string;
  /** "123/2200". Sem ela o contador mostra so os numeros. */
  counter?: (count: number, max: number) => string;
  overLimit?: string;
};

export type AiSuggestionPanelProps = {
  suggestion: AiSuggestionPanelSuggestion | null | undefined;
  labels: AiSuggestionPanelLabels;
  loading?: boolean;
  /** Limite de caracteres do destino (a rede, o canal...). */
  maxLength?: number | null;
  /** Sem permissao para agir: o rascunho aparece, as acoes nao. */
  readOnly?: boolean;
  /** Linha extra no estado vazio (ex.: "a IA esta desligada"). */
  notice?: ReactNode;
  onGenerate?: () => Promise<unknown>;
  onRefine?: (instruction: string, currentDraft: string) => Promise<unknown>;
  /** Recebe o texto como esta no painel (editado ou nao). */
  onSend?: (text: string) => Promise<unknown>;
  /**
   * Leva o rascunho para o compositor de quem usa. Sem ela, "Editar" abre a
   * edicao no proprio painel.
   */
  onUseInComposer?: (text: string) => void;
  /** `null` desfaz o voto (clicar de novo no mesmo polegar). */
  onFeedback?: (feedback: AiSuggestionPanelFeedback | null) => Promise<unknown>;
  onDiscard?: () => Promise<unknown>;
  className?: string;
};

type Busy = 'generate' | 'refine' | 'send' | 'discard' | 'feedback' | null;

/** Rascunho que ainda pode ser usado: os demais contam como "sem rascunho". */
export function isUsableSuggestion(
  suggestion: AiSuggestionPanelSuggestion | null | undefined
): suggestion is AiSuggestionPanelSuggestion {
  return (
    !!suggestion &&
    suggestion.status !== 'discarded' &&
    suggestion.status !== 'used'
  );
}

/**
 * Rascunho de resposta da IA, em texto puro, generico: quem usa passa os
 * textos e as acoes. Tres saidas, todas de quem atende — **enviar**,
 * **refinar** com uma instrucao, ou **editar** (no painel ou no compositor).
 * A IA nunca envia sozinha.
 *
 * Os handlers reportam o proprio erro (toast); o painel so segura o estado de
 * carregando e engole a rejeicao para nao virar erro nao tratado.
 */
export function AiSuggestionPanel({
  suggestion,
  labels,
  loading = false,
  maxLength,
  readOnly = false,
  notice,
  onGenerate,
  onRefine,
  onSend,
  onUseInComposer,
  onFeedback,
  onDiscard,
  className,
}: AiSuggestionPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [instruction, setInstruction] = useState('');
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(suggestion?.text ?? '');
  const [busy, setBusy] = useState<Busy>(null);

  // Rascunho novo (gerado, refinado ou de outro item) substitui a edicao.
  const suggestionId = suggestion?.id;
  const suggestionText = suggestion?.text ?? '';
  useEffect(() => {
    setDraft(suggestionText);
    setEditing(false);
  }, [suggestionId, suggestionText]);

  const run = async (
    kind: Exclude<Busy, null>,
    action: () => Promise<unknown>
  ) => {
    setBusy(kind);
    try {
      await action();
      return true;
    } catch {
      // O handler ja avisou quem esta atendendo.
      return false;
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return <Skeleton className={cn('h-24 w-full', className)} />;
  }

  if (!isUsableSuggestion(suggestion)) {
    return (
      <div
        className={cn(
          'flex flex-col gap-2 rounded-lg border border-dashed px-3 py-2 sm:flex-row sm:items-center sm:justify-between',
          className
        )}
        data-testid="ai-suggestion-empty"
      >
        <div className="min-w-0 space-y-0.5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 shrink-0 text-violet-600" />
            {labels.emptyHint}
          </p>
          {notice ? (
            <div className="text-xs text-muted-foreground">{notice}</div>
          ) : null}
        </div>
        {!readOnly && onGenerate ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            loading={busy === 'generate'}
            disabled={busy !== null}
            onClick={() => run('generate', onGenerate)}
          >
            <Sparkles className="size-4" />
            {labels.generate}
          </Button>
        ) : null}
      </div>
    );
  }

  const pending = suggestion.status === 'pending';
  const failed = suggestion.status === 'failed';
  const isWorking = pending || busy !== null;
  const text = draft;
  const count = text.length;
  const overLimit = !!maxLength && count > maxLength;
  const canSend = !readOnly && !!onSend && !!text.trim() && !overLimit;

  const toggleFeedback = (value: AiSuggestionPanelFeedback) =>
    onFeedback
      ? run('feedback', () =>
          onFeedback(suggestion.feedback === value ? null : value)
        )
      : undefined;

  const refine = () => {
    const value = instruction.trim();
    if (!value || !onRefine) return undefined;
    return run('refine', () => onRefine(value, text)).then((ok) => {
      if (ok) setInstruction('');
    });
  };

  return (
    <div
      className={cn('rounded-lg border bg-muted/30', className)}
      data-testid="ai-suggestion-panel"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="size-4 shrink-0 text-violet-600" />
          <span className="truncate text-sm font-medium">{labels.title}</span>
          {suggestion.origin === 'auto' && labels.autoBadge ? (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {labels.autoBadge}
            </Badge>
          ) : null}
          {pending ? (
            <Spinner className="size-3.5 text-muted-foreground" />
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          {onFeedback && !readOnly && !failed && !pending ? (
            <>
              <Button
                variant="ghost"
                size="icon-sm"
                tooltip={labels.helpful}
                aria-pressed={suggestion.feedback === 'helpful'}
                className={cn(
                  suggestion.feedback === 'helpful' && 'text-green-600'
                )}
                disabled={busy !== null && busy !== 'feedback'}
                onClick={() => toggleFeedback('helpful')}
              >
                <ThumbsUp className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                tooltip={labels.notHelpful}
                aria-pressed={suggestion.feedback === 'not_helpful'}
                className={cn(
                  suggestion.feedback === 'not_helpful' && 'text-red-600'
                )}
                disabled={busy !== null && busy !== 'feedback'}
                onClick={() => toggleFeedback('not_helpful')}
              >
                <ThumbsDown className="size-3.5" />
              </Button>
            </>
          ) : null}
          <Button
            variant="ghost"
            size="icon-sm"
            tooltip={collapsed ? labels.expand : labels.collapse}
            onClick={() => setCollapsed((value) => !value)}
          >
            {collapsed ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronUp className="size-4" />
            )}
          </Button>
        </div>
      </div>

      {collapsed ? null : (
        <div className="space-y-2 border-t px-3 py-2">
          {failed ? (
            <p className="text-sm text-destructive" role="alert">
              {suggestion.error || labels.failed}
            </p>
          ) : pending ? (
            <Skeleton className="h-16 w-full" />
          ) : editing ? (
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={labels.edit}
              className="max-h-60 min-h-24 text-sm"
              autoFocus
            />
          ) : (
            <p
              className="max-h-32 overflow-y-auto whitespace-pre-wrap text-sm wrap-anywhere md:max-h-48"
              data-testid="ai-suggestion-text"
            >
              {text}
            </p>
          )}

          {!failed && !pending && maxLength ? (
            <p
              className={cn(
                'text-right text-xs tabular-nums',
                overLimit
                  ? 'font-medium text-destructive'
                  : 'text-muted-foreground'
              )}
              data-testid="ai-suggestion-counter"
            >
              {labels.counter
                ? labels.counter(count, maxLength)
                : `${count}/${maxLength}`}
              {overLimit && labels.overLimit ? ` · ${labels.overLimit}` : null}
            </p>
          ) : null}

          {readOnly ? null : (
            <>
              {onRefine && !failed ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={instruction}
                    onChange={(event) => setInstruction(event.target.value)}
                    placeholder={labels.refinePlaceholder}
                    aria-label={labels.refinePlaceholder}
                    maxLength={500}
                    disabled={isWorking}
                    className="h-8 text-xs"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && instruction.trim()) {
                        event.preventDefault();
                        void refine();
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    loading={busy === 'refine'}
                    disabled={isWorking || !instruction.trim()}
                    onClick={refine}
                  >
                    <Wand2 className="size-4" />
                    {labels.refine}
                  </Button>
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {suggestion.model && labels.model
                    ? labels.model(suggestion.model)
                    : null}
                </p>

                <div className="flex flex-wrap items-center gap-2">
                  {onDiscard ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      loading={busy === 'discard'}
                      disabled={isWorking}
                      onClick={() => run('discard', onDiscard)}
                    >
                      <Trash2 className="size-4" />
                      {labels.discard}
                    </Button>
                  ) : null}

                  {failed && onGenerate ? (
                    <Button
                      size="sm"
                      variant="outline"
                      loading={busy === 'generate'}
                      disabled={isWorking}
                      onClick={() => run('generate', onGenerate)}
                    >
                      <Sparkles className="size-4" />
                      {labels.generate}
                    </Button>
                  ) : null}

                  {!failed ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isWorking || !text.trim()}
                      onClick={() =>
                        onUseInComposer
                          ? onUseInComposer(text)
                          : setEditing((value) => !value)
                      }
                    >
                      {editing ? (
                        <Check className="size-4" />
                      ) : (
                        <PencilLine className="size-4" />
                      )}
                      {editing ? (labels.editDone ?? labels.edit) : labels.edit}
                    </Button>
                  ) : null}

                  {!failed && onSend ? (
                    <Button
                      size="sm"
                      loading={busy === 'send'}
                      disabled={isWorking || !canSend}
                      onClick={() => run('send', () => onSend(text))}
                    >
                      <Send className="size-4" />
                      {labels.send}
                    </Button>
                  ) : null}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
