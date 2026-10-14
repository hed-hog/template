import { z } from 'zod';

import { commandSchema } from './commands';
import type { AutomationMode, AutomationRule } from './automation';
import type { DirectionDefaults, DirectionSpec } from './direction';
import type { VisualSpec } from './visual';
import type { EditDocument } from './document';
import type { ProcessingSummary } from './processing';
import type { ExportTimeline, ExportTrack, PackageManifest, TrackKind } from './export';
import { type TrackTiming, trackTimingFromCapture } from './sync';
import type { TranscriptWord } from './transcript';

/**
 * Contratos da API `/studio-edit`, compartilhados pelo Desktop e pelo Admin.
 * Os dois montam a mesma tela sobre as mesmas respostas — divergir aqui é o
 * caminho para duas montagens diferentes da mesma gravação.
 */

/** Estado de um derivado (proxy, forma de onda...). */
export type MediaJobStatus = 'missing' | 'pending' | 'running' | 'ready' | 'failed';

export interface ReviewTrack {
  id: number;
  kind: TrackKind;
  sourceIndex: number;
  /** Quem gravou a fonte (a máquina/instrutor) — liga microfone, câmera e tela da mesma pessoa. */
  userId: number | null;
  /** Nome de quem gravou, para o badge da fonte; nulo sem usuário vinculado. */
  userName?: string | null;
  /** Nome da máquina que gravou (hostname do desktop), quando conhecido. */
  machineName?: string | null;
  deviceLabel: string | null;
  fileName: string | null;
  codec?: string | null;
  droppedFrames?: number | null;
  uploadStatus: string;
  startOffsetMs: number;
  durationSeconds: number | null;
  /** Duração medida pelo servidor (ffprobe), em flicks; vence `durationSeconds` quando existe. */
  durationTicks: number | null;
  frameRate: number | null;
  width: number | null;
  height: number | null;
  sampleRate: number | null;
  channels: number | null;
  sizeBytes: number | null;
  /**
   * O arquivo tem faixa de áudio, segundo o ffprobe; nulo enquanto a sondagem
   * não terminou. É o que põe uma tela ou câmera com som na lista de áudios.
   */
  hasAudio?: boolean | null;
  media: {
    probe: MediaJobStatus;
    proxy: MediaJobStatus;
    waveform: MediaJobStatus;
    hash: MediaJobStatus;
    isVfr: boolean | null;
    sha256: string | null;
    error: string | null;
  };
}

/**
 * Posição da trilha no take como o servidor a calcula: a duração medida pelo
 * ffprobe vence a declarada pelo desktop. Desktop, Admin e exportação usam a
 * mesma regra, para a prévia e o pacote não divergirem.
 */
export function timingOfReviewTrack(track: ReviewTrack): TrackTiming {
  const timing = trackTimingFromCapture({
    trackId: track.id,
    startOffsetMs: track.startOffsetMs,
    durationSeconds: track.durationSeconds,
  });
  return track.durationTicks !== null && track.durationTicks !== undefined
    ? { ...timing, durationTicks: track.durationTicks }
    : timing;
}

export interface ReviewTake {
  id: number;
  index: number;
  label: string | null;
  status: string;
  durationSeconds: number | null;
  syncConfidence: string | null;
  isSelected: boolean;
  tracks: ReviewTrack[];
  analysis: {
    pauses: MediaJobStatus;
    transcription: MediaJobStatus;
    llm: MediaJobStatus;
    direction: MediaJobStatus;
    visual: MediaJobStatus;
    error: string | null;
  };
  /** Eventos do editor, terminal e preview do HedHog (Aula Editor), no tempo do take. */
  events: TakeEvent[];
  /** Marcadores feitos durante a gravação (atalho no desktop), no tempo do take. */
  recordingMarkers: RecordingMarker[];
  /** Execuções de análise do take, a mais recente primeiro — base da comparação entre execuções. */
  analysisRuns: AnalysisRunSummary[];
  /** Preparação e análises do take num estado só: o que a tela anima enquanto espera. */
  processing: ProcessingSummary;
}

export interface AnalysisRunSummary {
  id: number;
  kind: 'pauses' | 'llm_cuts' | 'direction' | 'visual';
  status: MediaJobStatus;
  createdAt: string;
  finishedAt: string | null;
  /** Resumo do resultado (ex.: { suggestions, rejected }). */
  result: Record<string, unknown> | null;
  error: string | null;
}

export type RecordingMarkerKind = 'error' | 'retry' | 'topic' | 'protect' | 'note';

