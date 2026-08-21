import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

// --- Mocks (hoisted) ---------------------------------------------------

vi.mock('@/components/forbidden-dialog', () => ({
  ForbiddenDialog: () => <div data-testid="forbidden-dialog" />,
}));

vi.mock('@/components/provider/installation-provider', () => ({
  InstallationProvider: ({
    children,
    apiBaseUrl,
    installed,
  }: {
    children: ReactNode;
    apiBaseUrl: string;
    installed: boolean;
  }) => (
    <div
      data-testid="installation-provider"
      data-api-base-url={apiBaseUrl}
      data-installed={String(installed)}
    >
      {children}
    </div>
  ),
}));

vi.mock('@/components/provider/theme-provider', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="theme-provider">{children}</div>
  ),
}));

vi.mock('@/components/ui/sonner', () => ({
  Toaster: () => <div data-testid="toaster" />,
}));

vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="tooltip-provider">{children}</div>
  ),
}));

vi.mock('@hed-hog/next-app-provider', () => ({
  AppProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="app-provider">{children}</div>
  ),
}));

vi.mock('next-intl', () => ({
  NextIntlClientProvider: ({ children }: { children: ReactNode }) => (
    <div data-testid="next-intl-provider">{children}</div>
  ),
}));

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: 'geist-sans-var' }),
  Geist_Mono: () => ({ variable: 'geist-mono-var' }),
}));

vi.mock('sonner', () => ({
  toast: vi.fn(),
}));

const fetchAdminApiJson = vi.fn();
const getAdminApiBaseUrl = vi.fn(() => 'http://api.test');
const isRetryableAdminApiError = vi.fn(() => false);

vi.mock('@/lib/admin-api', () => ({
  fetchAdminApiJson: (...args: unknown[]) => fetchAdminApiJson(...args),
  getAdminApiBaseUrl: (...args: unknown[]) => getAdminApiBaseUrl(...args),
  isRetryableAdminApiError: (...args: unknown[]) =>
    isRetryableAdminApiError(...args),
}));

// Import after mocks
import RootLayout, { generateMetadata } from './layout';

const baseSetting = {
  'system-name': 'Meu Sistema',
  'system-slogan': 'Meu Slogan',
  'icon-url': '/icon.png',
  'theme-mode': 'light',
};

