import type { MediaJobStatus } from './contracts';

/** Etapa que a tela nomeia enquanto espera. */
export type ProcessingStep = 'probe' | 'hash' | 'proxy' | 'waveform' | 'activity' | 'analysis';

/**
 * O que o usuário vê enquanto espera:
 * - `idle`: nada pedido ainda (sem trilha enviada);
 * - `queued`: na fila, com quem processa ligado;
 * - `starting`: na fila do proxy e a máquina de vídeo ainda desligada (o KEDA
 *   sobe o pool a partir de zero — leva alguns minutos);
 * - `running`: processando;
 * - `ready`: tudo pronto;
 * - `failed`: alguma etapa falhou e nada mais anda.
 */
export type ProcessingState = 'idle' | 'queued' | 'starting' | 'running' | 'ready' | 'failed';

export interface ProcessingItem {
  step: ProcessingStep;
  status: MediaJobStatus;
}

export interface ProcessingSummary {
  state: ProcessingState;
  /** Etapa em andamento (ou a primeira na fila), para o texto da animação. */
  step: ProcessingStep | null;
  done: number;
  total: number;
}

export interface RecordingProcessing extends ProcessingSummary {
  recordingId: number;
}

/** A ordem em que a preparação anda: a primeira etapa pendente é a que a tela nomeia. */
const STEP_ORDER: ProcessingStep[] = ['probe', 'hash', 'proxy', 'waveform', 'activity', 'analysis'];

const byOrder = (a: ProcessingItem, b: ProcessingItem) => STEP_ORDER.indexOf(a.step) - STEP_ORDER.indexOf(b.step);

/**
 * Resume as etapas de uma gravação (ou de um take) num estado só. Algo rodando
 * vence a falha de outra etapa — a tela ainda tem o que esperar.
 *
 * `videoWorkerOnline` é `false` só quando dá para afirmar que nenhuma máquina
 * consome a fila do proxy; `null` (não dá para saber, ex.: ambiente local) nunca
 * vira `starting`.
 */
export function summarizeProcessing(
  items: ProcessingItem[],
  videoWorkerOnline: boolean | null,
): ProcessingSummary {
  const relevant = items.filter((item) => item.status !== 'missing');
  const total = relevant.length;
  const done = relevant.filter((item) => item.status === 'ready').length;
  if (total === 0) return { state: 'idle', step: null, done: 0, total: 0 };

  const running = relevant.filter((item) => item.status === 'running').sort(byOrder);
  if (running.length > 0) return { state: 'running', step: running[0]!.step, done, total };

  const pending = relevant.filter((item) => item.status === 'pending').sort(byOrder);
  if (pending.length > 0) {
    const proxyWaiting = videoWorkerOnline === false && pending.some((item) => item.step === 'proxy');
    if (proxyWaiting) return { state: 'starting', step: 'proxy', done, total };
    return { state: 'queued', step: pending[0]!.step, done, total };
  }

  const failed = relevant.filter((item) => item.status === 'failed').sort(byOrder);
  if (failed.length > 0) return { state: 'failed', step: failed[0]!.step, done, total };
  return { state: 'ready', step: null, done, total };
}

/** Ainda há o que esperar: a tela anima e escuta o realtime. */
export function isProcessing(state: ProcessingState): boolean {
  return state === 'queued' || state === 'starting' || state === 'running';
}
