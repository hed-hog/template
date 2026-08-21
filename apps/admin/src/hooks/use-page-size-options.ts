'use client';

import { useApp } from '@hed-hog/next-app-provider';
import { useMemo } from 'react';

/** Nunca vazia, para que `options[0]` sirva de `defaultValue` sem checagem. */
export type PageSizeOptions = readonly [number, ...number[]];

/** Usado enquanto a setting não chega (SSR, primeiro render, valor inválido). */
export const DEFAULT_PAGE_SIZES = [6, 12, 24, 48, 96] as const;

function parseSizes(raw: unknown): PageSizeOptions | null {
  const list =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return null;
          }
        })()
      : raw;

  if (!Array.isArray(list)) return null;

  const sizes = [...new Set(list.map(Number))]
    .filter((size) => Number.isInteger(size) && size > 0)
    .sort((a, b) => a - b);

  return sizes.length ? (sizes as unknown as PageSizeOptions) : null;
}

/**
 * Opções do seletor de itens por página, vindas da setting `pagination-page-sizes`
 * do core (grupo Geral > Sistema). A setting é do tipo `array`, então chega ao
 * client já como lista — mas aceitamos string JSON para tolerar um blob de settings
 * em cache escrito antes de o slug entrar na allowlist.
 *
 * Combine com `usePersistedPageSize` passando o retorno em `allowedValues`: um
 * tamanho salvo que não esteja mais na setting volta para o primeiro válido.
 */
export function usePageSizeOptions(
  fallback: PageSizeOptions = DEFAULT_PAGE_SIZES,
): PageSizeOptions {
  const { getSettingValue } = useApp();

  return useMemo(
    () => parseSizes(getSettingValue('pagination-page-sizes')) ?? fallback,
    [getSettingValue, fallback],
  );
}
