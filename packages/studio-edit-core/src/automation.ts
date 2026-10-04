import type { ReviewSuggestion, SuggestionKind } from './contracts';

/**
 * Modos de automação da revisão.
 *
 * - `manual`: toda decisão relevante é de uma pessoa.
 * - `quick`: nada é aprovado sozinho; a fila começa pelos casos de maior risco.
 * - `controlled`: sugestões de categorias autorizadas, até o risco autorizado,
 *   são aprovadas pelo servidor — registradas com a política, reversíveis, com
 *   uma amostra marcada para conferência e checagem final antes de aprovar a
 *   revisão.
 */
export type AutomationMode = 'manual' | 'quick' | 'controlled';

export type Risk = 'low' | 'medium' | 'high';

export interface AutomationRule {
  kind: SuggestionKind;
  maxRisk: Risk;
}

export interface AutomationPolicy {
  mode: AutomationMode;
  rules: AutomationRule[];
  /** Porcentagem das aprovações automáticas marcada para conferência humana. */
  samplePct: number;
}

const RISK_ORDER: Record<Risk, number> = { low: 0, medium: 1, high: 2 };
const KINDS: SuggestionKind[] = [
  'pauses',
  'restart',
  'repetition',
  'alternative',
  'offtopic',
  'manual',
  'direction',
  'visual',
];

/** Lê `pauses:low, direction:medium` — tipo e risco máximo autorizados. */
export function parseAutomationRules(text: string): AutomationRule[] {
  const rules: AutomationRule[] = [];
  for (const part of String(text ?? '').split(/[,;\s]+/)) {
    const [kind, risk] = part.split(':').map((value) => value.trim().toLowerCase());
    if (!kind || !(KINDS as string[]).includes(kind)) continue;
    // Proposta manual é de uma pessoa para outra: nunca aprovada pela máquina.
    if (kind === 'manual') continue;
    const maxRisk = (['low', 'medium', 'high'] as string[]).includes(risk ?? '') ? (risk as Risk) : 'low';
    rules.push({ kind: kind as SuggestionKind, maxRisk });
  }
  return rules;
}

/** A sugestão pode ser aprovada pela política, sem ninguém? */
export function isAutoApprovable(
  suggestion: Pick<ReviewSuggestion, 'kind' | 'risk' | 'status' | 'origin'>,
  policy: AutomationPolicy,
): boolean {
  if (policy.mode !== 'controlled' || suggestion.status !== 'pending' || suggestion.origin === 'manual') return false;
  return policy.rules.some(
    (rule) => rule.kind === suggestion.kind && RISK_ORDER[suggestion.risk] <= RISK_ORDER[rule.maxRisk],
  );
}

/**
 * Escolhe, de forma determinística, quais aprovações automáticas vão para a
 * conferência humana: a mesma lista e a mesma porcentagem dão sempre a mesma
 * amostra, em qualquer máquina. Pelo menos uma, quando houver alguma.
 */
export function pickSample(ids: number[], pct: number): number[] {
  if (ids.length === 0 || pct <= 0) return [];
  const count = Math.max(1, Math.round((ids.length * Math.min(100, pct)) / 100));
  const score = (id: number) => {
    let hash = 2166136261;
    for (const char of String(id)) {
      hash ^= char.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  };
  return [...ids].sort((a, b) => score(a) - score(b) || a - b).slice(0, count).sort((a, b) => a - b);
}

/**
 * Ordem da revisão rápida: o que pode fazer mais estrago primeiro — risco alto,
 * depois incerteza do modelo, depois trecho mais longo — e o tempo do take para
 * desempatar.
 */
export function quickReviewOrder<T extends Pick<ReviewSuggestion, 'risk' | 'start' | 'end' | 'takeId' | 'evidence'>>(
  suggestions: T[],
): T[] {
  const certainty = (suggestion: T) => {
    const value = (suggestion.evidence as { certainty?: unknown })?.certainty;
    return value === 'low' ? 0 : value === 'medium' ? 1 : 2;
  };
  return [...suggestions].sort(
    (a, b) =>
      RISK_ORDER[b.risk] - RISK_ORDER[a.risk] ||
      certainty(a) - certainty(b) ||
      b.end - b.start - (a.end - a.start) ||
      a.takeId - b.takeId ||
      a.start - b.start,
  );
}
