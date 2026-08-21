'use client';

import {
  logoIcons,
  type IconifyIconData,
  type LogoSlug,
} from '@/generated/browser-os-logos';
import { Icon } from '@iconify/react';
import { Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';

// The icon data comes from subsets written by `scripts/generate-icon-subset.mjs`,
// not from `@iconify-json/*` directly: those packages are 7,1 MB (`logos`) and
// 3,9 MB (`flag`), and importing them from a client component shipped both in
// full to the browser.

/**
 * Editable map of logos.
 *
 * How to update/add a logo:
 *  1. The KEY is the lowercase name as it comes from the database (browser/os
 *     from `lesson_view_event` or `access_log`). Backend values are limited
 *     (Chrome, Firefox, Safari, Edge, Opera, Other / Windows, macOS, Linux,
 *     iOS, Android, Other), but there may be variations from other sources.
 *  2. The VALUE is the slug of an icon from the `logos` Iconify set. Look it up
 *     at https://icon-sets.iconify.design/logos/ (without the "logos:" prefix),
 *     add it to TARGETS in `scripts/generate-icon-subset.mjs` and run
 *     `pnpm generate:icons` — otherwise `LogoSlug` rejects it at compile time.
 *  3. Names with no entry in this map fall back to the default icon.
 *
 * Keys are normalized (lowercase, collapsed whitespace), so
 * "Mobile Safari" and "mobile  safari" both match the "mobile safari" entry.
 */
const BROWSER_LOGO: Record<string, LogoSlug> = {
  chrome: 'chrome',
  chromium: 'chrome',
  'chrome ios': 'chrome',
  'chrome webview': 'chrome',
  'chrome headless': 'chrome',
  'mobile chrome': 'chrome',
  firefox: 'firefox',
  'mobile firefox': 'firefox',
  safari: 'safari',
  'mobile safari': 'safari',
  edge: 'microsoft-edge',
  'microsoft edge': 'microsoft-edge',
  ie: 'internetexplorer',
  'internet explorer': 'internetexplorer',
  opera: 'opera',
  'opera mini': 'opera',
  'opera touch': 'opera',
  brave: 'brave',
  vivaldi: 'vivaldi',
  duckduckgo: 'duckduckgo',
  tor: 'tor',
  'samsung internet': 'samsung',
  'samsung browser': 'samsung',
  yandex: 'yandex-ru',
  'yandex browser': 'yandex-ru',
};

const OS_LOGO: Record<string, LogoSlug> = {
  windows: 'microsoft-windows-icon',
  macos: 'apple',
  'mac os': 'apple',
  ios: 'apple',
  ipados: 'apple',
  android: 'android-icon',
  linux: 'linux-tux',
  ubuntu: 'ubuntu',
  debian: 'debian',
  fedora: 'fedora',
  'red hat': 'redhat',
  redhat: 'redhat',
  arch: 'archlinux',
  'arch linux': 'archlinux',
  'chrome os': 'chrome',
  chromeos: 'chrome',
};

/** Normalizes the name coming from the database to match the map keys. */
function normalizeName(name: string | null | undefined): string {
  return (name ?? '').toLowerCase().trim().replace(/\s+/g, ' ');
}

type IconProps = { className?: string; size?: number };

export function BrowserIcon({
  name,
  className,
  size = 16,
}: { name: string | null | undefined } & IconProps) {
  const logoName = BROWSER_LOGO[normalizeName(name)];
  const data = logoName ? logoIcons[logoName] : null;
  if (!data) return <Monitor className={className} size={size} />;
  // Fixes the height and lets the width scale by the logo's aspect ratio.
  return <Icon icon={data} height={size} className={className} />;
}

export function OsIcon({
  name,
  className,
  size = 14,
}: { name: string | null | undefined } & IconProps) {
  const logoName = OS_LOGO[normalizeName(name)];
  const data = logoName ? logoIcons[logoName] : null;
  if (!data) return null;
  // Fixes the height and lets the width scale by the logo's aspect ratio.
  return <Icon icon={data} height={size} className={className} />;
}

/**
 * Flags can't use a compile-time slug list: the ISO code comes from the
 * database. The 4×3 subset is 1,9 MB, so it is loaded with a dynamic `import()`
 * instead of riding along in the main bundle — the emoji renders immediately and
 * the SVG replaces it once the chunk arrives.
 *
 * The emoji alone isn't enough: Chrome and Edge on Windows have no flag glyph in
 * Segoe UI Emoji and show the two letters in boxes instead.
 */
export function CountryFlag({
  code,
  width = 28,
  height,
  className,
}: {
  code: string | null | undefined;
  width?: number;
  height?: number;
  className?: string;
}) {
  const [data, setData] = useState<IconifyIconData | null>(null);
  const iso = code && code.length === 2 ? code.toLowerCase() : null;

  useEffect(() => {
    if (!iso) return;
    let active = true;
    void import('@/generated/country-flags')
      .then((mod) => {
        if (active) setData(mod.flagIcons[`${iso}-4x3`] ?? null);
      })
      .catch(() => {
        // Keeps the emoji fallback on a chunk load failure.
      });
    return () => {
      active = false;
    };
  }, [iso]);

  if (!iso) return null;
  if (!data) return <span className={className}>{countryFlag(code)}</span>;
  return (
    <Icon
      icon={data}
      width={width}
      height={height ?? Math.round((width * 3) / 4)}
      className={className}
      style={{ borderRadius: 2, display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}

/** Emoji fallback for a 2-letter ISO 3166-1 alpha-2 country code. */
export function countryFlag(code: string | null | undefined): string {
  if (!code || code.length !== 2) return '';
  return [...code.toUpperCase()]
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}
