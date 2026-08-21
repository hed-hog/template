/**
 * Resolucao das settings de marca (`image-url`, `icon-url`, `pdf-logo`) para
 * URL absoluta.
 *
 * Vive aqui porque `@hed-hog/api-mail` e o ponto mais baixo do grafo que todos
 * os consumidores alcancam (core, crm e operations dependem dele direto; lms
 * via core). Sao funcoes puras: quem tem acesso as settings passa as bases.
 */

/** Bases publicas usadas para tornar um asset relativo absoluto. */
export type BrandAssetBases = {
  /** Setting `url`: base publica do front, que serve `/logo.svg`. */
  appBaseUrl?: string | null;
  /** Setting `api-url`: base publica da API, que serve `/file/image/:id`. */
  apiBaseUrl?: string | null;
};

function normalizeBase(value?: string | null): string {
  return String(value ?? '')
    .trim()
    .replace(/\/+$/, '');
}

/**
 * Normaliza o caminho relativo e remove um eventual prefixo `/api`.
 *
 * `/api` e artefato do rewrite do admin (`apps/admin/next.config.ts`) e nao
 * existe na API, cujo controller e `@Controller('file')`: `/api/file/image/42`
 * e `/file/image/42` sao o mesmo recurso. O `(?=\/|$)` evita casar nomes que
 * apenas comecam com "api", como `/apifoo.png`.
 */
function normalizePath(value: string): string {
  const withoutLeadingSlashes = value.replace(/^\/+/, '');
  const withoutApiPrefix = withoutLeadingSlashes
    .replace(/^api(?=\/|$)/i, '')
    .replace(/^\/+/, '');

  return `/${withoutApiPrefix}`;
}

/**
 * Resolve um valor de setting de marca para uma URL absoluta.
 *
 * `data:` e `http(s)://` passam direto. Para caminho relativo a regra tem duas
 * entradas apenas:
 *  - `/file/...` e servido pela API           -> base = setting `api-url`;
 *  - qualquer outro caminho e asset do front  -> base = setting `url`.
 *
 * Sem base utilizavel devolve '' e quem chama decide o fallback (selo de texto,
 * SVG inline, etc). O segundo argumento aceita `string` apenas por
 * compatibilidade com a assinatura anterior de `resolveMailAssetUrl` (o pacote
 * e publicado no npm): equivale a `{ apiBaseUrl }`.
 */
export function resolveBrandAssetUrl(
  url: string,
  bases: BrandAssetBases | string,
): string {
  const trimmed = String(url ?? '').trim();

  if (!trimmed) {
    return '';
  }

  if (/^(data:|https?:\/\/)/i.test(trimmed)) {
    return trimmed;
  }

  const { appBaseUrl, apiBaseUrl } =
    typeof bases === 'string' ? { apiBaseUrl: bases, appBaseUrl: undefined } : bases;

  const path = normalizePath(trimmed);
  const app = normalizeBase(appBaseUrl);
  const api = normalizeBase(apiBaseUrl);
  const base = /^\/file(\/|$)/i.test(path) ? api || app : app || api;

  return base ? base + path : '';
}

/**
 * Um cliente de e-mail busca a imagem de fora da nossa rede: so URL absoluta e
 * publica funciona. `http://localhost:3100/logo.svg`, `http://hub-api:3100/...`
 * (Service do cluster) ou caminho relativo chegam quebrados, e o destinatario
 * ve apenas o `alt`.
 *
 * Nao vale para PDF: o Playwright renderiza dentro do servidor e alcanca host
 * interno normalmente.
 */
export function isPublicAssetUrl(url?: string | null): boolean {
  const trimmed = String(url ?? '').trim();

  if (!trimmed) {
    return false;
  }

  if (/^data:image\//i.test(trimmed)) {
    return true;
  }

  const authority = /^https?:\/\/([^/?#]+)/i.exec(trimmed)?.[1];

  if (!authority) {
    return false;
  }

  const host = authority.split('@').pop()?.split(':')[0]?.toLowerCase();

  if (!host) {
    return false;
  }

  // Hostname sem ponto e nome interno: `localhost`, `hub-api`, `admin`.
  if (!host.includes('.')) {
    return false;
  }

  if (/\.(localhost|local|internal|svc)$/i.test(host)) {
    return false;
  }

  if (/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    return false;
  }

  return true;
}
