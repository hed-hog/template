import { type DirectionDefaults, type DirectionSource, FACTORY_DIRECTION_DEFAULTS, resolveDirection } from './direction';
import { directionOfTake, type EditDocument } from './document';
import { buildMontage, takeToMontage } from './montage';
import { type TrackTiming, takeToSource, trackSpanInTake } from './sync';
import { frameTicks, type Rational, type Ticks, ticksToNearestFrame } from './time';
import { type VisualElement, zoomMotion } from './visual';

export const TIMELINE_SCHEMA = 'hedhog.studio-edit.timeline/1' as const;
export const PACKAGE_SCHEMA = 'hedhog.studio-edit.package/1' as const;

export type TrackKind = 'screen' | 'camera' | 'microphone' | 'system_audio' | 'external';

/** Uma trilha (arquivo) como a exportação precisa dela. */
export interface ExportTrack {
  trackId: number;
  takeId: number;
  kind: TrackKind;
  sourceIndex: number;
  fileName: string;
  hasVideo: boolean;
  hasAudio: boolean;
  width: number | null;
  height: number | null;
  sampleRate: number | null;
  channels: number | null;
  timing: TrackTiming;
}

/**
 * Escala e posição de um clipe na sequência (o "Movimento" do Premiere).
 * `scale` em porcentagem; `centerX`/`centerY` deslocamento do centro do clipe
 * em fração do quadro, com 0 no meio.
 */
export interface PlacementMotion {
  scale: number;
  centerX: number;
  centerY: number;
}

/** Um trecho de arquivo posicionado na sequência, já em quadros da sequência. */
export interface TimelinePlacement {
  trackId: number;
  sequenceStart: number;
  sequenceEnd: number;
  sourceIn: number;
  sourceOut: number;
  motion?: PlacementMotion | null;
  /** Máscara que a direção pediu e o xmeml não carrega (vai para o relatório). */
  mask?: 'circle' | 'rounded' | 'square' | null;
  border?: { width: number; color: string } | null;
}

export type LaneKind = TrackKind | 'program' | 'program_b' | 'pip';

/** Faixa da sequência: uma por fonte (tipo + índice) ou uma das faixas da direção. */
export interface TimelineLane {
  key: string;
  mediaType: 'video' | 'audio';
  kind: LaneKind;
  sourceIndex: number;
  label: string;
  enabled: boolean;
  placements: TimelinePlacement[];
}

export interface ExportTimeline {
  schema: typeof TIMELINE_SCHEMA;
  name: string;
  rate: Rational;
  durationFrames: number;
  width: number;
  height: number;
  sampleRate: number;
  lanes: TimelineLane[];
  /** `endFrame` presente = marcador com duração (elementos visuais). */
  markers: Array<{ frame: number; endFrame?: number; name: string; comment: string }>;
  /**
   * A camada visual em quadros da sequência, inteira (inclusive o que o xmeml
   * não carrega) — para conferência e para uma integração futura com o Premiere.
   */
  visuals?: Array<{
    elementId: string;
    kind: VisualElement['kind'];
    startFrame: number;
    endFrame: number;
    text: string | null;
    subtitle: string | null;
    rect: VisualElement['rect'];
    arrow: VisualElement['arrow'];
    assetId: number | null;
    /** Tela em que o retângulo foi medido; `null` vale para qualquer tela. */
    trackId: number | null;
    template: string;
    /** Parte do elemento caiu num trecho cortado. */
    clipped: boolean;
  }>;
  /** Elementos inteiros em trechos cortados: ficam de fora e entram no relatório. */
  orphanVisuals?: string[];
}

const KIND_LABEL: Record<LaneKind, string> = {
  screen: 'Tela',
  camera: 'Câmera',
  microphone: 'Microfone',
  system_audio: 'Áudio do sistema',
  external: 'Externa',
  program: 'Programa',
  program_b: 'Programa (2ª câmera)',
  pip: 'PIP',
};

/**
 * Ordem das faixas de vídeo, de baixo para cima (no Premiere a de cima cobre as
 * de baixo). Embaixo, as fontes brutas inteiras e DESLIGADAS — o editor liga a
 * que quiser para refazer um plano. Em cima, o que a direção decidiu: programa,
 * segunda câmera do lado a lado e, por cima de tudo, o PIP.
 */
