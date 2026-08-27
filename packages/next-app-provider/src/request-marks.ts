/**
 * O que o cliente mediu da própria requisição — o único relato confiável sobre
 * uma requisição que morreu sem resposta.
 *
 * Existe porque o Resource Timing **não** serve para isso. Quando um fetch
 * falha, a especificação manda o browser publicar a entrada com os marcos
 * zerados, e é o que o Chromium faz: medido ao vivo contra um servidor local,
 * "conectou, enviou e o servidor nunca respondeu" e "a conexão nem abriu"
 * produzem entradas idênticas (`connectEnd`, `requestStart` e `responseStart`
 * todos `0`, só `startTime` e `duration` preenchidos). Classificar fase a partir
 * dali não é diagnóstico: é chute com cara de medida, e o chute cai sempre no
 * balde de quem não conectou — ou seja, culpa a conexão do usuário por um
 * problema que pode ser nosso.
 *
 * Aqui nada é inferido. Os marcos vêm dos eventos do próprio XHR, no instante em
 * que acontecem, e o que não pôde ser medido fica `null` em vez de virar
 * conclusão.
 *
 * Módulo puro e sem dependência, mesmo desenho de `network-error.ts`: quem
 * transforma isto em fase é o app hospedeiro (`apps/class/lib/api-timing.ts`),
 * que é quem tem o vocabulário de `request_phase`.
 */

/** O que este módulo lê de um evento de progresso do axios. */
type ProgressLike = {
  loaded?: number;
  total?: number;
};

export type RequestMarks = {
  /** `performance.now()` de quando a requisição saiu do interceptor. */
  startedAt: number;
  /**
   * Havia corpo para transmitir.
   *
   * Requisição sem corpo — todo `GET` — **não emite evento de upload nenhum**,
   * nem quando dá certo. Sem este flag, um `GET` saudável e um `GET` que não
   * conectou ficam indistinguíveis, e a conclusão seria a mais cara de todas:
   * culpar a rede do usuário. Com ele, o caso vira "não medido", que é a
   * verdade.
   */
  hasBody: boolean;
  /** Quando o corpo terminou de ir para a rede; `null` se nunca terminou. */
  uploadEndedAt: number | null;
  /** Quando o primeiro byte da resposta chegou; `null` se nenhum chegou. */
  firstByteAt: number | null;
};

/**
 * Onde as marcas ficam penduradas no config do axios.
 *
 * O config que sai do interceptor é o **mesmo objeto** que volta em
 * `error.config`, então não é preciso canal paralelo nem `WeakMap`.
 */
const MARKS_KEY = '__hedhogRequestMarks';

const defaultNow = () =>
  typeof performance === 'undefined' ? Date.now() : performance.now();

/**
 * O corpo terminou de ser transmitido?
 *
 * `loaded >= total` com `total > 0` é o instante em que o browser entregou a
 * última parte do corpo à rede. `total` ausente ou zero significa que não havia
 * o que medir, e aí não se conclui nada.
 */
const isUploadComplete = (event: ProgressLike | undefined) => {
  const total = event?.total;
  const loaded = event?.loaded;

  if (typeof total !== 'number' || typeof loaded !== 'number') return false;
  if (total <= 0) return false;

  return loaded >= total;
};

/**
 * A requisição vai para a mesma origem da página?
 *
 * Só a origem importa aqui, não o caminho — daí resolver `url` sobre `baseURL`
 * sem replicar a junção do axios.
 */
export const isSameOriginTarget = (
  config: { baseURL?: string; url?: string } | undefined,
  origin: string
) => {
  if (!origin) return false;

  try {
    const base = new URL(config?.baseURL ?? '', origin);
    return new URL(config?.url ?? '', base).origin === origin;
  } catch {
    return false;
  }
};

/**
 * Pendura no config as marcas desta requisição e liga os ouvintes que as
 * preenchem. Chamado uma vez por requisição, no interceptor.
 *
 * O ouvinte de download vai no próprio XHR e não tem custo nenhum. O de upload
 * vai em `xhr.upload`, e **qualquer** ouvinte ali tira a requisição do conjunto
 * "simples" do CORS: em chamada cross-origin cada batida passaria a custar um
 * `OPTIONS` de preflight. Por isso ele só é ligado quando o alvo é a mesma
 * origem — que é o caso de hoje, com a API servida pelo rewrite `/api`.
 *
 * Handlers que já existiam no config continuam sendo chamados: quem pediu
 * progresso de upload de um arquivo não pode perdê-lo por causa da medição.
 */
export const attachRequestMarks = (
  config: any,
  options: { now?: () => number; sameOrigin?: boolean } = {}
): RequestMarks => {
  const now = options.now ?? defaultNow;
  const hasBody = config?.data != null && config?.data !== '';
  const marks: RequestMarks = {
    startedAt: now(),
    hasBody,
    uploadEndedAt: null,
    firstByteAt: null,
  };

  if (!config) return marks;

  // O retry depois do refresh de token reemite o **mesmo** objeto de config
  // (`instance(originalRequest)`), então este caminho roda de novo nele. Zerar
  // as marcas em vez de anexar outro ouvinte é o que impede a cadeia de
  // handlers de crescer a cada 401 — e funciona porque os ouvintes já
  // pendurados fecham sobre este mesmo objeto.
  const existing: RequestMarks | undefined = config[MARKS_KEY];

  if (existing) {
    existing.startedAt = marks.startedAt;
    existing.hasBody = hasBody;
    existing.uploadEndedAt = null;
    existing.firstByteAt = null;

    return existing;
  }

  config[MARKS_KEY] = marks;

  const previousDownload = config.onDownloadProgress;
  config.onDownloadProgress = (event: ProgressLike) => {
    if (marks.firstByteAt === null) marks.firstByteAt = now();
    previousDownload?.(event);
  };

  if (hasBody && options.sameOrigin !== false) {
    const previousUpload = config.onUploadProgress;
    config.onUploadProgress = (event: ProgressLike) => {
      if (marks.uploadEndedAt === null && isUploadComplete(event)) {
        marks.uploadEndedAt = now();
      }
      previousUpload?.(event);
    };
  }

  return marks;
};

/**
 * As marcas de uma requisição que falhou, lidas do `error.config`.
 *
 * `null` quando a requisição não passou por {@link attachRequestMarks} — erro
 * de `fetch` cru, chamada de outra instância do axios, teste antigo. Quem lê
 * precisa tratar a ausência como "não medido", nunca como "não aconteceu".
 */
export const readRequestMarks = (
  config: unknown | undefined
): RequestMarks | null => {
  const marks = (config as any)?.[MARKS_KEY];

  return marks && typeof marks.startedAt === 'number'
    ? (marks as RequestMarks)
    : null;
};
