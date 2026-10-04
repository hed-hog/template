const apiBaseUrl = String(process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(
  /\/$/,
  ''
);

/**
 * Absolute URL to the dedicated, long-cached image endpoint for a stored file
 * id. Prefer this over `/file/open/${id}` whenever the file is an image meant
 * for display, so it benefits from the immutable Cache-Control + ETag headers.
 */
export function buildImageUrl(fileId?: number | null): string | null {
  if (!fileId || !apiBaseUrl) return null;
  return `${apiBaseUrl}/file/image/${fileId}`;
}

/**
 * Same as {@link buildImageUrl}, but always fully qualified.
 *
 * Settings like `image-url`/`icon-url` are consumed outside the browser — the
 * transactional email, the dynamic favicon in `app/icon.tsx` — where the
 * relative form that `NEXT_PUBLIC_API_BASE_URL=/api` produces means nothing.
 * Returns null when there is no origin to resolve against (SSR).
 */
export function buildAbsoluteImageUrl(fileId?: number | null): string | null {
  const url = buildImageUrl(fileId);
  if (!url) return null;
  if (/^https?:\/\//i.test(url)) return url;
  if (typeof window === 'undefined') return null;
  return new URL(url, window.location.origin).toString();
}

/**
 * `/file/image/123` e `/file/open/123`, com ou sem o prefixo `/api` e com ou sem
 * query.
 *
 * O prefixo é opcional porque as duas formas circulam: o backend monta a URL
 * canônica sem ele (`productFileUrl` em `commerce-catalog/product-image.util.ts`)
 * e o produto que ainda não migrou para a galeria em tabela guardou em
 * `metadata.image_url` o caminho pelo proxy do Next, com `/api`. Sem tornar o
 * prefixo opcional, o segundo caso viraria `/api/api/file/image/123`.
 */
const HUB_FILE_PATH = /^(?:\/api)?\/file\/(?:image|open)\/(\d+)(?:\?.*)?$/;

/**
 * URL exibível a partir do que o backend chama de `image_url`.
 *
 * O backend devolve o caminho **relativo** do acervo de propósito — cada cliente
 * traduz para onde a sua origem serve o arquivo (a vitrine tem proxy próprio, em
 * `apps/hcode-store/lib/cms/media.ts`). No admin, usar o valor cru no `src`
 * resolve contra a origem do Next e dá 404 silencioso: quem serve o arquivo é a
 * API, e é `buildImageUrl` que sabe o endereço dela.
 *
 * Devolve `null` para o que não dá para exibir, para a tela cair no seu próprio
 * placeholder em vez de pedir uma imagem que não vai chegar.
 */
export function resolveHubImageUrl(url?: string | null): string | null {
  const value = url?.trim();
  if (!value) return null;

  const fileId = HUB_FILE_PATH.exec(value)?.[1];
  if (fileId) return buildImageUrl(Number(fileId));

  // Foto hospedada fora do Hub, do tempo em que o cadastro aceitava URL solta.
  return /^(?:https?:\/\/|data:)/i.test(value) ? value : null;
}

/**
 * Absolute URL to the generic file endpoint for a stored file id, served inline.
 * Use this for non-image files (e.g. videos) or for downloads — for images meant
 * for display prefer {@link buildImageUrl} (long-cached image endpoint).
 */
export function buildFileOpenUrl(fileId?: number | null): string | null {
  if (!fileId || !apiBaseUrl) return null;
  return `${apiBaseUrl}/file/open/${fileId}`;
}
