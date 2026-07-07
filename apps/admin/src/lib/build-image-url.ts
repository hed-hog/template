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
 * Absolute URL to the generic file endpoint for a stored file id, served inline.
 * Use this for non-image files (e.g. videos) or for downloads — for images meant
 * for display prefer {@link buildImageUrl} (long-cached image endpoint).
 */
export function buildFileOpenUrl(fileId?: number | null): string | null {
  if (!fileId || !apiBaseUrl) return null;
  return `${apiBaseUrl}/file/open/${fileId}`;
}
