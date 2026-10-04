/**
 * Regras do relógio de reprodução multicâmera.
 *
 * Chamar `play()` em vários `<video>` não os mantém alinhados: cada decoder
 * anda no próprio ritmo e o desvio cresce. O player tem um relógio mestre (o
 * áudio monitorado, ou o tempo do sistema) e corrige cada vídeo escravo com
 * estas regras — puras, para serem testadas sem DOM e compartilhadas entre o
 * Desktop e o Admin.
 */

/** Abaixo disto o desvio é imperceptível e não vale mexer no decoder. */
export const DRIFT_TOLERANCE_SECONDS = 0.04;
/** Acima disto ajustar a velocidade demoraria demais: faz seek. */
export const DRIFT_SEEK_SECONDS = 0.25;
/** Quanto a velocidade pode se afastar da nominal para recuperar o desvio. */
export const DRIFT_MAX_RATE_DELTA = 0.05;

export type DriftAction =
  | { kind: 'none'; playbackRate: number }
  | { kind: 'nudge'; playbackRate: number }
  | { kind: 'seek'; to: number; playbackRate: number };

/**
 * Decide a correção de um vídeo escravo.
 *
 * `expected` e `actual` são posições no tempo da mídia (segundos) e `rate` a
 * velocidade escolhida pela pessoa. Desvio pequeno é ignorado; médio, a
 * velocidade sobe ou desce até 5 % (sem salto visível); grande, seek.
 */
export function driftAction(expected: number, actual: number, rate: number): DriftAction {
  const drift = actual - expected;
  const magnitude = Math.abs(drift);

  if (magnitude <= DRIFT_TOLERANCE_SECONDS) {
    return { kind: 'none', playbackRate: rate };
  }

  if (magnitude >= DRIFT_SEEK_SECONDS) {
    return { kind: 'seek', to: expected, playbackRate: rate };
  }

  // Proporcional ao desvio: recupera em ~1 s sem passar do teto.
  const delta = Math.min(DRIFT_MAX_RATE_DELTA, magnitude);
  return {
    kind: 'nudge',
    playbackRate: drift > 0 ? rate * (1 - delta) : rate * (1 + delta),
  };
}

/**
 * Onde o relógio está agora, dado o instante e a posição do último ancoramento.
 * O relógio de software anda com `performance.now()`; quando há áudio mestre,
 * o chamador ancora de novo a cada leitura do `currentTime` dele.
 */
export function clockPosition(input: {
  anchorPosition: number;
  anchorWallSeconds: number;
  nowWallSeconds: number;
  rate: number;
  playing: boolean;
}): number {
  if (!input.playing) return input.anchorPosition;
  return input.anchorPosition + (input.nowWallSeconds - input.anchorWallSeconds) * input.rate;
}
