import { z } from 'zod';

import { directionSpecSchema, patchDirectionSegments, pipGeometrySchema } from './direction';
import { elementFromSpec, visualSpecProblem, visualSpecSchema } from './visual';
import {
  cloneDocument,
  directionOfTake,
  cutStateSchema,
  type EditDocument,
  EditRuleError,
  findTake,
  markerSchema,
  patchRange,
} from './document';
import type { Ticks } from './time';

const ticks = z.number().int().refine(Number.isSafeInteger, 'Ticks must be a safe integer.');
const id = z.number().int().positive();

/**
 * Comandos editoriais. São a ÚNICA forma de mudar a montagem: inspecionar uma
 * câmera, dar solo num microfone ou esconder um painel nunca gera comando.
 * Todo comando que mexe em tempo carrega o intervalo explícito.
 */
export const commandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('setTakeInclusion'),
    takeId: id,
    included: z.boolean(),
    order: z.number().int().nonnegative().optional(),
  }),
  z.object({
    type: z.literal('setCut'),
    takeId: id,
    start: ticks,
    end: ticks,
    state: cutStateSchema,
    overrideProtection: z.boolean().optional(),
  }),
  z.object({
    type: z.literal('protectRange'),
    takeId: id,
    start: ticks,
    end: ticks,
    protected: z.boolean(),
  }),
  z.object({
    type: z.literal('setDirection'),
    takeId: id,
    start: ticks,
    end: ticks,
    direction: directionSpecSchema,
  }),
  z.object({
    type: z.literal('setPip'),
    takeId: id,
    start: ticks,
    end: ticks,
    pip: pipGeometrySchema,
  }),
  z.object({
    type: z.literal('addVisual'),
    elementId: z.string().min(1).max(64),
    takeId: id,
    start: ticks,
    end: ticks,
    visual: visualSpecSchema,
  }),
  z.object({
    type: z.literal('updateVisual'),
    elementId: z.string().min(1).max(64),
    start: ticks.optional(),
    end: ticks.optional(),
    visual: visualSpecSchema.optional(),
  }),
  z.object({
    type: z.literal('removeVisual'),
    elementId: z.string().min(1).max(64),
  }),
  z.object({
    type: z.literal('approveSuggestion'),
    suggestionId: id,
    /** Camada da sugestão; decisões antigas não têm o campo e são de corte. */
    layer: z.enum(['cut', 'direction', 'visual']).optional(),
    direction: directionSpecSchema.optional(),
    visual: visualSpecSchema.optional(),
    /** Preenchidos pelo servidor a partir da sugestão; o cliente pode mandar a versão modificada. */
    takeId: id,
    start: ticks,
    end: ticks,
    state: cutStateSchema,
    modified: z.boolean(),
  }),
  z.object({
    type: z.literal('rejectSuggestion'),
    suggestionId: id,
  }),
  z.object({
    type: z.literal('deferSuggestion'),
    suggestionId: id,
  }),
  z.object({
    type: z.literal('addMarker'),
    markerId: z.string().min(1).max(64),
    takeId: id,
    at: ticks,
    kind: markerSchema.shape.kind,
    text: z.string().max(2000),
  }),
  z.object({
    type: z.literal('removeMarker'),
    markerId: z.string().min(1).max(64),
  }),
  /**
   * Só o servidor emite: um take gravado depois que a montagem nasceu entra no
   * documento por um comando, e não por edição direta, para o histórico
   * continuar reconstruindo exatamente o mesmo estado.
   */
  z.object({
    type: z.literal('registerTake'),
    takeId: id,
    start: ticks,
    end: ticks,
  }),
  z.object({
    type: z.literal('undo'),
    decisionId: z.string().min(1),
  }),
]);

export type Command = z.infer<typeof commandSchema>;
export type CommandType = Command['type'];

/** Comandos que só o servidor pode emitir. */
export const SYSTEM_COMMAND_TYPES: ReadonlySet<CommandType> = new Set<CommandType>(['registerTake']);

