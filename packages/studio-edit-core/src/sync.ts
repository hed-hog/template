import { type Ticks, ticksFromMs } from './time';

/**
 * Posição de uma trilha (um arquivo) dentro do tempo comum do take.
 *
 * O zero do take é o início da trilha de referência. `offsetTicks` é onde o
 * primeiro quadro desta trilha cai nesse tempo — positivo quando ela começou
 * depois da referência —, o mesmo sentido do `start_offset_ms` que o Desktop
 * mede pela parada comum. `driftPpm` modela o relógio de um dispositivo que
 * anda um pouco mais rápido ou mais devagar que o da referência; a captura
 * ainda não mede drift, então ele nasce zero.
 */
export interface TrackTiming {
  trackId: number;
  offsetTicks: Ticks;
  driftPpm: number;
  /** Duração do arquivo no tempo da própria fonte. */
  durationTicks: Ticks;
}

export function trackTimingFromCapture(input: {
  trackId: number;
  startOffsetMs: number | null | undefined;
  durationSeconds: number | null | undefined;
  driftPpm?: number;
}): TrackTiming {
  return {
    trackId: input.trackId,
    offsetTicks: ticksFromMs(input.startOffsetMs ?? 0),
    driftPpm: input.driftPpm ?? 0,
    durationTicks: Math.round((input.durationSeconds ?? 0) * 705_600_000),
  };
}

function scale(timing: TrackTiming): number {
  return 1 + timing.driftPpm / 1_000_000;
}

/** Tempo da fonte → tempo do take. */
export function sourceToTake(timing: TrackTiming, sourceTicks: Ticks): Ticks {
  return Math.round(sourceTicks * scale(timing)) + timing.offsetTicks;
}

/** Tempo do take → tempo da fonte (pode cair fora do arquivo; ver `isInsideSource`). */
export function takeToSource(timing: TrackTiming, takeTicks: Ticks): Ticks {
  return Math.round((takeTicks - timing.offsetTicks) / scale(timing));
}

export function isInsideSource(timing: TrackTiming, takeTicks: Ticks): boolean {
  const source = takeToSource(timing, takeTicks);
  return source >= 0 && source < timing.durationTicks;
}

/** Intervalo do take coberto pela trilha. */
export function trackSpanInTake(timing: TrackTiming): { start: Ticks; end: Ticks } {
  return {
    start: sourceToTake(timing, 0),
    end: sourceToTake(timing, timing.durationTicks),
  };
}

/**
 * Duração do take: do começo da primeira trilha (às vezes negativo, quando uma
 * fonte começou antes da referência) até o fim da última. Fontes que terminam
 * em momentos diferentes não encurtam o take — quem acabou antes simplesmente
 * não tem mídia no final.
 */
export function takeSpan(timings: TrackTiming[]): { start: Ticks; end: Ticks } {
  if (timings.length === 0) return { start: 0, end: 0 };
  let start = Number.POSITIVE_INFINITY;
  let end = Number.NEGATIVE_INFINITY;
  for (const timing of timings) {
    const span = trackSpanInTake(timing);
    start = Math.min(start, span.start);
    end = Math.max(end, span.end);
  }
  return { start: Math.min(0, start), end: Math.max(0, end) };
}