const VIDEO_STACK: LaneKind[] = ['external', 'camera', 'screen', 'program', 'program_b', 'pip'];
const AUDIO_STACK: LaneKind[] = ['microphone', 'system_audio', 'external'];

const DIRECTION_LANES = new Set<LaneKind>(['program', 'program_b', 'pip']);

function fitScale(track: ExportTrack, width: number, height: number): number {
  if (!track.width || !track.height) return 100;
  return Math.min(width / track.width, height / track.height) * 100;
}

const round = (value: number, digits = 4) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * Converte a montagem aprovada em faixas posicionadas em quadros. Os limites
 * de cada trecho na sequência são calculados do tempo da montagem, e o ponto
 * de saída na fonte deriva do de entrada mais a mesma duração — assim todas as
 * fontes de um trecho têm exatamente o mesmo número de quadros e não
 * escorregam umas contra as outras.
 *
 * A direção vira faixas próprias: cada trecho de direção resolvido
 * (`resolveDirection`) coloca a fonte certa no programa, a segunda câmera no
 * lado a lado e a câmera reduzida e posicionada no PIP.
 */
export function buildExportTimeline(input: {
  name: string;
  document: EditDocument;
  tracks: ExportTrack[];
  rate: Rational;
  directionDefaults?: DirectionDefaults;
}): ExportTimeline {
  const { document, tracks, rate } = input;
  const defaults = input.directionDefaults ?? FACTORY_DIRECTION_DEFAULTS;
  const montage = buildMontage(document);
  const lanes = new Map<string, TimelineLane>();
  const byId = new Map(tracks.map((track) => [track.trackId, track]));

  const videoTracks = tracks.filter((track) => track.hasVideo);
  const reference = videoTracks.find((track) => track.kind === 'screen') ?? videoTracks[0] ?? null;
  const width = reference?.width ?? 1920;
  const height = reference?.height ?? 1080;

  const lane = (key: string, mediaType: 'video' | 'audio', kind: LaneKind, sourceIndex: number) => {
    let found = lanes.get(key);
    if (!found) {
      found = {
        key,
        mediaType,
        kind,
        sourceIndex,
        label: DIRECTION_LANES.has(kind) ? KIND_LABEL[kind] : `${KIND_LABEL[kind]} ${sourceIndex + 1}`,
        enabled: true,
        placements: [],
      };
      lanes.set(key, found);
    }
    return found;
  };

  /** O trecho `[start, end)` do take numa trilha, em quadros; nulo fora do arquivo. */
  const place = (track: ExportTrack, takeId: number, start: Ticks, end: Ticks): TimelinePlacement | null => {
    const span = trackSpanInTake(track.timing);
    const from = Math.max(start, span.start);
    const to = Math.min(end, span.end);
    if (!(to > from)) return null;
    const montageStart = takeToMontage(montage, takeId, from);
    if (montageStart === null) return null;
    const sequenceStart = ticksToNearestFrame(montageStart, rate);
    const sequenceEnd = ticksToNearestFrame(montageStart + (to - from), rate);
    if (sequenceEnd <= sequenceStart) return null;
    const sourceIn = Math.max(0, ticksToNearestFrame(takeToSource(track.timing, from), rate));
    return { trackId: track.trackId, sequenceStart, sequenceEnd, sourceIn, sourceOut: sourceIn + (sequenceEnd - sequenceStart) };
  };

  let hasDirection = false;

  for (const clip of montage.clips) {
    const takeTracks = tracks.filter((candidate) => candidate.takeId === clip.takeId);

    for (const track of takeTracks) {
      const placement = place(track, clip.takeId, clip.start, clip.end);
      if (!placement) continue;
      if (track.hasVideo) {
        lane(`video:${track.kind}:${track.sourceIndex}`, 'video', track.kind, track.sourceIndex).placements.push({ ...placement });
      }
      if (track.hasAudio) {
        lane(`audio:${track.kind}:${track.sourceIndex}`, 'audio', track.kind, track.sourceIndex).placements.push({ ...placement });
      }
    }

    const sources: DirectionSource[] = takeTracks
      .filter((track) => track.hasVideo && (track.kind === 'screen' || track.kind === 'camera' || track.kind === 'external'))
      .map((track) => ({
        trackId: track.trackId,
        kind: track.kind as DirectionSource['kind'],
        userId: null,
        sourceIndex: track.sourceIndex,
      }));
    if (sources.length === 0) continue;

    for (const segment of directionOfTake(document, clip.takeId)) {
      const start = Math.max(segment.start, clip.start);
      const end = Math.min(segment.end, clip.end);
      if (!(end > start)) continue;
      const resolved = resolveDirection(segment, sources, defaults);
      const primary = resolved.primaryTrackId !== null ? byId.get(resolved.primaryTrackId) : undefined;
      if (!primary) continue;
      hasDirection = true;

      if (resolved.layout === 'two_up') {
        const secondary = resolved.secondaryTrackId !== null ? byId.get(resolved.secondaryTrackId) : undefined;
        const half = (track: ExportTrack, side: -1 | 1): PlacementMotion => ({
          scale: round(track.width ? (width / 2 / track.width) * 100 : 50, 2),
          centerX: side * 0.25,
          centerY: 0,
        });
        const left = place(primary, clip.takeId, start, end);
        if (left) lane('video:program', 'video', 'program', 0).placements.push({ ...left, motion: half(primary, -1) });
        if (secondary) {
          const right = place(secondary, clip.takeId, start, end);
          if (right) lane('video:program_b', 'video', 'program_b', 0).placements.push({ ...right, motion: half(secondary, 1) });
        }
        continue;
      }

      const main = place(primary, clip.takeId, start, end);
      if (main) {
        const scale = round(fitScale(primary, width, height), 2);
        lane('video:program', 'video', 'program', 0).placements.push({
          ...main,
          motion: Math.abs(scale - 100) > 0.01 ? { scale, centerX: 0, centerY: 0 } : null,
        });
      }

      if (resolved.layout === 'screen_pip' && resolved.pip) {
        const camera = resolved.pip.trackId !== null ? byId.get(resolved.pip.trackId) : undefined;
        const pip = camera ? place(camera, clip.takeId, start, end) : null;
        if (camera && pip) {
          // A câmera inteira, reduzida para a altura do círculo e centrada nele;
          // o recorte em círculo é do Premiere (máscara), não do xmeml.
          const diameter = resolved.pip.size * height;
          lane('video:pip', 'video', 'pip', 0).placements.push({
            ...pip,
            motion: {
              scale: round((diameter / (camera.height ?? height)) * 100, 2),
              centerX: round(resolved.pip.x - 0.5),
              centerY: round(resolved.pip.y - 0.5),
            },
            // O PIP é um recorte da câmera em qualquer formato; o xmeml não carrega
            // recorte nenhum, então até o quadrado vai para o relatório.
            mask: resolved.pip.shape,
            border: resolved.pip.border.width > 0 ? { ...resolved.pip.border } : null,
          });
        }
      }
    }
  }

  // ─── camada visual ───
  const visuals: NonNullable<ExportTimeline['visuals']> = [];
  const orphanVisuals: string[] = [];
  for (const element of document.visual ?? []) {
    const pieces = montage.clips
      .filter((clip) => clip.takeId === element.takeId && clip.end > element.start && clip.start < element.end)
      .map((clip) => {
        const from = Math.max(clip.start, element.start);
        const to = Math.min(clip.end, element.end);
        const at = clip.montageStart + (from - clip.start);
        return { start: ticksToNearestFrame(at, rate), end: ticksToNearestFrame(at + (to - from), rate), length: to - from };
      })
      .filter((piece) => piece.end > piece.start);
    if (pieces.length === 0) {
      orphanVisuals.push(element.id);
      continue;
    }
    const kept = pieces.reduce((total, piece) => total + piece.length, 0);
    for (const piece of pieces) {
      visuals.push({
        elementId: element.id,
        kind: element.kind,
        startFrame: piece.start,
        endFrame: piece.end,
        text: element.text,
        subtitle: element.subtitle,
        rect: element.rect,
        arrow: element.arrow,
        assetId: element.assetId,
        trackId: element.trackId ?? null,
        template: element.template,
        clipped: kept < element.end - element.start,
      });
    }
  }

  // Zoom: o clipe do programa é partido no intervalo e ganha escala e centro.
  const program = lanes.get('video:program');
  if (program) {
    for (const zoom of visuals.filter((visual) => visual.kind === 'zoom' && visual.rect)) {
      const next: TimelinePlacement[] = [];
      for (const placement of program.placements) {
        const from = Math.max(placement.sequenceStart, zoom.startFrame);
        const to = Math.min(placement.sequenceEnd, zoom.endFrame);
        if (
          !(to > from) ||
          placement.mask ||
          byId.get(placement.trackId)?.kind !== 'screen' ||
          // Retângulo medido noutra tela não serve para esta.
          (zoom.trackId !== null && zoom.trackId !== placement.trackId)
        ) {
          next.push(placement);
          continue;
        }
        const piece = (a: number, b: number, motion: TimelinePlacement['motion']) => ({
          ...placement,
          sequenceStart: a,
          sequenceEnd: b,
          sourceIn: placement.sourceIn + (a - placement.sequenceStart),
          sourceOut: placement.sourceIn + (b - placement.sequenceStart),
          motion,
        });
        if (placement.sequenceStart < from) next.push(piece(placement.sequenceStart, from, placement.motion));
        const base = placement.motion && placement.motion.centerX === 0 && placement.motion.centerY === 0 ? placement.motion.scale : 100;
        // Lado a lado já tem escala e posição próprias: o zoom não se aplica.
        next.push(piece(from, to, placement.motion && base === 100 && (placement.motion.centerX !== 0 || placement.motion.centerY !== 0) ? placement.motion : zoomMotion(zoom.rect!, base)));
        if (to < placement.sequenceEnd) next.push(piece(to, placement.sequenceEnd, placement.motion));
      }
      program.placements = next;
    }
  }

  // Com a direção montada, as fontes brutas ficam como material de apoio.
  if (hasDirection) {
    for (const found of lanes.values()) {
      if (found.mediaType === 'video' && !DIRECTION_LANES.has(found.kind)) found.enabled = false;
    }
  }

  const ordered = [...lanes.values()].sort((a, b) => {
    if (a.mediaType !== b.mediaType) return a.mediaType === 'video' ? -1 : 1;
    const stack = a.mediaType === 'video' ? VIDEO_STACK : AUDIO_STACK;
    return stack.indexOf(a.kind) - stack.indexOf(b.kind) || a.sourceIndex - b.sourceIndex;
  });

  const audioTrack = tracks.find((track) => track.hasAudio && track.sampleRate);

  const markers: ExportTimeline['markers'] = document.markers
    .map((marker) => {
      const at = takeToMontage(montage, marker.takeId, marker.at);
      return at === null
        ? null
        : { frame: ticksToNearestFrame(at, rate), name: marker.kind, comment: marker.text };
    })
    .filter((marker): marker is NonNullable<typeof marker> => marker !== null);

  const VISUAL_LABEL: Record<VisualElement['kind'], string> = {
    title: 'Título',
    lower_third: 'Legenda',
    highlight: 'Destaque',
    arrow: 'Seta',
    zoom: 'Zoom',
    image: 'Imagem',
  };
  for (const visual of visuals) {
    if (visual.kind === 'zoom') continue;
    const where = visual.rect
      ? ` [x=${visual.rect.x.toFixed(2)} y=${visual.rect.y.toFixed(2)} w=${visual.rect.w.toFixed(2)} h=${visual.rect.h.toFixed(2)}]`
      : '';
    markers.push({
      frame: visual.startFrame,
      endFrame: visual.endFrame,
      name: `${VISUAL_LABEL[visual.kind]}${visual.text ? `: ${visual.text}` : ''}`,
      comment: [visual.subtitle, `modelo ${visual.template}${where}`].filter(Boolean).join(' — '),
    });
  }
  markers.sort((a, b) => a.frame - b.frame);

  return {
    schema: TIMELINE_SCHEMA,
    name: input.name,
    rate,
    durationFrames: ticksToNearestFrame(montage.duration, rate),
    width,
    height,
    sampleRate: audioTrack?.sampleRate ?? 48000,
    lanes: ordered,
    markers,
    visuals,
    orphanVisuals,
  };
}

