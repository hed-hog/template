'use client';

import { useEffect } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';
type ThemeSource = 'explicit' | 'fallback';

const THEME_SOURCE_STORAGE_KEY = 'theme-source';
const DENSITY_STORAGE_KEY = 'theme-spacing';
const DENSITY_SOURCE_STORAGE_KEY = 'theme-spacing-source';
const SPACING_REM: Record<string, string> = {
  compact: '0.2',
  comfortable: '0.25',
  spacious: '0.3',
};
const ZOOM_STORAGE_KEY = 'theme-zoom';
const ZOOM_SOURCE_STORAGE_KEY = 'theme-zoom-source';
const isValidZoom = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9]{1,3}%$/.test(value);

interface ThemeProviderProps {
  settings: {
    'theme-primary-light'?: string;
    'theme-primary-foreground-light'?: string;
    'theme-secondary-light'?: string;
    'theme-secondary-foreground-light'?: string;
    'theme-accent-light'?: string;
    'theme-accent-foreground-light'?: string;
    'theme-muted-light'?: string;
    'theme-muted-foreground-light'?: string;
    'theme-background-light'?: string;
    'theme-background-foreground-light'?: string;
    'theme-card-light'?: string;
    'theme-card-foreground-light'?: string;
    'theme-primary-dark'?: string;
    'theme-primary-foreground-dark'?: string;
    'theme-secondary-dark'?: string;
    'theme-secondary-foreground-dark'?: string;
    'theme-accent-dark'?: string;
    'theme-accent-foreground-dark'?: string;
    'theme-muted-dark'?: string;
    'theme-muted-foreground-dark'?: string;
    'theme-background-dark'?: string;
    'theme-background-foreground-dark'?: string;
    'theme-card-dark'?: string;
    'theme-card-foreground-dark'?: string;
    'theme-radius'?: string;
    'theme-font'?: string;
    'theme-text-size'?: string;
    'theme-spacing'?: string;
    'theme-zoom'?: string;
    'theme-mode'?: string;
  };
  children: React.ReactNode;
}

