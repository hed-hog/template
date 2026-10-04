import { z } from 'zod';

import { autoSegment, type DirectionSegment, directionSegmentSchema } from './direction';
import type { Ticks } from './time';
import { visualElementSchema } from './visual';

export const DOCUMENT_SCHEMA = 'hedhog.studio-edit.document/1' as const;

const ticks = z.number().int().refine(Number.isSafeInteger, 'Ticks must be a safe integer.');

/** Um take e onde ele entra na montagem. Entrar é sempre explícito. */
export const takeEntrySchema = z.object({
  takeId: z.number().int().positive(),
  included: z.boolean(),
  order: z.number().int().nonnegative(),
  /** Limites do take no tempo comum (ver `takeSpan`). */
  start: ticks,
  end: ticks,
});

export const cutStateSchema = z.enum(['keep', 'remove']);
export const cutOriginSchema = z.enum(['default', 'manual', 'suggestion']);

/**
 * Um trecho do take. Os segmentos de um take formam uma partição completa de
 * `[start, end)`: nada fica sem estado, e o padrão é `keep` — o que ninguém
 * decidiu continua na montagem como no original.
 */
export const cutSegmentSchema = z.object({
  takeId: z.number().int().positive(),
  start: ticks,
  end: ticks,
  state: cutStateSchema,
  origin: cutOriginSchema,
  /** Trecho que nenhuma sugestão nem aprovação em lote pode remover. */
  protected: z.boolean(),
  suggestionId: z.number().int().positive().nullable(),
  decisionId: z.string().nullable(),
});

export const markerSchema = z.object({
  id: z.string().min(1),
  takeId: z.number().int().positive(),
  at: ticks,
  kind: z.enum(['note', 'error', 'retry', 'topic', 'protect']),
  text: z.string().max(2000),
  decisionId: z.string().nullable(),
});

export const reviewSchema = z.object({
  suggestionId: z.number().int().positive(),
  /** `deferred` deixa a sugestão para depois sem decidir: aprovar ou rejeitar depois substitui. */
  status: z.enum(['approved', 'rejected', 'deferred']),
  modified: z.boolean(),
  decisionId: z.string(),
});

export const editDocumentSchema = z.object({
  schema: z.literal(DOCUMENT_SCHEMA),
  takes: z.array(takeEntrySchema),
  cut: z.array(cutSegmentSchema),
  markers: z.array(markerSchema),
  reviews: z.array(reviewSchema),
  /**
   * O que aparece em cada trecho de cada take. Revisões gravadas antes da
   * camada de direção não têm o campo: valem como `auto` em tudo.
   */
  direction: z.array(directionSegmentSchema).default([]),
  /** Títulos, destaques, setas, zoom e imagens. Revisões antigas não têm: nenhum. */
  visual: z.array(visualElementSchema).default([]),
});

export type TakeEntry = z.infer<typeof takeEntrySchema>;
export type CutState = z.infer<typeof cutStateSchema>;
export type CutOrigin = z.infer<typeof cutOriginSchema>;
export type CutSegment = z.infer<typeof cutSegmentSchema>;
export type Marker = z.infer<typeof markerSchema>;
export type Review = z.infer<typeof reviewSchema>;
export type EditDocument = z.infer<typeof editDocumentSchema>;

export interface TakeBounds {
  takeId: number;
  start: Ticks;
  end: Ticks;
}

/**
 * Documento inicial: todos os takes fora da montagem até alguém incluir, e
 * cada um inteiro em `keep`. Takes podem ser tentativas alternativas do mesmo
 * conteúdo; concatenar todos por padrão produziria uma aula repetida.
 * `includedTakeIds` existe para o take marcado como escolhido na gravação.
 */
export function createDocument(takes: TakeBounds[], includedTakeIds: number[] = []): EditDocument {
  const included = new Set(includedTakeIds);
  return {
    schema: DOCUMENT_SCHEMA,
    takes: takes.map((take, index) => ({
      takeId: take.takeId,
      included: included.has(take.takeId),
      order: index,
      start: take.start,
      end: take.end,
    })),
    cut: takes
      .filter((take) => take.end > take.start)
      .map((take) => ({
        takeId: take.takeId,
        start: take.start,
        end: take.end,
        state: 'keep' as const,
        origin: 'default' as const,
        protected: false,
        suggestionId: null,
        decisionId: null,
      })),
    markers: [],
    reviews: [],
    direction: takes
      .filter((take) => take.end > take.start)
      .map((take) => autoSegment(take.takeId, take.start, take.end)),
    visual: [],
  };
}

export function cloneDocument(doc: EditDocument): EditDocument {
  return {
    schema: doc.schema,
    takes: doc.takes.map((take) => ({ ...take })),
    cut: doc.cut.map((segment) => ({ ...segment })),
    markers: doc.markers.map((marker) => ({ ...marker })),
    reviews: doc.reviews.map((review) => ({ ...review })),
    direction: (doc.direction ?? []).map((segment) => ({
      ...segment,
      pip: segment.pip ? { ...segment.pip, border: { ...segment.pip.border } } : null,
    })),
    visual: (doc.visual ?? []).map((element) => ({
      ...element,
      rect: element.rect ? { ...element.rect } : null,
      arrow: element.arrow ? { ...element.arrow } : null,
    })),
  };
}