export interface RecordingMarker {
  id: number;
  kind: RecordingMarkerKind;
  /** Tempo do take, em flicks. */
  at: number;
  text: string | null;
  userName: string | null;
}

export interface ReviewRecording {
  id: number;
  name: string;
  slug: string;
  status: string;
  takes: ReviewTake[];
  /** Todos os takes juntos. */
  processing: ProcessingSummary;
}

export type SuggestionStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'deferred'
  | 'superseded'
  | 'conflict';

/**
 * O que produziu a sugestão: `pauses` (regra de silêncio), `restart`,
 * `repetition`, `alternative` e `offtopic` (LLM sobre a transcrição) ou
 * `manual` (alguém propôs pela transcrição ou pela timeline).
 */
export type SuggestionKind =
  | 'pauses'
  | 'restart'
  | 'repetition'
  | 'alternative'
  | 'offtopic'
  | 'manual'
  | 'direction'
  | 'visual';

export interface ReviewSuggestion {
  id: number;
  kind: SuggestionKind;
  analysisRunId: number | null;
  takeId: number;
  layer: 'cut' | 'direction' | 'visual';
  /** Só nas sugestões de direção: o layout proposto para o trecho. */
  direction: DirectionSpec | null;
  /** Só nas sugestões visuais: o elemento proposto. */
  visual: VisualSpec | null;
  /**
   * Aprovada pela política de automação (e não por uma pessoa). `sample` = foi
   * sorteada para conferência humana.
   */
  automation: { policy: string; sample: boolean } | null;
  start: number;
  end: number;
  state: 'keep' | 'remove';
  origin: 'rule' | 'llm' | 'manual' | 'marker';
  risk: 'low' | 'medium' | 'high';
  rationale: string;
  evidence: Record<string, unknown>;
  status: SuggestionStatus;
  createdAt: string;
}

export interface ReviewDecision {
  decisionId: string;
  revision: number;
  /** Mesmo id para todas as decisões enviadas juntas (um lote desfaz junto). */
  clientCommandId: string;
  batch: { criteria: Record<string, unknown>; count: number; removedMs: number } | null;
  command: z.infer<typeof commandSchema>;
  userId: number | null;
  userName: string | null;
  createdAt: string;
}

export interface ProjectState {
  projectId: number;
  recordingId: number;
  revision: number;
  approvedRevision: number | null;
  document: EditDocument;
  suggestions: ReviewSuggestion[];
  decisions: ReviewDecision[];
  /**
   * Como o servidor resolve os trechos `auto` agora (PIP padrão e layouts
   * permitidos, das settings). A prévia usa o mesmo valor que a exportação.
   */
  directionDefaults: DirectionDefaults;
  automation: {
    mode: AutomationMode;
    rules: AutomationRule[];
    samplePct: number;
    /**
     * Houve aprovação automática depois da última revisão aprovada: aprovar a
     * próxima exige a checagem final explícita (`finalCheck: true`).
     */
    finalCheckRequired: boolean;
  };
}

/** Corpo de `POST /studio-edit/projects/:id/commands`. */
export const commandRequestSchema = z.object({
  baseRevision: z.number().int().nonnegative(),
  /** Gerado pelo cliente; reenviar o mesmo id devolve a mesma revisão. */
  clientCommandId: z.string().min(8).max(64),
  commands: z.array(commandSchema).min(1).max(500),
  /**
   * Aprovação em lote: os critérios usados e o resumo que a pessoa viu antes de
   * confirmar. Fica gravado em cada decisão do lote, e o lote inteiro se desfaz
   * com um pedido só (um `undo` por decisão).
   */
  batch: z
    .object({
      criteria: z.record(z.unknown()),
      count: z.number().int().nonnegative(),
      removedMs: z.number().nonnegative(),
    })
    .optional(),
});
export type CommandRequest = z.infer<typeof commandRequestSchema>;

/** 409 de `POST /commands`: a revisão andou e os comandos tocam o mesmo trecho. */
export interface RevisionConflict {
  code: 'revision_conflict';
  currentRevision: number;
  conflictingDecisionIds: string[];
}

export interface MediaSource {
  url: string;
  expiresAt: string;
}

/** Resposta de `GET /studio-edit/tracks/:id/sources`. */
export interface TrackSources {
  trackId: number;
  original: MediaSource | null;
  proxy: MediaSource | null;
  proxySmall: MediaSource | null;
  /** Áudio embutido de um vídeo, extraído em AAC; nulo quando o vídeo não tem som. */
  audio?: MediaSource | null;
  waveform: MediaSource | null;
  /** Só em telas: atividade por região (JSON `ScreenActivity`). */
  activity: MediaSource | null;
}

