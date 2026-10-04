/**
 * Tempo da Ilha de Edição.
 *
 * Toda posição editorial é um inteiro em flicks (1/705 600 000 s). O número
 * divide exatamente os quadros de 23.976, 24, 25, 29.97, 30, 48, 50, 59.94 e
 * 60 fps e as amostras de 48 kHz, então converter um corte de quadro para
 * flicks e de volta nunca acumula erro — ao contrário de segundos em ponto
 * flutuante, que derivam a cada soma.
 *
 * Ticks são `number`, não `bigint`: 2^53 flicks dão 147 dias de mídia, folga
 * de sobra para um take, e o valor atravessa JSON, jsonb e React sem
 * serialização especial. Toda conta que poderia passar de 2^53 (tick × taxa)
 * divide antes de multiplicar.
 */

export const FLICKS_PER_SECOND = 705_600_000;
export const FLICKS_PER_MS = 705_600;

/** Instante ou duração em flicks. Sempre inteiro. */
export type Ticks = number;

/** Taxa racional, como o ffprobe entrega (`30000/1001`). */
export interface Rational {
  num: number;
  den: number;
}

export function isTicks(value: unknown): value is Ticks {
  return typeof value === 'number' && Number.isSafeInteger(value);
}

export function ticksFromSeconds(seconds: number): Ticks {
  return Math.round(seconds * FLICKS_PER_SECOND);
}

export function ticksFromMs(ms: number): Ticks {
  return Math.round(ms * FLICKS_PER_MS);
}

export function ticksToSeconds(ticks: Ticks): number {
  return ticks / FLICKS_PER_SECOND;
}

export function ticksToMs(ticks: Ticks): number {
  return ticks / FLICKS_PER_MS;
}

/**
 * Lê uma taxa no formato do ffprobe (`30000/1001`, `25/1`, `25`) ou um número
 * decimal. Taxas NTSC escritas como decimal (29.97, 23.976, 59.94) viram a
 * fração exata, porque é isso que o arquivo realmente tem.
 */
export function parseRate(value: string | number | null | undefined): Rational | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return null;
    return rationalFromDecimal(value);
  }

  const text = value.trim();
  if (!text) return null;

  const slash = text.indexOf('/');
  if (slash >= 0) {
    const num = Number(text.slice(0, slash));
    const den = Number(text.slice(slash + 1));
    if (!Number.isFinite(num) || !Number.isFinite(den) || num <= 0 || den <= 0) {
      return null;
    }
    return reduce({ num, den });
  }

  const decimal = Number(text);
  if (!Number.isFinite(decimal) || decimal <= 0) return null;
  return rationalFromDecimal(decimal);
}

const NTSC_RATES: Array<[number, Rational]> = [
  [23.976, { num: 24000, den: 1001 }],
  [29.97, { num: 30000, den: 1001 }],
  [47.952, { num: 48000, den: 1001 }],
  [59.94, { num: 60000, den: 1001 }],
];

function rationalFromDecimal(value: number): Rational {
  for (const [approx, exact] of NTSC_RATES) {
    if (Math.abs(value - approx) < 0.005) return exact;
  }
  if (Number.isInteger(value)) return { num: value, den: 1 };
  return reduce({ num: Math.round(value * 1000), den: 1000 });
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) {
    [x, y] = [y, x % y];
  }
  return x || 1;
}

function reduce(rate: Rational): Rational {
  const divisor = gcd(rate.num, rate.den);
  return { num: rate.num / divisor, den: rate.den / divisor };
}

export function rateToNumber(rate: Rational): number {
  return rate.num / rate.den;
}

/** Duração de um quadro em flicks (exata nas taxas comuns, arredondada nas demais). */
export function frameTicks(rate: Rational): Ticks {
  return Math.round((FLICKS_PER_SECOND / rate.num) * rate.den);
}

/** Quadro que contém o instante (índice a partir de zero). */
export function ticksToFrame(ticks: Ticks, rate: Rational): number {
  return Math.floor(ticks / frameTicks(rate));
}

/** Início do quadro `frame`. */
export function frameToTicks(frame: number, rate: Rational): Ticks {
  return frame * frameTicks(rate);
}

/**
 * Arredonda para a fronteira de quadro mais próxima. É a única regra de
 * arredondamento do sistema: a prévia e a exportação passam por aqui, para que
 * um corte nunca caia num quadro na tela e no vizinho no Premiere.
 */
export function snapToFrame(ticks: Ticks, rate: Rational): Ticks {
  const step = frameTicks(rate);
  return Math.round(ticks / step) * step;
}

/** Quadro mais próximo, como inteiro — o que o xmeml grava. */
export function ticksToNearestFrame(ticks: Ticks, rate: Rational): number {
  return Math.round(ticks / frameTicks(rate));
}

/** `HH:MM:SS:FF` sem drop-frame. */
export function formatTimecode(ticks: Ticks, rate: Rational): string {
  const negative = ticks < 0;
  const fps = Math.round(rateToNumber(rate));
  const totalFrames = ticksToNearestFrame(Math.abs(ticks), rate);
  const frames = totalFrames % fps;
  const totalSeconds = Math.floor(totalFrames / fps);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${negative ? '-' : ''}${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

/** `M:SS.mmm` ou `H:MM:SS.mmm` — rótulo de régua e de lista. */
export function formatClock(ticks: Ticks): string {
  const negative = ticks < 0;
  const totalMs = Math.round(Math.abs(ticksToMs(ticks)));
  const ms = totalMs % 1000;
  const totalSeconds = Math.floor(totalMs / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number, size = 2) => String(n).padStart(size, '0');
  const body =
    hours > 0
      ? `${hours}:${pad(minutes)}:${pad(seconds)}.${pad(ms, 3)}`
      : `${minutes}:${pad(seconds)}.${pad(ms, 3)}`;
  return negative ? `-${body}` : body;
}