describe('RootLayout / generateMetadata / layout.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAdminApiBaseUrl.mockReturnValue('http://api.test');
    isRetryableAdminApiError.mockReturnValue(false);
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe('getSystemSettings via generateMetadata', () => {
    it('retorna metadata com valores das settings quando a busca é bem-sucedida', async () => {
      fetchAdminApiJson.mockResolvedValueOnce({
        setting: baseSetting,
        locales: [{ code: 'en', name: 'English' }],
      });

      const metadata = await generateMetadata();

      expect(metadata.title).toBe('Meu Sistema');
      expect(metadata.description).toBe('Meu Slogan');
      expect(metadata.icons).toEqual({ icon: '/icon.png' });
    });

    it('usa valores padrão quando setting-name/slogan/icon-url são falsy', async () => {
      fetchAdminApiJson.mockResolvedValueOnce({
        setting: { 'system-name': '', 'system-slogan': '', 'icon-url': '' },
        locales: [{ code: 'en', name: 'English' }],
      });

      const metadata = await generateMetadata();

      expect(metadata.title).toBe('HedHog Admin');
      expect(metadata.description).toBe('Administration Panel');
      expect(metadata.icons).toEqual({ icon: '/favicon.ico' });
    });

    it('tenta novamente quando locales está vazio e eventualmente tem sucesso', async () => {
      vi.useFakeTimers();
      fetchAdminApiJson
        .mockResolvedValueOnce({ setting: baseSetting, locales: [] })
        .mockResolvedValueOnce({
          setting: baseSetting,
          locales: [{ code: 'en', name: 'English' }],
        });
      isRetryableAdminApiError.mockReturnValue(true);

      const promise = generateMetadata();
      // Allow the throw from empty locales + retry branch to be scheduled.
      await vi.advanceTimersByTimeAsync(1000);
      const metadata = await promise;

      expect(fetchAdminApiJson).toHaveBeenCalledTimes(2);
      expect(metadata.title).toBe('Meu Sistema');
    });

    it('usa fallback offline após esgotar as tentativas (todas retryable, locales sempre vazio)', async () => {
      // NOTE: the for-loop's `attempt < maxRetries` guard means the LAST
      // attempt (attempt === maxRetries) always falls into the `else` branch
      // of the catch and returns immediately from inside the loop — it never
      // reaches the post-loop "API unavailable after retries" console.warn
      // (that statement is unreachable dead code given the current control
      // flow). This test exercises the reachable behavior: 3 attempts,
      // fallback settings returned, and the in-loop warn on the final attempt.
      vi.useFakeTimers();
      fetchAdminApiJson.mockResolvedValue({ setting: baseSetting, locales: [] });
      isRetryableAdminApiError.mockReturnValue(true);

      const promise = generateMetadata();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      const metadata = await promise;

      expect(fetchAdminApiJson).toHaveBeenCalledTimes(3);
      expect(metadata.title).toBe('HedHog Admin');
      expect(console.warn).toHaveBeenCalledWith(
        '\x1b[33m%s\x1b[0m\n\x1b[36m%s\x1b[0m',
        '[ADMIN] Failed to fetch system settings — using defaults.',
        'No locale configured in system settings.'
      );
    });

    it('usa fallback offline em erro não retryable (console.error)', async () => {
      fetchAdminApiJson.mockRejectedValueOnce(new Error('boom'));
      isRetryableAdminApiError.mockReturnValue(false);

      const metadata = await generateMetadata();

      expect(metadata.title).toBe('HedHog Admin');
      expect(console.error).toHaveBeenCalled();
    });

    it('usa fallback offline em erro retryable esgotado no primeiro loop (console.warn no catch)', async () => {
      // isRetryableAdminApiError true but attempt === maxRetries (last attempt) -> logFn branch (warn)
      vi.useFakeTimers();
      fetchAdminApiJson
        .mockRejectedValueOnce(new Error('e1'))
        .mockRejectedValueOnce(new Error('e2'))
        .mockRejectedValueOnce(new Error('e3'));
      isRetryableAdminApiError.mockReturnValue(true);

      const promise = generateMetadata();
      await vi.advanceTimersByTimeAsync(1000);
      await vi.advanceTimersByTimeAsync(1000);
      const metadata = await promise;

      expect(metadata.title).toBe('HedHog Admin');
      expect(console.warn).toHaveBeenCalledWith(
        '\x1b[33m%s\x1b[0m\n\x1b[36m%s\x1b[0m',
        '[ADMIN] Failed to fetch system settings — using defaults.',
        'e3'
      );
    });

    it('cobre os fallbacks `data.locales || []` e `data.setting || {}` quando ausentes na resposta bem-sucedida', async () => {
      // First response has no `locales` key at all (exercises `data.locales || []`,
      // taking the "no locales" retry branch); second response has locales but no
      // `setting` key at all (exercises `data.setting || {}` on the success path).
      vi.useFakeTimers();
      isRetryableAdminApiError.mockReturnValue(true);
      fetchAdminApiJson
        .mockResolvedValueOnce({})
        .mockResolvedValueOnce({ locales: [{ code: 'en', name: 'English' }] });

      const promise = generateMetadata();
      await vi.advanceTimersByTimeAsync(1000);
      const metadata = await promise;

      expect(fetchAdminApiJson).toHaveBeenCalledTimes(2);
      // setting was undefined -> falls back to {} -> title/description defaults
      expect(metadata.title).toBe('HedHog Admin');
      expect(metadata.description).toBe('Administration Panel');
    });

    it('lança erro não-Error e usa JSON.stringify na mensagem', async () => {
      fetchAdminApiJson.mockRejectedValueOnce({ some: 'obj' });
      isRetryableAdminApiError.mockReturnValue(false);

      const metadata = await generateMetadata();

      expect(metadata.title).toBe('HedHog Admin');
      expect(console.error).toHaveBeenCalledWith(
        '\x1b[33m%s\x1b[0m\n\x1b[36m%s\x1b[0m',
        '[ADMIN] Failed to fetch system settings — using defaults.',
        JSON.stringify({ some: 'obj' })
      );
    });
  });

  describe('getInstallationStatus via RootLayout', () => {
    async function renderLayout(settingOverrides = {}) {
      const jsx = await RootLayout({ children: <div>conteudo</div> });
      return render(jsx);
    }

    it('installed = true quando data.installed é true', async () => {
      fetchAdminApiJson
        .mockResolvedValueOnce({
          setting: baseSetting,
          locales: [{ code: 'en', name: 'English' }],
        })
        .mockResolvedValueOnce({ installed: true });

      await renderLayout();

      const provider = screen.getByTestId('installation-provider');
      expect(provider).toHaveAttribute('data-installed', 'true');
      expect(provider).toHaveAttribute('data-api-base-url', 'http://api.test');
    });

    it('installed = false quando data.installed é false/undefined', async () => {
      fetchAdminApiJson
        .mockResolvedValueOnce({
          setting: baseSetting,
          locales: [{ code: 'en', name: 'English' }],
        })
        .mockResolvedValueOnce({});

      await renderLayout();

      expect(screen.getByTestId('installation-provider')).toHaveAttribute(
        'data-installed',
        'false'
      );
    });

    it('installed = true (assume instalado) quando falha de forma retryable (console.warn)', async () => {
      fetchAdminApiJson
        .mockResolvedValueOnce({
          setting: baseSetting,
          locales: [{ code: 'en', name: 'English' }],
        })
        .mockRejectedValueOnce(new Error('conn refused'));
      isRetryableAdminApiError.mockReturnValue(true);

      await renderLayout();

      expect(screen.getByTestId('installation-provider')).toHaveAttribute(
        'data-installed',
        'true'
      );
      expect(console.warn).toHaveBeenCalledWith(
        '\x1b[33m%s\x1b[0m\n\x1b[36m%s\x1b[0m',
        '[ADMIN] Failed to fetch installation status — assuming installed.',
        'conn refused'
      );
    });

    it('installed = true (assume instalado) quando falha de forma não-retryable (console.error)', async () => {
      fetchAdminApiJson
        .mockResolvedValueOnce({
          setting: baseSetting,
          locales: [{ code: 'en', name: 'English' }],
        })
        .mockRejectedValueOnce({ weird: true });
      isRetryableAdminApiError.mockReturnValue(false);

      await renderLayout();

      expect(screen.getByTestId('installation-provider')).toHaveAttribute(
        'data-installed',
        'true'
      );
      expect(console.error).toHaveBeenCalledWith(
        '\x1b[33m%s\x1b[0m\n\x1b[36m%s\x1b[0m',
        '[ADMIN] Failed to fetch installation status — assuming installed.',
        JSON.stringify({ weird: true })
      );
    });
  });

  describe('renderização e buildThemeCss', () => {
    it('renderiza tema light com regras de cor completas, radius, font, zoom e spacing válidos', async () => {
      fetchAdminApiJson
        .mockResolvedValueOnce({
          setting: {
            ...baseSetting,
            'theme-mode': 'light',
            'theme-primary-light': '#111111',
            'theme-primary-foreground-light': '#222222',
            'theme-secondary-light': '#333333',
            'theme-secondary-foreground-light': '#444444',
            'theme-accent-light': '#555555',
            'theme-accent-foreground-light': '#666666',
            'theme-muted-light': '#777777',
            'theme-muted-foreground-light': '#888888',
            'theme-background-light': '#999999',
            'theme-background-foreground-light': '#aaaaaa',
            'theme-card-light': '#bbbbbb',
            'theme-card-foreground-light': '#cccccc',
            'theme-radius': '0.5',
            'theme-font': 'Inter',
            'theme-text-size': '1.2',
            'theme-zoom': '90%',
            'theme-spacing': 'compact',
          },
          locales: [{ code: 'en', name: 'English' }],
        })
        .mockResolvedValueOnce({ installed: true });

      const jsx = await RootLayout({ children: <div>conteudo</div> });
      const { container } = render(jsx);

      const style = container.querySelector('#theme-custom-styles');
      expect(style?.innerHTML).toContain(':root, html:not(.dark) {');
      expect(style?.innerHTML).toContain('--primary: #111111 !important;');
      expect(style?.innerHTML).toContain('--radius: 0.5rem !important;');
      expect(style?.innerHTML).toContain('--spacing: 0.2rem !important;');
      expect(style?.innerHTML).toContain('--font-sans: Inter !important;');
      expect(style?.innerHTML).toContain('font-family: Inter !important;');
      expect(screen.getByText('conteudo')).toBeInTheDocument();
    });

    it('renderiza tema dark quando theme-mode é dark, sem cores hex válidas, radius, font, zoom ou spacing', async () => {
      fetchAdminApiJson
        .mockResolvedValueOnce({
          setting: {
            ...baseSetting,
            'theme-mode': 'dark',
            'theme-primary-dark': 'not-a-hex',
            'theme-text-size': 'invalid',
            'theme-zoom': 'invalid-zoom',
            'theme-spacing': 'invalid-spacing',
          },
          locales: [{ code: 'en', name: 'English' }],
        })
        .mockResolvedValueOnce({ installed: false });

      const jsx = await RootLayout({ children: <div>conteudo</div> });
      const { container } = render(jsx);

      const style = container.querySelector('#theme-custom-styles');
      expect(style?.innerHTML).toContain('html.dark, .dark {');
      // invalid hex should not push a rule
      expect(style?.innerHTML).not.toContain('not-a-hex');
      // invalid text-size -> NaN -> fallback 1; invalid zoom -> fallback 1 => font-size: 1rem
      expect(style?.innerHTML).toContain('font-size: 1rem !important;');
      expect(style?.innerHTML).not.toContain('--radius:');
      expect(style?.innerHTML).not.toContain('--spacing:');
      expect(style?.innerHTML).not.toContain('--font-sans:');

      const html = container.ownerDocument.documentElement;
      expect(html.className).toContain('dark');
    });

    it('trata setting ausente/nulo graciosamente (fallback offline aciona buildThemeCss com setting default)', async () => {
      fetchAdminApiJson.mockRejectedValueOnce(new Error('down'));
      isRetryableAdminApiError.mockReturnValue(false);
      fetchAdminApiJson.mockResolvedValueOnce({ installed: true });

      const jsx = await RootLayout({ children: <div>conteudo</div> });
      const { container } = render(jsx);

      expect(container.querySelector('#theme-custom-styles')).toBeTruthy();
      expect(screen.getByText('conteudo')).toBeInTheDocument();
    });
  });
});
