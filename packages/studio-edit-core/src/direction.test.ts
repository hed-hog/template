import { describe, expect, it } from 'vitest';

import { applyCommand, type Decision, replay } from './commands';
import {
  directionDefaultsFrom,
  FACTORY_DIRECTION_DEFAULTS,
  type DirectionSource,
  resolveDirection,
  resolveScope,
} from './direction';
import { createDocument, directionOfTake, editDocumentSchema } from './document';
import { buildExportTimeline, exportLimitations, type ExportTrack } from './export';
import { trackTimingFromCapture } from './sync';
import { parseRate, ticksFromMs } from './time';

const s = (seconds: number) => ticksFromMs(seconds * 1000);

const sources: DirectionSource[] = [
  { trackId: 10, kind: 'screen', userId: 1, sourceIndex: 0 },
  { trackId: 11, kind: 'camera', userId: 1, sourceIndex: 1 },
  { trackId: 12, kind: 'camera', userId: 2, sourceIndex: 2 },
];

const pip = { trackId: 12, x: 0.1, y: 0.15, size: 0.3, shape: 'circle' as const, border: { width: 0, color: '#ffffff' } };

describe('resolveDirection', () => {
  it('auto vira tela com PIP da primeira câmera', () => {
    expect(resolveDirection({ layout: 'auto', primaryTrackId: null, secondaryTrackId: null, pip: null }, sources)).toMatchObject({
      layout: 'screen_pip',
      primaryTrackId: 10,
      pip: { trackId: 11, ...FACTORY_DIRECTION_DEFAULTS.pip },
    });
  });

  it('cai para o que existe quando a fonte escolhida falta', () => {
    const onlyCamera = sources.filter((source) => source.kind === 'camera').slice(0, 1);
    expect(resolveDirection({ layout: 'screen_pip', primaryTrackId: 10, secondaryTrackId: null, pip }, onlyCamera).layout).toBe('camera');
    expect(resolveDirection({ layout: 'two_up', primaryTrackId: 11, secondaryTrackId: 99, pip: null }, sources)).toMatchObject({
      layout: 'two_up',
      primaryTrackId: 11,
      secondaryTrackId: 12,
    });
    expect(resolveDirection({ layout: 'two_up', primaryTrackId: 11, secondaryTrackId: null, pip: null }, sources.slice(0, 2)).layout).toBe('camera');
    expect(resolveDirection({ layout: 'auto', primaryTrackId: null, secondaryTrackId: null, pip: null }, sources, {
      ...FACTORY_DIRECTION_DEFAULTS,
      allowedLayouts: ['screen', 'camera'],
    }).layout).toBe('screen');
  });
});

describe('comandos de direção', () => {
  const base = () => createDocument([{ takeId: 1, start: 0, end: s(60) }], [1]);

  it('setDirection muda só o intervalo, e setPip em trecho auto decide PIP', () => {
    let doc = applyCommand(base(), {
      decisionId: 'd1',
      command: { type: 'setDirection', takeId: 1, start: s(10), end: s(20), direction: { layout: 'camera', primaryTrackId: 11 } },
    });
    expect(directionOfTake(doc, 1).map((segment) => [segment.layout, segment.start, segment.end])).toEqual([
      ['auto', 0, s(10)],
      ['camera', s(10), s(20)],
      ['auto', s(20), s(60)],
    ]);

    doc = applyCommand(doc, { decisionId: 'd2', command: { type: 'setPip', takeId: 1, start: s(30), end: s(40), pip } });
    expect(directionOfTake(doc, 1).find((segment) => segment.start === s(30))).toMatchObject({ layout: 'screen_pip', pip });
  });

  it('aprovar sugestão de direção aplica o layout dela e desfazer volta ao auto', () => {
    const decisions: Decision[] = [
      {
        decisionId: 'd1',
        command: {
          type: 'approveSuggestion',
          suggestionId: 4,
          layer: 'direction',
          direction: { layout: 'two_up', primaryTrackId: 11, secondaryTrackId: 12 },
          takeId: 1,
          start: s(5),
          end: s(15),
          state: 'keep',
          modified: false,
        },
      },
    ];
    let { document } = replay(base(), decisions);
    expect(directionOfTake(document, 1)[1]).toMatchObject({ layout: 'two_up', origin: 'suggestion', suggestionId: 4 });
    expect(document.reviews).toHaveLength(1);

    decisions.push({ decisionId: 'd2', command: { type: 'undo', decisionId: 'd1' } });
    document = replay(base(), decisions).document;
    expect(directionOfTake(document, 1)).toHaveLength(1);
    expect(directionOfTake(document, 1)[0]!.layout).toBe('auto');
  });

  it('revisão gravada antes da direção continua válida e vale como auto', () => {
    const { direction: _ignored, ...legacy } = base();
    const parsed = editDocumentSchema.parse(legacy);
    expect(parsed.direction).toEqual([]);
    expect(directionOfTake(parsed, 1)).toEqual([expect.objectContaining({ layout: 'auto', start: 0, end: s(60) })]);
  });
});