/**
 * A direção de um take, ordenada. Take sem nenhum trecho (revisão antiga ou
 * take sem duração) vale como `auto` inteiro.
 */
export function directionOfTake(doc: EditDocument, takeId: number): DirectionSegment[] {
  const segments = (doc.direction ?? [])
    .filter((segment) => segment.takeId === takeId)
    .sort((a, b) => a.start - b.start);
  if (segments.length > 0) return segments;
  const take = findTake(doc, takeId);
  return take && take.end > take.start ? [autoSegment(takeId, take.start, take.end)] : [];
}

export function segmentsOfTake(doc: EditDocument, takeId: number): CutSegment[] {
  return doc.cut
    .filter((segment) => segment.takeId === takeId)
    .sort((a, b) => a.start - b.start);
}

export function findTake(doc: EditDocument, takeId: number): TakeEntry | undefined {
  return doc.takes.find((take) => take.takeId === takeId);
}

function sameAttributes(a: CutSegment, b: CutSegment): boolean {
  return (
    a.state === b.state &&
    a.origin === b.origin &&
    a.protected === b.protected &&
    a.suggestionId === b.suggestionId &&
    a.decisionId === b.decisionId
  );
}

/** Junta vizinhos idênticos e descarta segmentos vazios, mantendo a ordem. */
export function normalizeSegments(segments: CutSegment[]): CutSegment[] {
  const sorted = segments
    .filter((segment) => segment.end > segment.start)
    .sort((a, b) => a.start - b.start);
  const merged: CutSegment[] = [];
  for (const segment of sorted) {
    const last = merged.at(-1);
    if (last && last.end === segment.start && sameAttributes(last, segment)) {
      last.end = segment.end;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}

export class EditRuleError extends Error {
  constructor(
    readonly code:
      | 'take_not_found'
      | 'range_invalid'
      | 'range_outside_take'
      | 'protected_range'
      | 'suggestion_already_reviewed'
      | 'decision_not_found'
      | 'marker_not_found'
      | 'visual_invalid'
      | 'visual_not_found',
    message: string,
  ) {
    super(message);
    this.name = 'EditRuleError';
  }
}

export interface SegmentPatch {
  state?: CutState;
  origin?: CutOrigin;
  protected?: boolean;
  suggestionId?: number | null;
  decisionId?: string | null;
}

/**
 * Aplica `patch` ao intervalo `[start, end)` de um take, partindo os segmentos
 * nas bordas. Remover sobre trecho protegido é recusado, a menos que
 * `overrideProtection` diga que a pessoa fez isso de propósito.
 */
export function patchRange(
  doc: EditDocument,
  takeId: number,
  start: Ticks,
  end: Ticks,
  patch: SegmentPatch,
  options: { overrideProtection?: boolean } = {},
): EditDocument {
  const take = findTake(doc, takeId);
  if (!take) {
    throw new EditRuleError('take_not_found', `Take ${takeId} is not part of this montage.`);
  }
  if (!(end > start)) {
    throw new EditRuleError('range_invalid', 'The range end must be after its start.');
  }

  const clampedStart = Math.max(start, take.start);
  const clampedEnd = Math.min(end, take.end);
  if (!(clampedEnd > clampedStart)) {
    throw new EditRuleError('range_outside_take', 'The range does not overlap the take.');
  }

  const before = segmentsOfTake(doc, takeId);
  const result: CutSegment[] = [];

  for (const segment of before) {
    if (segment.end <= clampedStart || segment.start >= clampedEnd) {
      result.push({ ...segment });
      continue;
    }

    if (patch.state === 'remove' && segment.protected && !options.overrideProtection) {
      throw new EditRuleError('protected_range', 'The range overlaps a protected segment.');
    }

    if (segment.start < clampedStart) {
      result.push({ ...segment, end: clampedStart });
    }

    result.push({
      ...segment,
      ...patch,
      start: Math.max(segment.start, clampedStart),
      end: Math.min(segment.end, clampedEnd),
    });

    if (segment.end > clampedEnd) {
      result.push({ ...segment, start: clampedEnd });
    }
  }

  const next = cloneDocument(doc);
  next.cut = [
    ...next.cut.filter((segment) => segment.takeId !== takeId),
    ...normalizeSegments(result),
  ];
  return next;
}

/** Duração mantida e removida de um take — para os resumos da interface. */
export function cutTotals(doc: EditDocument, takeId: number): { keep: Ticks; remove: Ticks } {
  let keep = 0;
  let remove = 0;
  for (const segment of segmentsOfTake(doc, takeId)) {
    const length = segment.end - segment.start;
    if (segment.state === 'keep') keep += length;
    else remove += length;
  }
  return { keep, remove };
}
