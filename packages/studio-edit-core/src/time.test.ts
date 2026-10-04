import { describe, expect, it } from 'vitest';

import { sourceToTake, takeSpan, takeToSource, trackTimingFromCapture } from './sync';
import {
  FLICKS_PER_SECOND,
  formatClock,
  formatTimecode,
  frameTicks,
  frameToTicks,
  parseRate,
  snapToFrame,
  ticksFromMs,
  ticksToFrame,
} from './time';

const RATES = ['24000/1001', '24/1', '25/1', '30000/1001', '30/1', '50/1', '60000/1001', '60/1'];

describe('flicks', () => {
  it('divide exatamente os quadros das taxas comuns', () => {
    for (const text of RATES) {
      const rate = parseRate(text)!;
      expect((FLICKS_PER_SECOND * rate.den) % rate.num).toBe(0);
    }
  });

  it('ida e volta quadro → ticks → quadro é exata em uma hora de mídia', () => {
    for (const text of RATES) {
      const rate = parseRate(text)!;
      const lastFrame = Math.round((3600 * rate.num) / rate.den);
      for (const frame of [0, 1, 1799, 107892, lastFrame]) {
        expect(ticksToFrame(frameToTicks(frame, rate), rate)).toBe(frame);
      }
    }
  });

  it('lê taxas decimais NTSC como a fração exata', () => {
    expect(parseRate(29.97)).toEqual({ num: 30000, den: 1001 });
    expect(parseRate('23.976')).toEqual({ num: 24000, den: 1001 });
    expect(parseRate('25')).toEqual({ num: 25, den: 1 });
    expect(parseRate('0/0')).toBeNull();
    expect(parseRate('')).toBeNull();
  });

  it('arredonda para o quadro mais próximo', () => {
    const rate = parseRate('30/1')!;
    const frame = frameTicks(rate);
    expect(snapToFrame(frame * 10 + frame / 2 - 1, rate)).toBe(frame * 10);
    expect(snapToFrame(frame * 10 + frame / 2 + 1, rate)).toBe(frame * 11);
  });

  it('formata timecode e relógio', () => {
    const rate = parseRate('25/1')!;
    expect(formatTimecode(frameToTicks(25 * 61 + 3, rate), rate)).toBe('00:01:01:03');
    expect(formatClock(ticksFromMs(61_250))).toBe('1:01.250');
    expect(formatClock(ticksFromMs(3_725_004))).toBe('1:02:05.004');
  });
});

describe('sincronismo', () => {
  it('converte fonte ↔ take com offset e drift sem perder o instante', () => {
    const timing = { ...trackTimingFromCapture({ trackId: 1, startOffsetMs: 800, durationSeconds: 60 }), driftPpm: 40 };
    for (const seconds of [0, 1.5, 30, 59.99]) {
      const source = Math.round(seconds * FLICKS_PER_SECOND);
      expect(Math.abs(takeToSource(timing, sourceToTake(timing, source)) - source)).toBeLessThanOrEqual(1);
    }
    expect(sourceToTake({ ...timing, driftPpm: 0 }, 0)).toBe(ticksFromMs(800));
  });

  it('o take vai do começo da primeira fonte ao fim da última', () => {
    const span = takeSpan([
      trackTimingFromCapture({ trackId: 1, startOffsetMs: 0, durationSeconds: 10 }),
      trackTimingFromCapture({ trackId: 2, startOffsetMs: -500, durationSeconds: 9 }),
      trackTimingFromCapture({ trackId: 3, startOffsetMs: 800, durationSeconds: 10 }),
    ]);
    expect(span.start).toBe(ticksFromMs(-500));
    expect(span.end).toBe(ticksFromMs(10_800));
  });
});