/** Onde e quando a tela muda: fração de pixels alterados por amostra (0..1). */
export interface ScreenActivity {
  /** Amostras por segundo, no tempo do arquivo da tela. */
  rate: number;
  overall: number[];
  regions: { tl: number[]; tr: number[]; bl: number[]; br: number[] };
  /**
   * Grade de `cols` x `rows` células (linha a linha a partir do canto superior
   * esquerdo): `cells[i]` é a série da célula i. Receitas antigas não têm.
   */
  grid?: { cols: number; rows: number; cells: number[][] };
}

/** Picos da forma de onda, como o job grava em JSON. */
export interface WaveformPeaks {
  /** Baldes por segundo. */
  rate: number;
  /** Pico absoluto de cada balde, 0..255. */
  peaks: number[];
}

export interface ExportState {
  id: number;
  projectId: number;
  revision: number;
  draft: boolean;
  status: 'ready' | 'failed';
  createdAt: string;
  manifest: PackageManifest;
  /** `review/timeline.json` do pacote. */
  timeline: ExportTimeline;
  /** Entradas necessárias para gerar o xmeml com caminhos locais (`buildXmeml`). */
  tracks: ExportTrack[];
}

/** Resposta de `GET /studio-edit/takes/:id/transcripts`: um por microfone. */
export interface TakeTranscript {
  trackId: number;
  takeId: number;
  /** Quem fala neste microfone, quando a trilha está associada a uma pessoa. */
  speakerName: string | null;
  status: MediaJobStatus;
  language: string | null;
  model: string | null;
  error: string | null;
  words: TranscriptWord[];
}

/** Resposta de `POST /studio-edit/takes/:id/reanalyze`: quantos jobs entraram na fila. */
export interface ReanalyzeResponse {
  enqueued: number;
}

/** Corpo de `POST /studio-edit/projects/:id/suggestions`: proposta manual. */
export const manualSuggestionSchema = z.object({
  takeId: z.number().int().positive(),
  start: z.number().int(),
  end: z.number().int(),
  state: z.enum(['keep', 'remove']).default('remove'),
  rationale: z.string().trim().min(1).max(2000),
});
export type ManualSuggestionRequest = z.infer<typeof manualSuggestionSchema>;

/**
 * Um evento estruturado do editor do HedHog gravado junto com o take (Aula
 * Editor), resumido ao que serve à edição. Nada de digitação, cursor ou
 * conteúdo de arquivo: só o que aconteceu e onde.
 */
export type TakeEventKind = 'file_open' | 'file_save' | 'tab' | 'command' | 'command_exit' | 'preview' | 'marker';

export interface TakeEvent {
  id: number;
  /** Tempo do take, em flicks. */
  at: number;
  kind: TakeEventKind;
  /** Caminho do arquivo, linha de comando (já mascarada), URL (sem parâmetros) ou rótulo. */
  label: string;
  detail: Record<string, unknown> | null;
}

/** Item da biblioteca visual da Hcode: imagem com origem e condição de uso registradas. */
export interface VisualAsset {
  id: number;
  name: string;
  kind: 'image' | 'logo' | 'diagram' | 'icon';
  source: 'own' | 'licensed' | 'public_domain' | 'generated';
  license: string;
  attribution: string | null;
  approved: boolean;
  fileId: number;
  url: string | null;
}

/** Contagens de uma categoria de sugestão. */
export interface SuggestionMetrics {
  kind: SuggestionKind;
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  deferred: number;
  superseded: number;
  modified: number;
  autoApproved: number;
  /** aprovadas / (aprovadas + rejeitadas); nulo sem decisão. Medida, não probabilidade. */
  acceptanceRate: number | null;
  /** Mediana entre a sugestão nascer e a pessoa decidir, em segundos. */
  medianDecisionSeconds: number | null;
}

export interface RecordingMetrics {
  recordingId: number;
  name: string;
  suggestions: number;
  decided: number;
  autoApproved: number;
  approvedRevision: number | null;
  /** Do primeiro ao último comando de uma pessoa, em minutos (inclui pausas). */
  reviewSpanMinutes: number | null;
  costUsd: number;
}

/** Resposta de `GET /studio-edit/metrics`. */
export interface StudioEditMetrics {
  from: string | null;
  to: string | null;
  totals: { recordings: number; suggestions: number; decided: number; autoApproved: number; costUsd: number };
  byKind: SuggestionMetrics[];
  byRecording: RecordingMetrics[];
}