/**
 * O que o pacote não preserva, a partir do que a timeline realmente usa — vai
 * para o manifesto, o relatório e a tela antes do download.
 */
export function exportLimitations(timeline: ExportTimeline): string[] {
  const placements = timeline.lanes.flatMap((found) => found.placements);
  const limitations: string[] = [];
  if (placements.some((placement) => placement.mask)) {
    limitations.push(
      'PIP: a câmera vai reduzida e posicionada na faixa "PIP"; o recorte (círculo, cantos arredondados ou quadrado) e a borda precisam ser aplicados no Premiere.',
    );
  }
  if (placements.some((placement) => placement.motion)) {
    limitations.push(
      'Escala e posição vão no efeito Movimento do XML; confira na primeira importação se o Premiere da ilha as interpreta igual à prévia.',
    );
  }
  const visuals = timeline.visuals ?? [];
  if (visuals.some((visual) => visual.kind !== 'zoom')) {
    limitations.push(
      'Títulos, legendas, destaques, setas e imagens vão como marcadores com duração, texto e posição; precisam ser montados no Premiere com os modelos da Hcode.',
    );
  }
  if (visuals.some((visual) => visual.kind === 'zoom')) {
    limitations.push('Zoom vai como escala e posição no clipe do programa; a animação de entrada e saída fica por conta do Premiere.');
  }
  if ((timeline.orphanVisuals ?? []).length > 0) {
    limitations.push(`${timeline.orphanVisuals!.length} elemento(s) visual(is) caíram inteiros em trechos cortados e ficaram de fora.`);
  }
  if (visuals.some((visual) => visual.clipped)) {
    limitations.push('Há elementos visuais que atravessam cortes: foram recortados junto com o trecho.');
  }
  return limitations;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function rateXml(rate: Rational): string {
  const timebase = Math.round(rate.num / rate.den);
  const ntsc = rate.den === 1001 ? 'TRUE' : 'FALSE';
  return `<rate><timebase>${timebase}</timebase><ntsc>${ntsc}</ntsc></rate>`;
}

/**
 * `file://localhost/C%3a/...` — a forma que o próprio Premiere escreve ao
 * exportar xmeml no Windows. Caminhos relativos não são resolvidos pelo
 * importador; por isso o xmeml definitivo é gerado na máquina que baixou o
 * pacote, com os caminhos de lá.
 */
export function toPathUrl(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  const encoded = normalized
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/');
  return `file://localhost/${encoded.replace(/^\/+/, '')}`;
}

/**
 * Gera um FCP7 XML (xmeml v4), o formato de intercâmbio que o Premiere importa
 * nativamente. Não é um `.prproj`: o projeto nativo só existe quando o próprio
 * Premiere salva depois de importar.
 */
export function buildXmeml(input: {
  timeline: ExportTimeline;
  tracks: ExportTrack[];
  pathFor: (track: ExportTrack) => string;
}): string {
  const { timeline, tracks, pathFor } = input;
  const byId = new Map(tracks.map((track) => [track.trackId, track]));
  const rate = rateXml(timeline.rate);
  const step = frameTicks(timeline.rate);
  const declared = new Set<number>();
  let clipCounter = 0;

  const fileXml = (track: ExportTrack) => {
    const fileId = `file-${track.trackId}`;
    if (declared.has(track.trackId)) return `<file id="${fileId}"/>`;
    declared.add(track.trackId);
    const durationFrames = Math.max(1, Math.round(track.timing.durationTicks / step));
    const video = track.hasVideo
      ? `<video><samplecharacteristics><width>${track.width ?? timeline.width}</width><height>${track.height ?? timeline.height}</height></samplecharacteristics></video>`
      : '';
    const audio = track.hasAudio
      ? `<audio><samplecharacteristics><depth>16</depth><samplerate>${track.sampleRate ?? timeline.sampleRate}</samplerate></samplecharacteristics><channelcount>${track.channels ?? 1}</channelcount></audio>`
      : '';
    return (
      `<file id="${fileId}"><name>${escapeXml(track.fileName)}</name>` +
      `<pathurl>${escapeXml(toPathUrl(pathFor(track)))}</pathurl>${rate}` +
      `<duration>${durationFrames}</duration><media>${video}${audio}</media></file>`
    );
  };

  const clipXml = (lane: TimelineLane, placement: TimelinePlacement) => {
    const track = byId.get(placement.trackId);
    if (!track) return '';
    clipCounter += 1;
    const durationFrames = Math.max(1, Math.round(track.timing.durationTicks / step));
    const sourceTrack =
      lane.mediaType === 'audio'
        ? '<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>'
        : '';
    // Efeito "Movimento" (Basic Motion) do FCP7: escala em % e centro como
    // deslocamento em fração do quadro a partir do meio.
    const motion =
      lane.mediaType === 'video' && placement.motion
        ? '<filter><effect><name>Basic Motion</name><effectid>basic</effectid>' +
          '<effectcategory>motion</effectcategory><effecttype>motion</effecttype><mediatype>video</mediatype>' +
          `<parameter><parameterid>scale</parameterid><name>Scale</name><valuemin>0</valuemin><valuemax>1000</valuemax><value>${placement.motion.scale}</value></parameter>` +
          `<parameter><parameterid>center</parameterid><name>Center</name><value><horiz>${placement.motion.centerX}</horiz><vert>${placement.motion.centerY}</vert></value></parameter>` +
          '</effect></filter>'
        : '';
    return (
      `<clipitem id="clipitem-${clipCounter}"><name>${escapeXml(track.fileName)}</name>` +
      `<enabled>TRUE</enabled><duration>${durationFrames}</duration>${rate}` +
      `<start>${placement.sequenceStart}</start><end>${placement.sequenceEnd}</end>` +
      `<in>${placement.sourceIn}</in><out>${placement.sourceOut}</out>` +
      `${fileXml(track)}${sourceTrack}${motion}</clipitem>`
    );
  };

  const laneXml = (lane: TimelineLane) =>
    `<track><enabled>${lane.enabled ? 'TRUE' : 'FALSE'}</enabled>` +
    lane.placements.map((placement) => clipXml(lane, placement)).join('') +
    '</track>';

  const videoLanes = timeline.lanes.filter((lane) => lane.mediaType === 'video');
  const audioLanes = timeline.lanes.filter((lane) => lane.mediaType === 'audio');

  const markers = timeline.markers
    .map(
      (marker) =>
        `<marker><name>${escapeXml(marker.name)}</name><comment>${escapeXml(marker.comment)}</comment>` +
        `<in>${marker.frame}</in><out>${marker.endFrame ?? -1}</out></marker>`,
    )
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4">' +
    `<sequence id="sequence-1"><name>${escapeXml(timeline.name)}</name>` +
    `<duration>${timeline.durationFrames}</duration>${rate}` +
    `<timecode>${rate}<string>00:00:00:00</string><frame>0</frame><displayformat>NDF</displayformat></timecode>` +
    '<media><video><format><samplecharacteristics>' +
    `${rate}<width>${timeline.width}</width><height>${timeline.height}</height>` +
    '<pixelaspectratio>square</pixelaspectratio></samplecharacteristics></format>' +
    videoLanes.map(laneXml).join('') +
    '</video><audio><numOutputChannels>2</numOutputChannels><format><samplecharacteristics>' +
    `<depth>16</depth><samplerate>${timeline.sampleRate}</samplerate></samplecharacteristics></format>` +
    audioLanes.map(laneXml).join('') +
    `</audio></media>${markers}</sequence></xmeml>\n`
  );
}

