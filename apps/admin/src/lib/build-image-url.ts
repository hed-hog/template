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
 * Absolute URL to the generic file endpoint for a stored file id, served inline.
 * Use this for non-image files (e.g. videos) or for downloads — for images meant
 * for display prefer {@link buildImageUrl} (long-cached image endpoint).
 */
export function buildFileOpenUrl(fileId?: number | null): string | null {
  if (!fileId || !apiBaseUrl) return null;
  return `${apiBaseUrl}/file/open/${fileId}`;
}
