import { z } from 'zod';

import type { Ticks } from './time';

const ticks = z.number().int().refine(Number.isSafeInteger, 'Ticks must be a safe integer.');
const trackId = z.number().int().positive();

/**
 * O que o espectador vê num trecho.
 *
 * `auto` é o padrão de quem ninguém decidiu: a exportação e a prévia resolvem
 * pelo perfil (tela com PIP quando há tela e câmera). Os demais são decisões.
 */
export const layoutSchema = z.enum(['auto', 'screen', 'camera', 'screen_pip', 'two_up']);
export type Layout = z.infer<typeof layoutSchema>;
export type ConcreteLayout = Exclude<Layout, 'auto'>;

/**
 * O instrutor em círculo sobre a tela. Posição e tamanho em frações do quadro
 * (0..1), para valerem em qualquer resolução: `x`/`y` são o centro do círculo e
 * `size` o diâmetro em fração da ALTURA do quadro.
 */
export const pipGeometrySchema = z.object({
  trackId: trackId.nullable(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  size: z.number().min(0.05).max(0.6),
  shape: z.enum(['circle', 'rounded', 'square']),
  border: z.object({
    width: z.number().int().min(0).max(40),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  }),
});
export type PipGeometry = z.infer<typeof pipGeometrySchema>;

export const directionSegmentSchema = z.object({
  takeId: trackId,
  start: ticks,
  end: ticks,
  layout: layoutSchema,
  /** Fonte principal (tela em `screen`/`screen_pip`, câmera em `camera`, esquerda em `two_up`). */
  primaryTrackId: trackId.nullable(),
  /** Segunda câmera em `two_up`. */
  secondaryTrackId: trackId.nullable(),
  pip: pipGeometrySchema.nullable(),
  origin: z.enum(['default', 'manual', 'suggestion']),
  suggestionId: z.number().int().positive().nullable(),
  decisionId: z.string().nullable(),
});
export type DirectionSegment = z.infer<typeof directionSegmentSchema>;

/** O que um comando ou uma sugestão de direção aplica num intervalo. */
export const directionSpecSchema = z.object({
  layout: layoutSchema,
  primaryTrackId: trackId.nullable().optional(),
  secondaryTrackId: trackId.nullable().optional(),
  pip: pipGeometrySchema.nullable().optional(),
});
export type DirectionSpec = z.infer<typeof directionSpecSchema>;

export function autoSegment(takeId: number, start: Ticks, end: Ticks): DirectionSegment {
  return {
    takeId,
    start,
    end,
    layout: 'auto',
    primaryTrackId: null,
    secondaryTrackId: null,
    pip: null,
    origin: 'default',
    suggestionId: null,
    decisionId: null,
  };
}

function sameDirection(a: DirectionSegment, b: DirectionSegment): boolean {
  return (
    a.layout === b.layout &&
    a.primaryTrackId === b.primaryTrackId &&
    a.secondaryTrackId === b.secondaryTrackId &&
    a.origin === b.origin &&
    a.suggestionId === b.suggestionId &&
    a.decisionId === b.decisionId &&
    JSON.stringify(a.pip) === JSON.stringify(b.pip)
  );
}

export function normalizeDirection(segments: DirectionSegment[]): DirectionSegment[] {
  const sorted = segments.filter((segment) => segment.end > segment.start).sort((a, b) => a.start - b.start);
  const merged: DirectionSegment[] = [];
  for (const segment of sorted) {
    const last = merged[merged.length - 1];
    if (last && last.end === segment.start && sameDirection(last, segment)) last.end = segment.end;
    else merged.push({ ...segment, pip: segment.pip ? { ...segment.pip, border: { ...segment.pip.border } } : null });
  }
  return merged;
}

/**
 * Aplica `patch` ao intervalo `[start, end)` da direção de um take, partindo
 * nas bordas. Fora do intervalo nada muda — trocar a câmera de um trecho nunca
 * mexe no vizinho.
 */
export function patchDirectionSegments(
  segments: DirectionSegment[],
  bounds: { takeId: number; start: Ticks; end: Ticks },
  start: Ticks,
  end: Ticks,
  patch: (segment: DirectionSegment) => DirectionSegment,
): DirectionSegment[] {
  const base = segments.length > 0 ? segments : [autoSegment(bounds.takeId, bounds.start, bounds.end)];
  const from = Math.max(start, bounds.start);
  const to = Math.min(end, bounds.end);
  const result: DirectionSegment[] = [];
  for (const segment of base) {
    if (segment.end <= from || segment.start >= to) {
      result.push(segment);
      continue;
    }
    if (segment.start < from) result.push({ ...segment, end: from });
    result.push(patch({ ...segment, start: Math.max(segment.start, from), end: Math.min(segment.end, to) }));
    if (segment.end > to) result.push({ ...segment, start: to });
  }
  return normalizeDirection(result);
}

/** Uma fonte de vídeo do take, como a direção precisa dela. */
export interface DirectionSource {
  trackId: number;
  kind: 'screen' | 'camera' | 'external';
  /** Dono da fonte (máquina/instrutor que gravou). */
  userId: number | null;
  sourceIndex: number;
}

export interface DirectionDefaults {
  pip: Omit<PipGeometry, 'trackId'>;
  allowedLayouts: ConcreteLayout[];
}

export const FACTORY_DIRECTION_DEFAULTS: DirectionDefaults = {
  pip: { x: 0.88, y: 0.82, size: 0.24, shape: 'circle', border: { width: 4, color: '#ffffff' } },
  allowedLayouts: ['screen', 'camera', 'screen_pip', 'two_up'],
};

/** A direção já resolvida: o que a prévia mostra e a exportação monta. */
export interface ResolvedDirection {
  layout: ConcreteLayout;
  primaryTrackId: number | null;
  secondaryTrackId: number | null;
  pip: PipGeometry | null;
}

/**
 * Resolve um trecho para o que de fato aparece, com fallback quando a fonte
 * escolhida não existe nesse take: `auto` vira tela com PIP (ou só a tela, ou
 * só a câmera, conforme o que foi gravado); uma câmera que falhou cede lugar à
 * outra; PIP sem câmera vira tela cheia.
 */
export function resolveDirection(
  segment: Pick<DirectionSegment, 'layout' | 'primaryTrackId' | 'secondaryTrackId' | 'pip'>,
  sources: DirectionSource[],
  defaults: DirectionDefaults = FACTORY_DIRECTION_DEFAULTS,
): ResolvedDirection {
  const screens = sources.filter((source) => source.kind === 'screen').sort((a, b) => a.sourceIndex - b.sourceIndex);
  const cameras = sources.filter((source) => source.kind !== 'screen').sort((a, b) => a.sourceIndex - b.sourceIndex);
  const has = (id: number | null | undefined) => id !== null && id !== undefined && sources.some((s) => s.trackId === id);
  const allowed = (layout: ConcreteLayout) => defaults.allowedLayouts.includes(layout);

  let layout: ConcreteLayout;
  if (segment.layout === 'auto') {
    layout = screens.length && cameras.length && allowed('screen_pip') ? 'screen_pip' : screens.length ? 'screen' : 'camera';
  } else {
    layout = segment.layout;
  }

  const screenId = has(segment.primaryTrackId) && screens.some((s) => s.trackId === segment.primaryTrackId)
    ? segment.primaryTrackId
    : screens[0]?.trackId ?? null;
  const cameraFor = (preferred: number | null | undefined) =>
    has(preferred) && cameras.some((c) => c.trackId === preferred) ? (preferred as number) : cameras[0]?.trackId ?? null;

  if ((layout === 'screen' || layout === 'screen_pip') && screenId === null) layout = 'camera';
  if (layout === 'camera' && cameras.length === 0) layout = 'screen';
  if (layout === 'two_up' && cameras.length < 2) layout = cameras.length ? 'camera' : 'screen';

  switch (layout) {
    case 'screen':
      return { layout, primaryTrackId: screenId, secondaryTrackId: null, pip: null };
    case 'camera':
      return { layout, primaryTrackId: cameraFor(segment.primaryTrackId), secondaryTrackId: null, pip: null };
    case 'two_up': {
      const left = cameraFor(segment.primaryTrackId);
      const right =
        has(segment.secondaryTrackId) && segment.secondaryTrackId !== left
          ? (segment.secondaryTrackId as number)
          : cameras.find((camera) => camera.trackId !== left)?.trackId ?? null;
      return { layout, primaryTrackId: left, secondaryTrackId: right, pip: null };
    }
    case 'screen_pip': {
      const pipCamera = cameraFor(segment.pip?.trackId);
      if (pipCamera === null) return { layout: 'screen', primaryTrackId: screenId, secondaryTrackId: null, pip: null };
      const geometry = segment.pip ?? { ...defaults.pip, trackId: pipCamera };
      return { layout, primaryTrackId: screenId, secondaryTrackId: null, pip: { ...geometry, trackId: pipCamera } };
    }
  }
}

export type EditScope = 'selection' | 'currentDecision' | 'untilNextCut' | 'wholeTake';

/**
 * O intervalo que uma ação editorial vai alterar. Nunca implícito: quem chama
 * escolhe o alcance, e a interface mostra o intervalo antes de aplicar.
 *
 * - `selection`: o intervalo selecionado.
 * - `currentDecision`: o trecho de direção que contém o instante.
 * - `untilNextCut`: do instante até a próxima fronteira de corte.
 * - `wholeTake`: o take inteiro.
 */
export function resolveScope(input: {
  scope: EditScope;
  at: Ticks;
  take: { start: Ticks; end: Ticks };
  direction: DirectionSegment[];
  cutBoundaries: Ticks[];
  selection?: { start: Ticks; end: Ticks } | null;
}): { start: Ticks; end: Ticks } | null {
  const { scope, at, take } = input;
  switch (scope) {
    case 'selection':
      return input.selection && input.selection.end > input.selection.start ? { ...input.selection } : null;
    case 'wholeTake':
      return { start: take.start, end: take.end };
    case 'currentDecision': {
      const segment = input.direction.find((candidate) => at >= candidate.start && at < candidate.end);
      return segment ? { start: segment.start, end: segment.end } : { start: take.start, end: take.end };
    }
    case 'untilNextCut': {
      const next = input.cutBoundaries.filter((boundary) => boundary > at).sort((a, b) => a - b)[0];
      const end = next ?? take.end;
      return end > at ? { start: at, end } : null;
    }
  }
}

/**
 * Padrões de direção a partir dos números das settings: o PIP padrão vai para o
 * primeiro canto preferido. A proporção do quadro é 16:9 porque o `auto` não
 * sabe qual tela vai aparecer; o diretor, que sabe, calcula a sua.
 */
export function directionDefaultsFrom(input: {
  allowedLayouts: ConcreteLayout[];
  sizePct: number;
  corner: 'tl' | 'tr' | 'bl' | 'br';
  marginPct: number;
  border: { width: number; color: string };
}): DirectionDefaults {
  const aspect = 16 / 9;
  const size = Math.min(0.6, Math.max(0.05, input.sizePct / 100));
  const radiusX = size / 2 / aspect;
  const radiusY = size / 2;
  const marginY = input.marginPct / 100;
  const marginX = marginY / aspect;
  const round = (value: number) => Math.round(value * 10000) / 10000;
  return {
    allowedLayouts: input.allowedLayouts.length ? input.allowedLayouts : FACTORY_DIRECTION_DEFAULTS.allowedLayouts,
    pip: {
      x: round(input.corner.endsWith('l') ? marginX + radiusX : 1 - marginX - radiusX),
      y: round(input.corner.startsWith('t') ? marginY + radiusY : 1 - marginY - radiusY),
      size,
      shape: 'circle',
      border: { ...input.border },
    },
  };
}