/** Um comando já aceito, com a identidade que o histórico guarda. */
export interface Decision {
  decisionId: string;
  command: Command;
}

/**
 * Aplica um comando ao documento, sem efeito colateral. Recusa (com
 * `EditRuleError`) o que violaria uma regra — remover trecho protegido,
 * revisar duas vezes a mesma sugestão — em vez de corrigir em silêncio.
 */
export function applyCommand(doc: EditDocument, decision: Decision): EditDocument {
  const { command, decisionId } = decision;

  switch (command.type) {
    case 'setTakeInclusion': {
      const next = cloneDocument(doc);
      const take = findTake(next, command.takeId);
      if (!take) {
        throw new EditRuleError('take_not_found', `Take ${command.takeId} is not part of this montage.`);
      }
      take.included = command.included;
      if (command.order !== undefined) {
        reorder(next, command.takeId, command.order);
      }
      return next;
    }

    case 'setCut':
      return patchRange(
        doc,
        command.takeId,
        command.start,
        command.end,
        { state: command.state, origin: 'manual', suggestionId: null, decisionId },
        { overrideProtection: command.overrideProtection },
      );

    case 'protectRange':
      return patchRange(doc, command.takeId, command.start, command.end, {
        protected: command.protected,
        decisionId,
      });

    case 'setDirection':
      return patchDirection(doc, command.takeId, command.start, command.end, (segment) => ({
        ...segment,
        layout: command.direction.layout,
        primaryTrackId: command.direction.primaryTrackId ?? null,
        secondaryTrackId: command.direction.secondaryTrackId ?? null,
        pip: command.direction.pip ?? null,
        origin: 'manual',
        suggestionId: null,
        decisionId,
      }));

    case 'setPip':
      // Mexer no PIP de um trecho em `auto` (ou só tela) é decidir que ali há PIP.
      return patchDirection(doc, command.takeId, command.start, command.end, (segment) => ({
        ...segment,
        layout: segment.layout === 'auto' || segment.layout === 'screen' ? 'screen_pip' : segment.layout,
        pip: command.pip,
        origin: 'manual',
        suggestionId: null,
        decisionId,
      }));

    case 'addVisual':
      return addVisualElement(doc, {
        elementId: command.elementId,
        takeId: command.takeId,
        start: command.start,
        end: command.end,
        spec: command.visual,
        origin: 'manual',
        suggestionId: null,
        decisionId,
      });

    case 'updateVisual': {
      const current = doc.visual.find((element) => element.id === command.elementId);
      if (!current) throw new EditRuleError('visual_not_found', `Visual element ${command.elementId} does not exist.`);
      const next = cloneDocument(doc);
      next.visual = next.visual.filter((element) => element.id !== command.elementId);
      const spec = command.visual ?? {
        kind: current.kind,
        text: current.text,
        subtitle: current.subtitle,
        rect: current.rect,
        arrow: current.arrow,
        assetId: current.assetId,
        trackId: current.trackId ?? null,
        template: current.template,
      };
      return addVisualElement(next, {
        elementId: current.id,
        takeId: current.takeId,
        start: command.start ?? current.start,
        end: command.end ?? current.end,
        spec,
        origin: current.origin,
        suggestionId: current.suggestionId,
        decisionId,
      });
    }

    case 'removeVisual': {
      if (!doc.visual.some((element) => element.id === command.elementId)) {
        throw new EditRuleError('visual_not_found', `Visual element ${command.elementId} does not exist.`);
      }
      const next = cloneDocument(doc);
      next.visual = next.visual.filter((element) => element.id !== command.elementId);
      return next;
    }

    case 'approveSuggestion': {
      assertNotReviewed(doc, command.suggestionId);
      if (command.layer === 'visual') {
        const spec = command.visual;
        if (!spec) throw new EditRuleError('visual_invalid', 'A visual suggestion needs its element.');
        const next = addVisualElement(withoutDeferral(doc, command.suggestionId), {
          elementId: `s${command.suggestionId}`,
          takeId: command.takeId,
          start: command.start,
          end: command.end,
          spec,
          origin: 'suggestion',
          suggestionId: command.suggestionId,
          decisionId,
        });
        next.reviews.push({ suggestionId: command.suggestionId, status: 'approved', modified: command.modified, decisionId });
        return next;
      }
      if (command.layer === 'direction') {
        const spec = command.direction;
        if (!spec) {
          throw new EditRuleError('range_invalid', 'A direction suggestion needs its direction spec.');
        }
        const next = patchDirection(withoutDeferral(doc, command.suggestionId), command.takeId, command.start, command.end, (segment) => ({
          ...segment,
          layout: spec.layout,
          primaryTrackId: spec.primaryTrackId ?? null,
          secondaryTrackId: spec.secondaryTrackId ?? null,
          pip: spec.pip ?? null,
          origin: 'suggestion',
          suggestionId: command.suggestionId,
          decisionId,
        }));
        next.reviews.push({ suggestionId: command.suggestionId, status: 'approved', modified: command.modified, decisionId });
        return next;
      }
      const next = patchRange(withoutDeferral(doc, command.suggestionId), command.takeId, command.start, command.end, {
        state: command.state,
        origin: 'suggestion',
        suggestionId: command.suggestionId,
        decisionId,
      });
      next.reviews.push({
        suggestionId: command.suggestionId,
        status: 'approved',
        modified: command.modified,
        decisionId,
      });
      return next;
    }

    case 'rejectSuggestion': {
      assertNotReviewed(doc, command.suggestionId);
      const next = withoutDeferral(doc, command.suggestionId);
      next.reviews.push({
        suggestionId: command.suggestionId,
        status: 'rejected',
        modified: false,
        decisionId,
      });
      return next;
    }

    case 'deferSuggestion': {
      assertNotReviewed(doc, command.suggestionId);
      const next = withoutDeferral(doc, command.suggestionId);
      next.reviews.push({
        suggestionId: command.suggestionId,
        status: 'deferred',
        modified: false,
        decisionId,
      });
      return next;
    }

    case 'addMarker': {
      if (!findTake(doc, command.takeId)) {
        throw new EditRuleError('take_not_found', `Take ${command.takeId} is not part of this montage.`);
      }
      const next = cloneDocument(doc);
      next.markers = next.markers.filter((marker) => marker.id !== command.markerId);
      next.markers.push({
        id: command.markerId,
        takeId: command.takeId,
        at: command.at,
        kind: command.kind,
        text: command.text,
        decisionId,
      });
      next.markers.sort((a, b) => a.takeId - b.takeId || a.at - b.at);
      return next;
    }

    case 'removeMarker': {
      if (!doc.markers.some((marker) => marker.id === command.markerId)) {
        throw new EditRuleError('marker_not_found', `Marker ${command.markerId} does not exist.`);
      }
      const next = cloneDocument(doc);
      next.markers = next.markers.filter((marker) => marker.id !== command.markerId);
      return next;
    }

    case 'registerTake': {
      if (findTake(doc, command.takeId)) return doc;
      const next = cloneDocument(doc);
      if (command.end > command.start) {
        next.direction.push({
          takeId: command.takeId,
          start: command.start,
          end: command.end,
          layout: 'auto',
          primaryTrackId: null,
          secondaryTrackId: null,
          pip: null,
          origin: 'default',
          suggestionId: null,
          decisionId: null,
        });
      }
      next.takes.push({
        takeId: command.takeId,
        included: false,
        order: next.takes.length,
        start: command.start,
        end: command.end,
      });
      if (command.end > command.start) {
        next.cut.push({
          takeId: command.takeId,
          start: command.start,
          end: command.end,
          state: 'keep',
          origin: 'default',
          protected: false,
          suggestionId: null,
          decisionId: null,
        });
      }
      return next;
    }

    case 'undo':
      // Desfazer não muda o documento diretamente: `replay` recalcula sem a
      // decisão desfeita, o que devolve exatamente o estado anterior a ela
      // mesmo quando outras decisões vieram depois.
      return doc;
  }
}

