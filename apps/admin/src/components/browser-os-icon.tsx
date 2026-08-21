'use client';

import { Icon } from '@iconify/react';
import { icons as flagIcons } from '@iconify-json/flag';
import { icons as logosIcons } from '@iconify-json/logos';
import { Monitor } from 'lucide-react';

type IconifySet = {
  icons: Record<string, { body: string; width?: number; height?: number }>;
  width?: number;
  height?: number;
};

/**
 * Builds the icon object for iconify's `<Icon>` from an offline set
 * (`@iconify-json/*`). Icons live under `.icons` and each one has its
 * own width/height (falling back to the set's defaults), which
 * preserves the aspect ratio and avoids distorting non-square icons.
 */
function iconFromSet(set: IconifySet, name: string) {
  const entry = set.icons[name];
  if (!entry) return null;
  // The real `@iconify-json/*` sets used here (`logos`, `flag`) always
  // define a set-level `width`/`height` (256 and 512 respectively), so the
  // literal `?? 256` fallback only guards a set shape that doesn't occur in
  // practice.
  return {
    body: entry.body,
    /* v8 ignore next */
    width: entry.width ?? set.width ?? 256,
    /* v8 ignore next */
    height: entry.height ?? set.height ?? 256,
  };
}

function logoIcon(name: string) {
  return iconFromSet(logosIcons, name);
}

/**
 * Editable map of logos.
 *
 * How to update/add a logo:
 *  1. The KEY is the lowercase name as it comes from the database (browser/os
 *     from `lesson_view_event` or `access_log`). Backend values are limited
 *     (Chrome, Firefox, Safari, Edge, Opera, Other / Windows, macOS, Linux,
 *     iOS, Android, Other), but there may be variations from other sources.
 *  2. The VALUE is the slug of an icon from the `@iconify-json/logos` package.
 *     Look up the slug at https://icon-sets.iconify.design/logos/ (without the
 *     "logos:" prefix).
 *  3. If the slug doesn't exist in the package, the component automatically
 *     falls back to the default icon (it doesn't break).
 *
 * Keys are normalized (lowercase, collapsed whitespace), so
 * "Mobile Safari" and "mobile  safari" both match the "mobile safari" entry.
 */
const BROWSER_LOGO: Record<string, string> = {
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

const OS_LOGO: Record<string, string> = {
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
  const data = logoName ? logoIcon(logoName) : null;
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
  const data = logoName ? logoIcon(logoName) : null;
  if (!data) return null;
  // Fixes the height and lets the width scale by the logo's aspect ratio.
  return <Icon icon={data} height={size} className={className} />;
}

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
  if (!code || code.length !== 2) return null;
  // Colored flag from iconify (`flag` set, 4×3 ratio, key `<iso>-4x3`).
  const data = iconFromSet(flagIcons, `${code.toLowerCase()}-4x3`);
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