describe('resolveScope', () => {
  const direction = [
    { takeId: 1, start: 0, end: s(10), layout: 'auto' as const, primaryTrackId: null, secondaryTrackId: null, pip: null, origin: 'default' as const, suggestionId: null, decisionId: null },
    { takeId: 1, start: s(10), end: s(30), layout: 'camera' as const, primaryTrackId: 11, secondaryTrackId: null, pip: null, origin: 'manual' as const, suggestionId: null, decisionId: 'd' },
  ];
  const take = { start: 0, end: s(60) };

  it('cada alcance devolve o intervalo explícito', () => {
    const common = { at: s(12), take, direction, cutBoundaries: [s(15), s(40)] };
    expect(resolveScope({ ...common, scope: 'currentDecision' })).toEqual({ start: s(10), end: s(30) });
    expect(resolveScope({ ...common, scope: 'untilNextCut' })).toEqual({ start: s(12), end: s(15) });
    expect(resolveScope({ ...common, scope: 'wholeTake' })).toEqual(take);
    expect(resolveScope({ ...common, scope: 'selection', selection: { start: s(1), end: s(2) } })).toEqual({ start: s(1), end: s(2) });
    expect(resolveScope({ ...common, scope: 'selection', selection: null })).toBeNull();
  });
});

describe('exportação com direção', () => {
  const track = (trackId: number, kind: ExportTrack['kind'], sourceIndex: number): ExportTrack => {
    const video = kind === 'screen' || kind === 'camera';
    return {
      trackId,
      takeId: 1,
      kind,
      sourceIndex,
      fileName: `${kind}-${trackId}`,
      hasVideo: video,
      hasAudio: !video,
      width: video ? 1920 : null,
      height: video ? 1080 : null,
      sampleRate: video ? null : 48000,
      channels: video ? null : 1,
      timing: trackTimingFromCapture({ trackId, startOffsetMs: 0, durationSeconds: 60 }),
    };
  };
  const tracks = [track(10, 'screen', 0), track(11, 'camera', 1), track(12, 'camera', 2), track(13, 'microphone', 3)];

  it('lado a lado põe as duas câmeras em meia largura e o PIP vai com escala, posição e limitação declarada', () => {
    let doc = createDocument([{ takeId: 1, start: 0, end: s(60) }], [1]);
    doc = applyCommand(doc, {
      decisionId: 'd1',
      command: { type: 'setDirection', takeId: 1, start: s(10), end: s(20), direction: { layout: 'two_up', primaryTrackId: 11, secondaryTrackId: 12 } },
    });
    doc = applyCommand(doc, { decisionId: 'd2', command: { type: 'setPip', takeId: 1, start: s(30), end: s(40), pip } });
    const timeline = buildExportTimeline({ name: 'x', document: doc, tracks, rate: parseRate('30')! });

    const programB = timeline.lanes.find((lane) => lane.kind === 'program_b')!;
    expect(programB.placements).toEqual([expect.objectContaining({ trackId: 12, sequenceStart: 300, motion: { scale: 50, centerX: 0.25, centerY: 0 } })]);
    const program = timeline.lanes.find((lane) => lane.kind === 'program')!;
    expect(program.placements.find((p) => p.sequenceStart === 300)).toMatchObject({ trackId: 11, motion: { centerX: -0.25 } });

    const pipPlacement = timeline.lanes.find((lane) => lane.kind === 'pip')!.placements.find((p) => p.sequenceStart === 900)!;
    expect(pipPlacement).toMatchObject({ trackId: 12, mask: 'circle', motion: { scale: 30, centerX: -0.4, centerY: -0.35 } });
    expect(exportLimitations(timeline).join(' ')).toContain('recorte (círculo');
  });
});

describe('padrões e PIP quadrado', () => {
  it('directionDefaultsFrom põe o PIP no canto pedido com a margem', () => {
    const defaults = directionDefaultsFrom({ allowedLayouts: [], sizePct: 24, corner: 'tl', marginPct: 3, border: { width: 2, color: '#000000' } });
    expect(defaults.allowedLayouts).toEqual(FACTORY_DIRECTION_DEFAULTS.allowedLayouts);
    expect(defaults.pip).toMatchObject({ size: 0.24, y: 0.15, shape: 'circle', border: { width: 2, color: '#000000' } });
    expect(defaults.pip.x).toBeCloseTo(0.03 / (16 / 9) + 0.12 / (16 / 9), 4);
  });

  it('PIP quadrado também é recorte e vai para o relatório', () => {
    const square = { ...pip, shape: 'square' as const };
    let doc = createDocument([{ takeId: 1, start: 0, end: s(60) }], [1]);
    doc = applyCommand(doc, { decisionId: 'd1', command: { type: 'setPip', takeId: 1, start: 0, end: s(10), pip: square } });
    const tracks: ExportTrack[] = [10, 12].map((trackId, index) => ({
      trackId, takeId: 1, kind: index === 0 ? 'screen' : 'camera', sourceIndex: index, fileName: 'f' + trackId,
      hasVideo: true, hasAudio: false, width: 1920, height: 1080, sampleRate: null, channels: null,
      timing: trackTimingFromCapture({ trackId, startOffsetMs: 0, durationSeconds: 60 }),
    }));
    const timeline = buildExportTimeline({ name: 'x', document: doc, tracks, rate: parseRate('30')! });
    expect(timeline.lanes.find((lane) => lane.kind === 'pip')!.placements[0]!.mask).toBe('square');
    expect(exportLimitations(timeline).join(' ')).toContain('quadrado');
  });
});