/** Uma sugestão adiada continua aberta; só aprovada ou rejeitada está decidida. */
function assertNotReviewed(doc: EditDocument, suggestionId: number) {
  if (doc.reviews.some((review) => review.suggestionId === suggestionId && review.status !== 'deferred')) {
    throw new EditRuleError(
      'suggestion_already_reviewed',
      `Suggestion ${suggestionId} was already reviewed; undo that decision first.`,
    );
  }
}

/** Aplica um ajuste à direção de um intervalo, no take inteiro do documento. */
function patchDirection(
  doc: EditDocument,
  takeId: number,
  start: number,
  end: number,
  patch: Parameters<typeof patchDirectionSegments>[4],
): EditDocument {
  const take = findTake(doc, takeId);
  if (!take) throw new EditRuleError('take_not_found', `Take ${takeId} is not part of this montage.`);
  if (!(end > start)) throw new EditRuleError('range_invalid', 'The range end must be after its start.');
  if (Math.min(end, take.end) <= Math.max(start, take.start)) {
    throw new EditRuleError('range_outside_take', 'The range does not overlap the take.');
  }
  const next = cloneDocument(doc);
  const updated = patchDirectionSegments(directionOfTake(next, takeId), { takeId, start: take.start, end: take.end }, start, end, patch);
  next.direction = [...next.direction.filter((segment) => segment.takeId !== takeId), ...updated];
  return next;
}

