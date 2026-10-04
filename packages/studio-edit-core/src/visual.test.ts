import { describe, expect, it } from 'vitest';

import { isAutoApprovable, parseAutomationRules, pickSample, quickReviewOrder } from './automation';
import { applyCommand, type Decision, replay } from './commands';
import { createDocument, editDocumentSchema } from './document';
import { buildExportTimeline, buildXmeml, exportLimitations, type ExportTrack } from './export';
import { trackTimingFromCapture } from './sync';
import { parseRate, ticksFromMs } from './time';
import { zoomMotion } from './visual';

const s = (seconds: number) => ticksFromMs(seconds * 1000);
const base = () => createDocument([{ takeId: 1, start: 0, end: s(60) }], [1]);

describe('camada visual', () => {
  it('recusa elemento incompleto e aceita o completo', () => {
    expect(() =>
      applyCommand(base(), {
        decisionId: 'd1',
        command: { type: 'addVisual', elementId: 'v1', takeId: 1, start: s(1), end: s(4), visual: { kind: 'title' } },
      }),
    ).toThrow(/needs its text/);

    const doc = applyCommand(base(), {
      decisionId: 'd1',
      command: { type: 'addVisual', elementId: 'v1', takeId: 1, start: s(1), end: s(4), visual: { kind: 'title', text: 'Instalando o Prisma' } },
    });
    expect(doc.visual).toEqual([expect.objectContaining({ id: 'v1', kind: 'title', template: 'hcode-title', origin: 'manual' })]);
  });

  it('atualiza, remove e desfaz pelo histórico; sugestão visual aprovada vira elemento s<id>', () => {
    const decisions: Decision[] = [
      { decisionId: 'd1', command: { type: 'addVisual', elementId: 'v1', takeId: 1, start: s(1), end: s(4), visual: { kind: 'title', text: 'A' } } },
      { decisionId: 'd2', command: { type: 'updateVisual', elementId: 'v1', end: s(6) } },
      {
        decisionId: 'd3',
        command: {
          type: 'approveSuggestion',
          suggestionId: 9,
          layer: 'visual',
          visual: { kind: 'zoom', rect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
          takeId: 1,
          start: s(10),
          end: s(15),
          state: 'keep',
          modified: false,
        },
      },
    ];
    let { document } = replay(base(), decisions);
    expect(document.visual.map((element) => [element.id, element.end])).toEqual([
      ['v1', s(6)],
      ['s9', s(15)],
    ]);
    decisions.push({ decisionId: 'd4', command: { type: 'undo', decisionId: 'd3' } });
    decisions.push({ decisionId: 'd5', command: { type: 'removeVisual', elementId: 'v1' } });
    document = replay(base(), decisions).document;
    expect(document.visual).toEqual([]);
    expect(document.reviews).toEqual([]);
  });

  it('revisão gravada antes da camada visual continua válida', () => {
    const { visual: _ignored, ...legacy } = base();
    expect(editDocumentSchema.parse(legacy).visual).toEqual([]);
  });

  it('zoom leva o retângulo ao centro do quadro', () => {
    expect(zoomMotion({ x: 0.5, y: 0.5, w: 0.5, h: 0.5 }, 100)).toEqual({ scale: 200, centerX: -0.5, centerY: -0.5 });
    expect(zoomMotion({ x: 0.25, y: 0.25, w: 0.5, h: 0.5 }, 75)).toEqual({ scale: 150, centerX: 0, centerY: 0 });
  });
});

describe('exportação da camada visual', () => {
  const track = (trackId: number, kind: ExportTrack['kind'], sourceIndex: number): ExportTrack => ({
    trackId,
    takeId: 1,
    kind,
    sourceIndex,
    fileName: `${kind}-${trackId}`,
    hasVideo: kind !== 'microphone',
    hasAudio: kind === 'microphone',
    width: kind === 'microphone' ? null : 1920,
    height: kind === 'microphone' ? null : 1080,
    sampleRate: kind === 'microphone' ? 48000 : null,
    channels: kind === 'microphone' ? 1 : null,
    timing: trackTimingFromCapture({ trackId, startOffsetMs: 0, durationSeconds: 60 }),
  });
  const tracks = [track(10, 'screen', 0), track(11, 'camera', 1), track(13, 'microphone', 2)];

  it('zoom parte o clipe da tela no programa; título vira marcador com duração; corte deixa elemento de fora', () => {
    let doc = applyCommand(base(), {
      decisionId: 'd1',
      command: { type: 'addVisual', elementId: 'z', takeId: 1, start: s(10), end: s(20), visual: { kind: 'zoom', rect: { x: 0, y: 0, w: 0.5, h: 0.5 } } },
    });
    doc = applyCommand(doc, {
      decisionId: 'd2',
      command: { type: 'addVisual', elementId: 't', takeId: 1, start: s(30), end: s(34), visual: { kind: 'title', text: 'Rotas', subtitle: 'Express' } },
    });
    doc = applyCommand(doc, {
      decisionId: 'd3',
      command: { type: 'addVisual', elementId: 'gone', takeId: 1, start: s(41), end: s(43), visual: { kind: 'title', text: 'Some' } },
    });
    doc = applyCommand(doc, { decisionId: 'd4', command: { type: 'setCut', takeId: 1, start: s(40), end: s(45), state: 'remove' } });

    const timeline = buildExportTimeline({ name: 'x', document: doc, tracks, rate: parseRate('30')! });
    const program = timeline.lanes.find((lane) => lane.kind === 'program')!;
    expect(program.placements.map((p) => [p.sequenceStart, p.sequenceEnd, p.motion?.scale ?? 100])).toEqual([
      [0, 300, 100],
      [300, 600, 200],
      [600, 1200, 100],
      [1200, 1650, 100],
    ]);
    expect(program.placements[1]).toMatchObject({ sourceIn: 300, sourceOut: 600, motion: { centerX: 0.5, centerY: 0.5 } });

    expect(timeline.markers).toContainEqual({ frame: 900, endFrame: 1020, name: 'Título: Rotas', comment: 'Express — modelo hcode-title' });
    expect(timeline.orphanVisuals).toEqual(['gone']);
    const limitations = exportLimitations(timeline).join(' ');
    expect(limitations).toContain('marcadores com duração');
    expect(limitations).toContain('ficaram de fora');

    const xml = buildXmeml({ timeline, tracks, pathFor: (t) => `C:/x/${t.fileName}` });
    expect(xml).toContain('<in>900</in><out>1020</out>');
  });

  it('zoom medido noutra tela não mexe na tela do programa', () => {
    const zoomOn = (trackId: number) =>
      applyCommand(base(), {
        decisionId: 'd1',
        command: { type: 'addVisual', elementId: 'z', takeId: 1, start: s(10), end: s(20), visual: { kind: 'zoom', rect: { x: 0, y: 0, w: 0.5, h: 0.5 }, trackId } },
      });
    const scales = (doc: ReturnType<typeof base>) =>
      buildExportTimeline({ name: 'x', document: doc, tracks, rate: parseRate('30')! })
        .lanes.find((lane) => lane.kind === 'program')!
        .placements.map((p) => p.motion?.scale ?? 100);
    expect(zoomOn(10).visual[0]!.trackId).toBe(10);
    expect(scales(zoomOn(10))).toContain(200);
    expect(scales(zoomOn(99))).not.toContain(200);
    // Documento antigo, sem o campo: vale para qualquer tela.
    expect(editDocumentSchema.parse(JSON.parse(JSON.stringify({ ...base(), visual: [{ ...zoomOn(10).visual[0], trackId: undefined }] }))).visual[0]!.trackId).toBeNull();
  });
});

describe('automação', () => {
  const policy = { mode: 'controlled' as const, rules: parseAutomationRules('pauses:low, direction:medium, manual:high, nope:low'), samplePct: 10 };

  it('lê as regras e nunca autoriza proposta manual', () => {
    expect(policy.rules).toEqual([
      { kind: 'pauses', maxRisk: 'low' },
      { kind: 'direction', maxRisk: 'medium' },
    ]);
  });

  it('só aprova sozinho o que a política cobre, no modo controlado', () => {
    const suggestion = { kind: 'pauses' as const, risk: 'low' as const, status: 'pending' as const, origin: 'rule' as const };
    expect(isAutoApprovable(suggestion, policy)).toBe(true);
    expect(isAutoApprovable({ ...suggestion, risk: 'medium' }, policy)).toBe(false);
    expect(isAutoApprovable({ ...suggestion, kind: 'restart', origin: 'llm' }, policy)).toBe(false);
    expect(isAutoApprovable({ ...suggestion, status: 'approved' }, policy)).toBe(false);
    expect(isAutoApprovable(suggestion, { ...policy, mode: 'quick' })).toBe(false);
  });

  it('amostra determinística, com pelo menos uma', () => {
    const ids = Array.from({ length: 30 }, (_, i) => i + 1);
    expect(pickSample(ids, 10)).toHaveLength(3);
    expect(pickSample(ids, 10)).toEqual(pickSample([...ids].reverse(), 10));
    expect(pickSample([5], 1)).toEqual([5]);
    expect(pickSample([], 50)).toEqual([]);
  });

  it('revisão rápida começa pelo risco alto e pela incerteza', () => {
    const item = (id: number, risk: 'low' | 'medium' | 'high', certainty: string) => ({
      id,
      risk,
      takeId: 1,
      start: s(id),
      end: s(id + 1),
      evidence: { certainty },
    });
    expect(quickReviewOrder([item(1, 'low', 'high'), item(2, 'high', 'high'), item(3, 'medium', 'low'), item(4, 'medium', 'high')]).map((x) => x.id)).toEqual([
      2, 3, 4, 1,
    ]);
  });
});
