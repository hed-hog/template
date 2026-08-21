const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/**
 * Tamanho de arquivo legível, na base 1024.
 *
 * Uma casa decimal só a partir de MB: "1,5 KB" não diz nada a mais que "2 KB"
 * ao lado do nome de um anexo, enquanto a diferença entre 1 MB e 1,4 MB conta.
 */
export function formatBytes(bytes: number | null | undefined): string {
  const value = Number(bytes);

  if (!Number.isFinite(value) || value <= 0) return '0 B';

  const exponent = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    UNITS.length - 1,
  );
  const size = value / Math.pow(1024, exponent);
  const decimals = exponent >= 2 && size < 10 ? 1 : 0;

  // `Number(...)` derruba o zero à direita: um anexo de 1 MB cravado vira
  // "1 MB", não "1.0 MB".
  return `${Number(size.toFixed(decimals))} ${UNITS[exponent]}`;
}