/**
 * Põe um elemento visual no documento, recusando o que estiver incompleto para
 * o tipo (título sem texto, imagem sem item da biblioteca) ou fora do take.
 */
function addVisualElement(
  doc: EditDocument,
  input: {
    elementId: string;
    takeId: number;
    start: number;
    end: number;
    spec: Parameters<typeof elementFromSpec>[0]['spec'];
    origin: 'manual' | 'suggestion';
    suggestionId: number | null;
    decisionId: string;
  },
): EditDocument {
  const take = findTake(doc, input.takeId);
  if (!take) throw new EditRuleError('take_not_found', `Take ${input.takeId} is not part of this montage.`);
  if (!(input.end > input.start)) throw new EditRuleError('range_invalid', 'The range end must be after its start.');
  const start = Math.max(input.start, take.start);
  const end = Math.min(input.end, take.end);
  if (!(end > start)) throw new EditRuleError('range_outside_take', 'The range does not overlap the take.');
  const problem = visualSpecProblem(input.spec);
  if (problem) throw new EditRuleError('visual_invalid', problem);
  const next = cloneDocument(doc);
  next.visual = next.visual.filter((element) => element.id !== input.elementId);
  next.visual.push(
    elementFromSpec({
      id: input.elementId,
      takeId: input.takeId,
      start,
      end,
      spec: input.spec,
      origin: input.origin,
      suggestionId: input.suggestionId,
      decisionId: input.decisionId,
    }),
  );
  next.visual.sort((a, b) => a.takeId - b.takeId || a.start - b.start);
  return next;
}

function withoutDeferral(doc: EditDocument, suggestionId: number): EditDocument {
  const next = cloneDocument(doc);
  next.reviews = next.reviews.filter((review) => review.suggestionId !== suggestionId);
  return next;
}

function reorder(doc: EditDocument, takeId: number, order: number) {
  const sorted = [...doc.takes].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((take) => take.takeId === takeId);
  const [moved] = sorted.splice(index, 1);
  if (!moved) return;
  sorted.splice(Math.min(order, sorted.length), 0, moved);
  sorted.forEach((take, position) => {
    take.order = position;
  });
}

/**
 * Quais decisões continuam valendo. Um `undo` desativa o alvo; desfazer o
 * próprio `undo` reativa o alvo (refazer). Como todo `undo` vem depois do que
 * desfaz, uma passada de trás para frente resolve as cadeias.
 */