export function ThemeProvider({ settings, children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const parseStorageValue = (value: string | null) => {
      if (value === null) return null;

      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    };

    const getStoredTheme = (): ThemeMode | undefined => {
      const storedTheme = parseStorageValue(localStorage.getItem('theme'));

      return storedTheme === 'light' ||
        storedTheme === 'dark' ||
        storedTheme === 'system'
        ? storedTheme
        : undefined;
    };

    const getStoredThemeSource = (): ThemeSource | undefined => {
      const storedThemeSource = parseStorageValue(
        localStorage.getItem(THEME_SOURCE_STORAGE_KEY)
      );

      return storedThemeSource === 'explicit' ||
        storedThemeSource === 'fallback'
        ? storedThemeSource
        : undefined;
    };

    const parseStoredSettings = () => {
      const raw = localStorage.getItem('settings');
      if (!raw) return settings;

      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed as typeof settings;
        }

        if (typeof parsed === 'string') {
          const nestedParsed = JSON.parse(parsed);
          if (nestedParsed && typeof nestedParsed === 'object') {
            return nestedParsed as typeof settings;
          }
        }
      } catch {
        // Ignore malformed local storage value and fallback to props.
      }

      return settings;
    };

    const getStoredSettings = () => {
      return parseStoredSettings();
    };

    const getThemeMode = (override?: ThemeMode): ThemeMode => {
      if (override) return override;

      const storedThemeSource = getStoredThemeSource();
      const storedTheme = getStoredTheme();

      if (storedThemeSource === 'explicit' && storedTheme) {
        return storedTheme;
      }

      const activeSettings = getStoredSettings();
      if (
        activeSettings['theme-mode'] === 'light' ||
        activeSettings['theme-mode'] === 'dark' ||
        activeSettings['theme-mode'] === 'system'
      ) {
        return activeSettings['theme-mode'];
      }

      if (storedTheme) {
        return storedTheme;
      }

      return 'system';
    };

    const applyTheme = (override?: ThemeMode) => {
      const activeSettings = getStoredSettings();
      const themeMode = getThemeMode(override);
      const currentTheme: 'light' | 'dark' =
        themeMode === 'system'
          ? mediaQuery.matches
            ? 'dark'
            : 'light'
          : themeMode;
      // Prepare cssRules string (same logic as server-side builder)
      const addRule = (
        varName: string,
        settingKey: keyof typeof activeSettings
      ) => {
        const hexColor = activeSettings[settingKey];
        if (
          hexColor &&
          typeof hexColor === 'string' &&
          hexColor.startsWith('#')
        ) {
          return `  ${varName}: ${hexColor} !important;\n`;
        }
        return '';
      };

      let cssRules = '';
      if (currentTheme === 'light') {
        cssRules += ':root, html:not(.dark) {\n';
        cssRules += addRule('--primary', 'theme-primary-light');
        cssRules += addRule('--bprogress-color', 'theme-primary-light');
        cssRules += addRule(
          '--primary-foreground',
          'theme-primary-foreground-light'
        );
        cssRules += addRule('--secondary', 'theme-secondary-light');
        cssRules += addRule(
          '--secondary-foreground',
          'theme-secondary-foreground-light'
        );
        cssRules += addRule('--accent', 'theme-accent-light');
        cssRules += addRule(
          '--accent-foreground',
          'theme-accent-foreground-light'
        );
        cssRules += addRule('--muted', 'theme-muted-light');
        cssRules += addRule(
          '--muted-foreground',
          'theme-muted-foreground-light'
        );
        cssRules += addRule('--background', 'theme-background-light');
        cssRules += addRule(
          '--foreground',
          'theme-background-foreground-light'
        );
        cssRules += addRule('--card', 'theme-card-light');
        cssRules += addRule('--card-foreground', 'theme-card-foreground-light');
      } else {
        cssRules += 'html.dark, .dark {\n';
        cssRules += addRule('--primary', 'theme-primary-dark');
        cssRules += addRule('--bprogress-color', 'theme-primary-dark');
        cssRules += addRule(
          '--primary-foreground',
          'theme-primary-foreground-dark'
        );
        cssRules += addRule('--secondary', 'theme-secondary-dark');
        cssRules += addRule(
          '--secondary-foreground',
          'theme-secondary-foreground-dark'
        );
        cssRules += addRule('--accent', 'theme-accent-dark');
        cssRules += addRule(
          '--accent-foreground',
          'theme-accent-foreground-dark'
        );
        cssRules += addRule('--muted', 'theme-muted-dark');
        cssRules += addRule(
          '--muted-foreground',
          'theme-muted-foreground-dark'
        );
        cssRules += addRule('--background', 'theme-background-dark');
        cssRules += addRule('--foreground', 'theme-background-foreground-dark');
        cssRules += addRule('--card', 'theme-card-dark');
        cssRules += addRule('--card-foreground', 'theme-card-foreground-dark');
      }

      if (activeSettings['theme-radius']) {
        cssRules += `  --radius: ${activeSettings['theme-radius']}rem !important;\n`;
      }
      // "Interface zoom" + base text size collapse into a single root
      // font-size multiplier so the whole rem-based UI scales like a zoom
      // without breaking JS-positioned overlays (Radix/Floating UI).
      const zoomSource = parseStorageValue(
        localStorage.getItem(ZOOM_SOURCE_STORAGE_KEY)
      );
      const storedZoom = parseStorageValue(
        localStorage.getItem(ZOOM_STORAGE_KEY)
      );
      const effectiveZoom =
        zoomSource === 'explicit' && isValidZoom(storedZoom)
          ? storedZoom
          : isValidZoom(activeSettings['theme-zoom'])
            ? activeSettings['theme-zoom']
            : '100%';
      const zoomFactor = parseInt(effectiveZoom, 10) / 100;
      const tsRaw = parseFloat(activeSettings['theme-text-size'] ?? '');
      const textSizeFactor = Number.isFinite(tsRaw) && tsRaw > 0 ? tsRaw : 1;
      const rootFontRem =
        Math.round(textSizeFactor * zoomFactor * 10000) / 10000;
      cssRules += `  font-size: ${rootFontRem}rem !important;\n`;
      const densitySource = parseStorageValue(
        localStorage.getItem(DENSITY_SOURCE_STORAGE_KEY)
      );
      const storedDensity = parseStorageValue(
        localStorage.getItem(DENSITY_STORAGE_KEY)
      );
      const densityValue =
        densitySource === 'explicit' &&
        typeof storedDensity === 'string' &&
        SPACING_REM[storedDensity]
          ? storedDensity
          : typeof activeSettings['theme-spacing'] === 'string' &&
              SPACING_REM[activeSettings['theme-spacing']]
            ? activeSettings['theme-spacing']
            : 'comfortable';
      cssRules += `  --spacing: ${SPACING_REM[densityValue]}rem !important;\n`;

      cssRules += '}\n';
      if (activeSettings['theme-font']) {
        cssRules += `:root {\n`;
        cssRules += `  --font-sans: ${activeSettings['theme-font']} !important;\n`;
        cssRules += `}\n`;
        cssRules += `html {\n`;
        cssRules += `  font-family: ${activeSettings['theme-font']} !important;\n`;
        cssRules += `}\n`;
      }

      const existingStyle = document.getElementById('theme-custom-styles');
      const existingCss = existingStyle ? existingStyle.textContent : null;
      const htmlHasTheme = root.classList.contains(currentTheme);

      // If server already injected identical rules and the html already has the theme class, skip re-applying.
      if (existingCss === cssRules && htmlHasTheme) {
        return;
      }

      root.classList.remove('light', 'dark');
      root.classList.add(currentTheme);

      if (existingStyle) {
        existingStyle.textContent = cssRules;
        return;
      }

      const styleTag = document.createElement('style');
      styleTag.id = 'theme-custom-styles';
      styleTag.textContent = cssRules;
      document.head.appendChild(styleTag);
    };

    applyTheme();

    const handleThemeChange = () => {
      if (getThemeMode() === 'system') {
        applyTheme();
      }
    };

    const handleStorageThemeChange = (event: StorageEvent) => {
      if (
        event.key === 'theme' ||
        event.key === 'settings' ||
        event.key === THEME_SOURCE_STORAGE_KEY ||
        event.key === DENSITY_STORAGE_KEY ||
        event.key === DENSITY_SOURCE_STORAGE_KEY ||
        event.key === ZOOM_STORAGE_KEY ||
        event.key === ZOOM_SOURCE_STORAGE_KEY
      ) {
        applyTheme();
      }
    };

    const handleAppThemeChange = (event: Event) => {
      const nextTheme = (event as CustomEvent<ThemeMode | undefined>).detail;
      applyTheme(nextTheme);
    };

    const handleAppSettingsChange = () => {
      applyTheme();
    };

    mediaQuery.addEventListener('change', handleThemeChange);
    window.addEventListener('storage', handleStorageThemeChange);
    window.addEventListener('hedhog:theme-change', handleAppThemeChange);
    window.addEventListener('hedhog:settings-change', handleAppSettingsChange);
    return () => {
      mediaQuery.removeEventListener('change', handleThemeChange);
      window.removeEventListener('storage', handleStorageThemeChange);
      window.removeEventListener('hedhog:theme-change', handleAppThemeChange);
      window.removeEventListener(
        'hedhog:settings-change',
        handleAppSettingsChange
      );
    };
  }, [settings]);

  return <>{children}</>;
}
