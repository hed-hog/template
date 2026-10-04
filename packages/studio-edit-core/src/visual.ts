import { z } from 'zod';

import type { Ticks } from './time';

const ticks = z.number().int().refine(Number.isSafeInteger, 'Ticks must be a safe integer.');
const fraction = z.number().min(0).max(1);

/**
 * Elementos didáticos sobre o vídeo. Todos em frações do quadro, para valer em
 * qualquer resolução.
 *
 * Nenhum elemento inventa conteúdo: o texto de um título vem de quem decidiu
 * (ou de uma sugestão aprovada que resume o que FOI dito), e uma imagem só pode
 * vir da biblioteca, com origem e licença registradas.
 */
export const visualKindSchema = z.enum(['title', 'lower_third', 'highlight', 'arrow', 'zoom', 'image']);
export type VisualKind = z.infer<typeof visualKindSchema>;

export const visualRectSchema = z
  .object({ x: fraction, y: fraction, w: z.number().min(0.02).max(1), h: z.number().min(0.02).max(1) })
  .refine((rect) => rect.x + rect.w <= 1.0001 && rect.y + rect.h <= 1.0001, 'Rect must stay inside the frame.');
export type VisualRect = z.infer<typeof visualRectSchema>;

export const visualArrowSchema = z.object({ fromX: fraction, fromY: fraction, toX: fraction, toY: fraction });

/** O conteúdo de um elemento — o que um comando ou uma sugestão define. */
export const visualSpecSchema = z.object({
  kind: visualKindSchema,
  text: z.string().trim().max(300).nullable().optional(),
  subtitle: z.string().trim().max(300).nullable().optional(),
  rect: visualRectSchema.nullable().optional(),
  arrow: visualArrowSchema.nullable().optional(),
  /** Imagem da biblioteca (studio_edit_visual_asset). */
  assetId: z.number().int().positive().nullable().optional(),
  /**
   * Tela a que o zoom (ou destaque) se refere: o retângulo foi medido nela, e
   * só vale quando ela está no programa. Sem tela, vale para qualquer tela.
   */
  trackId: z.number().int().positive().nullable().optional(),
  /** Modelo visual da Hcode (fonte, cores, animação) — código, não texto livre. */
  template: z.string().regex(/^[a-z0-9-]{1,64}$/).optional(),
});
export type VisualSpec = z.infer<typeof visualSpecSchema>;

export const visualElementSchema = z.object({
  id: z.string().min(1).max(64),
  takeId: z.number().int().positive(),
  start: ticks,
  end: ticks,
  kind: visualKindSchema,
  text: z.string().max(300).nullable(),
  subtitle: z.string().max(300).nullable(),
  rect: visualRectSchema.nullable(),
  arrow: visualArrowSchema.nullable(),
  assetId: z.number().int().positive().nullable(),
  trackId: z.number().int().positive().nullable().default(null),
  template: z.string().max(64),
  origin: z.enum(['manual', 'suggestion']),
  suggestionId: z.number().int().positive().nullable(),
  decisionId: z.string().nullable(),
});
export type VisualElement = z.infer<typeof visualElementSchema>;

export const DEFAULT_VISUAL_TEMPLATE: Record<VisualKind, string> = {
  title: 'hcode-title',
  lower_third: 'hcode-lower-third',
  highlight: 'hcode-highlight',
  arrow: 'hcode-arrow',
  zoom: 'hcode-zoom',
  image: 'hcode-image',
};

/**
 * Valida o que cada tipo exige: texto para título e legenda, retângulo para
 * destaque, zoom e imagem, seta para seta, imagem da biblioteca para imagem.
 * Devolve a mensagem do primeiro problema, ou `null`.
 */
export function visualSpecProblem(spec: VisualSpec): string | null {
  switch (spec.kind) {
    case 'title':
    case 'lower_third':
      return spec.text ? null : 'A title needs its text.';
    case 'highlight':
    case 'zoom':
      return spec.rect ? null : 'A highlight or zoom needs its rectangle.';
    case 'arrow':
      return spec.arrow ? null : 'An arrow needs its start and end.';
    case 'image':
      return spec.rect && spec.assetId ? null : 'An image needs a library asset and a rectangle.';
  }
}

export function elementFromSpec(input: {
  id: string;
  takeId: number;
  start: Ticks;
  end: Ticks;
  spec: VisualSpec;
  origin: VisualElement['origin'];
  suggestionId: number | null;
  decisionId: string | null;
}): VisualElement {
  const { spec } = input;
  return {
    id: input.id,
    takeId: input.takeId,
    start: input.start,
    end: input.end,
    kind: spec.kind,
    text: spec.text ?? null,
    subtitle: spec.subtitle ?? null,
    rect: spec.rect ?? null,
    arrow: spec.arrow ?? null,
    assetId: spec.assetId ?? null,
    trackId: spec.trackId ?? null,
    template: spec.template ?? DEFAULT_VISUAL_TEMPLATE[spec.kind],
    origin: input.origin,
    suggestionId: input.suggestionId,
    decisionId: input.decisionId,
  };
}

/**
 * Onde o zoom põe o retângulo: escala para o retângulo ocupar o quadro (sem
 * distorcer) e deslocamento do centro para trazer o retângulo ao meio.
 * `centerX`/`centerY` seguem a convenção da exportação (fração do quadro, 0 no
 * meio).
 */
export function zoomMotion(rect: VisualRect, baseScale: number): { scale: number; centerX: number; centerY: number } {
  const factor = Math.max(1, Math.min(1 / rect.w, 1 / rect.h));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const round = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;
  return {
    scale: round(baseScale * factor, 2),
    centerX: round((0.5 - cx) * factor),
    centerY: round((0.5 - cy) * factor),
  };
}