export function activeDecisionIds(decisions: Decision[]): Set<string> {
  const undoersOf = new Map<string, string[]>();
  for (const { decisionId, command } of decisions) {
    if (command.type === 'undo') {
      const list = undoersOf.get(command.decisionId) ?? [];
      list.push(decisionId);
      undoersOf.set(command.decisionId, list);
    }
  }

  const active = new Map<string, boolean>();
  for (let index = decisions.length - 1; index >= 0; index -= 1) {
    const decision = decisions.at(index);
    if (!decision) continue;
    const undoers = undoersOf.get(decision.decisionId) ?? [];
    active.set(decision.decisionId, !undoers.some((undoer) => active.get(undoer)));
  }

  return new Set([...active].filter(([, isActive]) => isActive).map(([key]) => key));
}

export interface ReplayResult {
  document: EditDocument;
  /** Decisões que deixaram de caber depois de um `undo` anterior a elas. */
  skipped: Array<{ decisionId: string; code: EditRuleError['code'] }>;
}

/**
 * Reconstrói o documento a partir do inicial e do histórico. É a definição de
 * "estado da revisão": o snapshot que o servidor guarda tem que ser igual ao
 * que isto devolve, e um teste garante isso.
 */
export function replay(initial: EditDocument, decisions: Decision[]): ReplayResult {
  const active = activeDecisionIds(decisions);
  let document = initial;
  const skipped: ReplayResult['skipped'] = [];

  for (const decision of decisions) {
    if (decision.command.type === 'undo' || !active.has(decision.decisionId)) continue;
    try {
      document = applyCommand(document, decision);
    } catch (error) {
      if (error instanceof EditRuleError) {
        skipped.push({ decisionId: decision.decisionId, code: error.code });
        continue;
      }
      throw error;
    }
  }

  return { document, skipped };
}

/** Intervalo de tempo que o comando toca, para detectar edições concorrentes. */
export function commandRange(
  command: Command,
): { takeId: number; start: Ticks; end: Ticks } | null {
  switch (command.type) {
    case 'setCut':
    case 'protectRange':
    case 'approveSuggestion':
    case 'setDirection':
    case 'setPip':
    case 'addVisual':
      return { takeId: command.takeId, start: command.start, end: command.end };
    case 'addMarker':
      return { takeId: command.takeId, start: command.at, end: command.at + 1 };
    default:
      return null;
  }
}

/**
 * Dois comandos concorrentes conflitam quando tocam o mesmo trecho, a mesma
 * sugestão, o mesmo marcador ou a inclusão do mesmo take. Sem conflito, o
 * servidor aplica o comando atrasado sobre a revisão nova (rebase); com
 * conflito, devolve 409 e a pessoa decide.
 */
export function commandsConflict(a: Command, b: Command): boolean {
  const suggestionOf = (command: Command) =>
    command.type === 'approveSuggestion' ||
    command.type === 'rejectSuggestion' ||
    command.type === 'deferSuggestion'
      ? command.suggestionId
      : null;
  const suggestionA = suggestionOf(a);
  if (suggestionA !== null && suggestionA === suggestionOf(b)) return true;

  const visualOf = (command: Command) =>
    command.type === 'addVisual' || command.type === 'updateVisual' || command.type === 'removeVisual'
      ? command.elementId
      : null;
  const visualA = visualOf(a);
  if (visualA !== null && visualA === visualOf(b)) return true;

  const markerOf = (command: Command) =>
    command.type === 'addMarker' || command.type === 'removeMarker' ? command.markerId : null;
  const markerA = markerOf(a);
  if (markerA !== null && markerA === markerOf(b)) return true;

  if (a.type === 'setTakeInclusion' && b.type === 'setTakeInclusion') {
    return a.takeId === b.takeId || a.order !== undefined || b.order !== undefined;
  }

  if (a.type === 'undo' || b.type === 'undo') return true;

  const rangeA = commandRange(a);
  const rangeB = commandRange(b);
  if (!rangeA || !rangeB || rangeA.takeId !== rangeB.takeId) return false;
  return rangeA.start < rangeB.end && rangeB.start < rangeA.end;
}
