import { ForbiddenDialog } from '@/components/forbidden-dialog';
import { InstallationProvider } from '@/components/provider/installation-provider';
import { ThemeProvider } from '@/components/provider/theme-provider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  fetchAdminApiJson,
  getAdminApiBaseUrl,
  isRetryableAdminApiError,
} from '@/lib/admin-api';
import { AppProvider } from '@hed-hog/next-app-provider';
import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { Geist, Geist_Mono } from 'next/font/google';
import { ReactNode } from 'react';
import { toast } from 'sonner';
import './globals.css';

// Force dynamic rendering to always fetch fresh settings
export const dynamic = 'force-dynamic';
export const revalidate = 0;

type SystemSettingsResponse = {
  setting?: {
    'system-name': string;
    'system-slogan': string;
    'icon-url': string;
    'image-url': string;
    'theme-primary-light': string;
    'theme-primary-foreground-light': string;
    'theme-secondary-light': string;
    'theme-secondary-foreground-light': string;
    'theme-accent-light': string;
    'theme-accent-foreground-light': string;
    'theme-muted-light': string;
    'theme-muted-foreground-light': string;
    'theme-background-light': string;
    'theme-background-foreground-light': string;
    'theme-card-light': string;
    'theme-card-foreground-light': string;
    'theme-primary-dark': string;
    'theme-primary-foreground-dark': string;
    'theme-secondary-dark': string;
    'theme-secondary-foreground-dark': string;
    'theme-accent-dark': string;
    'theme-accent-foreground-dark': string;
    'theme-muted-dark': string;
    'theme-muted-foreground-dark': string;
    'theme-background-dark': string;
    'theme-background-foreground-dark': string;
    'theme-card-dark': string;
    'theme-card-foreground-dark': string;
    'theme-radius': string;
    'theme-font': string;
    'theme-text-size': string;
    'theme-spacing': string;
    'theme-zoom': string;
    'theme-mode': string;
    'password-min-symbols': number;
    'password-min-numbers': number;
    'password-min-uppercase': number;
    'password-min-length': number;
    'mfa-email-code-length': number;
    'ai-openai-api-key-enabled': boolean;
    'ai-gemini-api-key-enabled': boolean;
    'mcp-enabled': boolean;
    'mcp-ai-provider': string;
    'menu-width': number;
    'disable-authentication-with-email-and-password': boolean;
    providers: string[];
  };
  locales?: { code: string; name: string }[];
};

const DEFAULT_SYSTEM_SETTINGS = {
  'system-name': 'HedHog Admin',
  'system-slogan': 'Administration Panel',
  'icon-url': '/favicon.ico',
  'theme-mode': 'light',
} as NonNullable<SystemSettingsResponse['setting']>;

const DEFAULT_LOCALES: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
];

const getOfflineSettingsFallback = () => ({
  setting: DEFAULT_SYSTEM_SETTINGS,
  locales: DEFAULT_LOCALES,
});

const getSystemSettings = async () => {
  const maxRetries = 3;
  const retryDelay = 1000;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const data = await fetchAdminApiJson<SystemSettingsResponse>(
        '/setting/initial',
        {
          timeoutMs: 15000,
        }
      );
      const locales = data.locales || [];
      if (!Array.isArray(locales) || locales.length === 0) {
        throw new Error('No locale configured in system settings.');
      }

      return { setting: data.setting || {}, locales } as {
        setting: NonNullable<SystemSettingsResponse['setting']>;
        locales: { code: string; name: string }[];
      };
    } catch (error) {
      if (isRetryableAdminApiError(error) && attempt < maxRetries) {
        console.info(
          `\x1b[33m[ADMIN] [Attempt ${attempt}/${maxRetries}]\x1b[0m Waiting for API server to be ready... (retrying in ${retryDelay / 1000}s)`
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }

      const errMsg =
        error instanceof Error ? error.message : JSON.stringify(error);

      // Use warn for connection failures — fallback handles them gracefully.
      const logFn = isRetryableAdminApiError(error)
        ? console.warn
        : console.error;
      logFn(
        '\x1b[33m%s\x1b[0m\n\x1b[36m%s\x1b[0m',
        '[ADMIN] Failed to fetch system settings — using defaults.',
        errMsg
      );

      return getOfflineSettingsFallback();
    }
  }

  console.warn(
    '\x1b[33m%s\x1b[0m',
    '[ADMIN] API unavailable after retries. Using default system settings.'
  );

  return getOfflineSettingsFallback();
};