/** Um arquivo do pacote, com caminho relativo à raiz do pacote. */
export interface PackageFile {
  trackId: number;
  takeId: number;
  kind: TrackKind;
  path: string;
  sizeBytes: number | null;
  sha256: string | null;
}

export interface PackageManifest {
  schema: typeof PACKAGE_SCHEMA;
  generatedAt: string;
  recording: { id: number; name: string; slug: string };
  revision: { number: number; documentHash: string; draft: boolean };
  timeline: string;
  formats: Array<'json' | 'xmeml' | 'prproj'>;
  premiereTarget: string;
  files: PackageFile[];
  /** Itens da biblioteca visual usados, com origem e condição de uso. */
  visualAssets?: Array<{ id: number; name: string; source: string; license: string; attribution: string | null }>;
  limitations: string[];
}

/** O que a exportação desta fase sabidamente não preserva — vai para o relatório e para a tela. */
export const KNOWN_LIMITATIONS: string[] = [
  'O XML é FCP7 (xmeml), importado pelo Premiere; não é um projeto .prproj nativo.',
  'Alterações feitas no Premiere não voltam para o HedHog.',
];

/**
 * JSON com chaves ordenadas, para que o mesmo documento gere sempre o mesmo
 * hash — em qualquer máquina e em qualquer ordem de inserção das chaves.
 */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
}
