import { describe, expect, it } from 'vitest';

import { applyCommand } from './commands';
import { createDocument } from './document';
import { buildExportTimeline, buildXmeml, type ExportTrack, stableStringify, toPathUrl } from './export';
import { driftAction } from './playback';
import { trackTimingFromCapture } from './sync';
import { parseRate, ticksFromMs } from './time';

const s = (seconds: number) => ticksFromMs(seconds * 1000);

function track(partial: Partial<ExportTrack> & Pick<ExportTrack, 'trackId' | 'kind'>, offsetMs = 0, seconds = 60): ExportTrack {
  const isVideo = partial.kind === 'screen' || partial.kind === 'camera';
  return {
    takeId: 1,
    sourceIndex: 0,
    fileName: `${partial.kind}-${partial.trackId}.${isVideo ? 'mkv' : 'wav'}`,
    hasVideo: isVideo,
    hasAudio: !isVideo,
    width: isVideo ? 1920 : null,
    height: isVideo ? 1080 : null,
    sampleRate: isVideo ? null : 48000,
    channels: isVideo ? null : 1,
    timing: trackTimingFromCapture({ trackId: partial.trackId, startOffsetMs: offsetMs, durationSeconds: seconds }),
    ...partial,
  };
}

describe('timeline de exportação', () => {
  const tracks = [
    track({ trackId: 10, kind: 'screen' }),
    track({ trackId: 11, kind: 'camera' }, 800, 59),
    track({ trackId: 12, kind: 'microphone' }, -500, 61),
  ];

  const doc = applyCommand(createDocument([{ takeId: 1, start: s(-0.5), end: s(60.5) }], [1]), {
    decisionId: 'd1',
    command: { type: 'setCut', takeId: 1, start: s(10), end: s(20), state: 'remove' },
  });

  it('todas as fontes de um trecho têm a mesma duração em quadros e a fonte certa', () => {
    const rate = parseRate('30/1')!;
    const timeline = buildExportTimeline({ name: 'Aula 1', document: doc, tracks, rate });

    expect(timeline.lanes.map((lane) => lane.key)).toEqual([
      'video:camera:0',
      'video:screen:0',
      'video:program',
      'video:pip',
      'audio:microphone:0',
    ]);
    // Sem direção decidida vale o padrão (tela com PIP): as fontes brutas ficam
    // desligadas por baixo e o programa mostra a tela.
    expect(timeline.lanes.filter((lane) => !lane.enabled).map((lane) => lane.key)).toEqual([
      'video:camera:0',
      'video:screen:0',
    ]);
    expect(timeline.lanes.find((lane) => lane.kind === 'program')!.placements.every((p) => p.trackId === 10)).toBe(true);
    expect(timeline.lanes.find((lane) => lane.kind === 'pip')!.placements[0]).toMatchObject({ trackId: 11, mask: 'circle' });

    const screen = timeline.lanes.find((lane) => lane.kind === 'screen')!;
    const mic = timeline.lanes.find((lane) => lane.kind === 'microphone')!;
    // A tela começa no zero do take, que é 0,5 s depois do começo da montagem.
    expect(screen.placements[0]).toMatchObject({ sequenceStart: 15, sourceIn: 0 });
    // O microfone começou 0,5 s antes: no zero do take ele já está em 15 quadros.
    expect(mic.placements[0]).toMatchObject({ sequenceStart: 0, sourceIn: 0 });

    // Depois do corte, todas as fontes retomam no mesmo quadro da sequência
    // e no instante 20 s do take — cada uma no seu próprio ponto da fonte.
    const afterCut = (laneKind: string) =>
      timeline.lanes.find((lane) => lane.kind === laneKind)!.placements.at(-1)!;
    expect(afterCut('screen').sequenceStart).toBe(afterCut('microphone').sequenceStart);
    expect(afterCut('screen').sourceIn).toBe(600);
    expect(afterCut('microphone').sourceIn).toBe(615);
    expect(afterCut('camera').sourceIn).toBe(576);

    for (const lane of timeline.lanes) {
      for (const placement of lane.placements) {
        expect(placement.sourceOut - placement.sourceIn).toBe(placement.sequenceEnd - placement.sequenceStart);
      }
    }
  });

  it('gera um xmeml com um arquivo por trilha e caminhos file://localhost', () => {
    const rate = parseRate('30000/1001')!;
    const timeline = buildExportTimeline({ name: 'Aula & teste', document: doc, tracks, rate });
    const xml = buildXmeml({ timeline, tracks, pathFor: (t) => `C:\\Edição\\${t.fileName}` });

    expect(xml).toContain('<xmeml version="4">');
    expect(xml).toContain('<name>Aula &amp; teste</name>');
    expect(xml).toContain('<ntsc>TRUE</ntsc>');
    expect(xml.match(/<file id="file-10">/g)).toHaveLength(1);
    // Tela bruta (2 trechos) + programa (2 trechos): declarada uma vez, citada 3.
    expect(xml.match(/<file id="file-10"\/>/g)).toHaveLength(3);
    expect(xml).toContain('<effectid>basic</effectid>');
    expect(xml).toContain('file://localhost/C%3A/Edi%C3%A7%C3%A3o/screen-10.mkv');
    expect(xml).toContain('<mediatype>audio</mediatype>');
  });

  it('caminhos de rede e com espaços viram URL válida', () => {
    expect(toPathUrl('D:\\Aulas\\Curso 1\\a.wav')).toBe('file://localhost/D%3A/Aulas/Curso%201/a.wav');
  });
});

describe('stableStringify', () => {
  it('independe da ordem das chaves', () => {
    expect(stableStringify({ b: 1, a: [1, { d: 2, c: 3 }] })).toBe(stableStringify({ a: [1, { c: 3, d: 2 }], b: 1 }));
  });
});

describe('driftAction', () => {
  it('ignora, ajusta a velocidade ou faz seek conforme o desvio', () => {
    expect(driftAction(10, 10.02, 1).kind).toBe('none');
    const nudge = driftAction(10, 10.1, 1);
    expect(nudge.kind).toBe('nudge');
    expect(nudge.playbackRate).toBeLessThan(1);
    expect(driftAction(10, 9.9, 1).playbackRate).toBeGreaterThan(1);
    expect(driftAction(10, 10.5, 1)).toEqual({ kind: 'seek', to: 10, playbackRate: 1 });
  });
});