const getInstallationStatus = async () => {
  try {
    const data = await fetchAdminApiJson<{ installed?: boolean }>('/install', {
      timeoutMs: 5000,
    });

    return Boolean(data?.installed);
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : JSON.stringify(error);

    const logFn = isRetryableAdminApiError(error)
      ? console.warn
      : console.error;
    logFn(
      '\x1b[33m%s\x1b[0m\n\x1b[36m%s\x1b[0m',
      '[ADMIN] Failed to fetch installation status — assuming installed.',
      errMsg
    );

    return true;
  }
};

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const { setting } = await getSystemSettings();

  return {
    title: setting['system-name'] || 'HedHog Admin',
    description: setting['system-slogan'] || 'Administration Panel',
    icons: {
      icon: setting['icon-url'] || '/favicon.ico',
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  const apiBaseUrl = getAdminApiBaseUrl();

  // Fetch settings fresh on every render
  const { setting, locales } = await getSystemSettings();
  const installed = await getInstallationStatus();

  const serverTheme =
    setting && setting['theme-mode'] === 'dark' ? 'dark' : 'light';

  const buildThemeCss = (
    activeSettings: typeof setting,
    currentTheme: 'light' | 'dark'
  ) => {
    const cssParts: string[] = [];

    const addRule = (
      varName: string,
      settingKey: keyof typeof activeSettings
    ) => {
      const hexColor = activeSettings?.[settingKey];
      if (
        hexColor &&
        typeof hexColor === 'string' &&
        hexColor.startsWith('#')
      ) {
        cssParts.push(`  ${varName}: ${hexColor} !important;`);
      }
    };

    if (currentTheme === 'light') {
      cssParts.push(':root, html:not(.dark) {');
      addRule('--primary', 'theme-primary-light');
      addRule('--bprogress-color', 'theme-primary-light');
      addRule('--primary-foreground', 'theme-primary-foreground-light');
      addRule('--secondary', 'theme-secondary-light');
      addRule('--secondary-foreground', 'theme-secondary-foreground-light');
      addRule('--accent', 'theme-accent-light');
      addRule('--accent-foreground', 'theme-accent-foreground-light');
      addRule('--muted', 'theme-muted-light');
      addRule('--muted-foreground', 'theme-muted-foreground-light');
      addRule('--background', 'theme-background-light');
      addRule('--foreground', 'theme-background-foreground-light');
      addRule('--card', 'theme-card-light');
      addRule('--card-foreground', 'theme-card-foreground-light');
    } else {
      cssParts.push('html.dark, .dark {');
      addRule('--primary', 'theme-primary-dark');
      addRule('--bprogress-color', 'theme-primary-dark');
      addRule('--primary-foreground', 'theme-primary-foreground-dark');
      addRule('--secondary', 'theme-secondary-dark');
      addRule('--secondary-foreground', 'theme-secondary-foreground-dark');
      addRule('--accent', 'theme-accent-dark');
      addRule('--accent-foreground', 'theme-accent-foreground-dark');
      addRule('--muted', 'theme-muted-dark');
      addRule('--muted-foreground', 'theme-muted-foreground-dark');
      addRule('--background', 'theme-background-dark');
      addRule('--foreground', 'theme-background-foreground-dark');
      addRule('--card', 'theme-card-dark');
      addRule('--card-foreground', 'theme-card-foreground-dark');
    }

    if (activeSettings && activeSettings['theme-radius']) {
      cssParts.push(
        `  --radius: ${activeSettings['theme-radius']}rem !important;`
      );
    }
    // "Interface zoom" + base text size are both applied as a single root
    // font-size multiplier. Because Tailwind sizing/spacing (--spacing, rem
    // utilities) is rem-based, scaling the root font-size scales the whole UI
    // like a zoom — without breaking JS-positioned overlays (Radix/Floating UI).
    const tsRaw = parseFloat(activeSettings?.['theme-text-size'] ?? '');
    const textSizeFactor = Number.isFinite(tsRaw) && tsRaw > 0 ? tsRaw : 1;
    const zoomRaw = activeSettings && activeSettings['theme-zoom'];
    const zoomFactor =
      typeof zoomRaw === 'string' && /^[0-9]{1,3}%$/.test(zoomRaw)
        ? parseInt(zoomRaw, 10) / 100
        : 1;
    const rootFontRem = Math.round(textSizeFactor * zoomFactor * 10000) / 10000;
    cssParts.push(`  font-size: ${rootFontRem}rem !important;`);
    const spacingRem: Record<string, string> = {
      compact: '0.2',
      comfortable: '0.25',
      spacious: '0.3',
    };
    const spacingKey = activeSettings && activeSettings['theme-spacing'];
    if (typeof spacingKey === 'string' && spacingRem[spacingKey]) {
      cssParts.push(`  --spacing: ${spacingRem[spacingKey]}rem !important;`);
    }

    cssParts.push('}');

    if (activeSettings && activeSettings['theme-font']) {
      cssParts.push(':root {');
      cssParts.push(
        `  --font-sans: ${activeSettings['theme-font']} !important;`
      );
      cssParts.push('}');
      cssParts.push('html {');
      cssParts.push(
        `  font-family: ${activeSettings['theme-font']} !important;`
      );
      cssParts.push('}');
    }

    return cssParts.join('\n');
  };

  const themeCss = buildThemeCss(setting, serverTheme as 'light' | 'dark');

  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} antialiased ${serverTheme}`}
    >
      <body suppressHydrationWarning>
        <style
          id="theme-custom-styles"
          dangerouslySetInnerHTML={{ __html: themeCss }}
        />
        <ThemeProvider settings={setting}>
          <NextIntlClientProvider>
            <InstallationProvider apiBaseUrl={apiBaseUrl} installed={installed}>
              <Toaster />
              <TooltipProvider>
                <AppProvider toast={toast} settings={setting} locales={locales} appName="admin">
                  <ForbiddenDialog />
                  {children}
                </AppProvider>
              </TooltipProvider>
            </InstallationProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
