import { applyCommand, type Decision } from './commands';
import { type EditDocument, EditRuleError, segmentsOfTake } from './document';
import type { DirectionSpec } from './direction';
import type { VisualSpec } from './visual';
import type { Ticks } from './time';

/**
 * Um pedaço contínuo de um take que entra na montagem. `montageStart` é onde
 * ele começa no tempo da montagem; o tempo do take continua em `start`/`end`,
 * então a origem de qualquer quadro da montagem é sempre recuperável.
 */
export interface MontageClip {
  takeId: number;
  start: Ticks;
  end: Ticks;
  montageStart: Ticks;
}

export interface Montage {
  clips: MontageClip[];
  duration: Ticks;
}

/** Takes incluídos, na ordem escolhida, com os trechos `keep` contíguos fundidos. */
export function buildMontage(doc: EditDocument): Montage {
  const takes = doc.takes.filter((take) => take.included).sort((a, b) => a.order - b.order);
  const clips: MontageClip[] = [];
  let cursor = 0;

  for (const take of takes) {
    let open: MontageClip | null = null;
    for (const segment of segmentsOfTake(doc, take.takeId)) {
      if (segment.state !== 'keep') {
        open = null;
        continue;
      }
      if (open && open.end === segment.start) {
        open.end = segment.end;
        cursor += segment.end - segment.start;
        continue;
      }
      open = { takeId: take.takeId, start: segment.start, end: segment.end, montageStart: cursor };
      clips.push(open);
      cursor += segment.end - segment.start;
    }
  }

  return { clips, duration: cursor };
}

/** Tempo do take → tempo da montagem, ou `null` quando o instante foi removido ou o take está fora. */
export function takeToMontage(montage: Montage, takeId: number, takeTicks: Ticks): Ticks | null {
  for (const clip of montage.clips) {
    if (clip.takeId === takeId && takeTicks >= clip.start && takeTicks < clip.end) {
      return clip.montageStart + (takeTicks - clip.start);
    }
  }
  return null;
}

/** Tempo da montagem → origem no take. */
export function montageToTake(
  montage: Montage,
  montageTicks: Ticks,
): { takeId: number; takeTicks: Ticks; clipIndex: number } | null {
  for (let index = 0; index < montage.clips.length; index += 1) {
    const clip = montage.clips.at(index);
    if (!clip) continue;
    const length = clip.end - clip.start;
    if (montageTicks >= clip.montageStart && montageTicks < clip.montageStart + length) {
      return { takeId: clip.takeId, takeTicks: clip.start + (montageTicks - clip.montageStart), clipIndex: index };
    }
  }
  return null;
}

/** Sugestão de corte como a interface e a prévia a enxergam. */
export interface CutSuggestion {
  id: number;
  takeId: number;
  start: Ticks;
  end: Ticks;
  state: 'keep' | 'remove';
  /** Ausente = corte. */
  layer?: 'cut' | 'direction' | 'visual';
  direction?: DirectionSpec | null;
  visual?: VisualSpec | null;
  status: 'pending' | 'approved' | 'rejected' | 'deferred' | 'superseded' | 'conflict';
}

export interface ProposalPreview {
  document: EditDocument;
  /** Sugestões pendentes que não couberam (ex.: sobre trecho protegido). */
  blocked: Array<{ suggestionId: number; code: EditRuleError['code'] }>;
}

/**
 * O modo "Proposta da IA": o aprovado mais as sugestões pendentes, calculado
 * em memória. Nunca é persistido — aprovar continua exigindo um comando.
 */
export function previewProposal(doc: EditDocument, suggestions: CutSuggestion[]): ProposalPreview {
  let document = doc;
  const blocked: ProposalPreview['blocked'] = [];
  const reviewed = new Set(doc.reviews.map((review) => review.suggestionId));

  for (const suggestion of suggestions) {
    if (suggestion.status !== 'pending' || reviewed.has(suggestion.id)) continue;
    const decision: Decision = {
      decisionId: `preview:${suggestion.id}`,
      command: {
        type: 'approveSuggestion',
        suggestionId: suggestion.id,
        takeId: suggestion.takeId,
        start: suggestion.start,
        end: suggestion.end,
        state: suggestion.state,
        modified: false,
        ...(suggestion.layer === 'direction'
          ? { layer: 'direction' as const, direction: suggestion.direction ?? undefined }
          : suggestion.layer === 'visual'
            ? { layer: 'visual' as const, visual: suggestion.visual ?? undefined }
            : {}),
      },
    };
    try {
      document = applyCommand(document, decision);
    } catch (error) {
      if (error instanceof EditRuleError) {
        blocked.push({ suggestionId: suggestion.id, code: error.code });
        continue;
      }
      throw error;
    }
  }

  return { document, blocked };
}
