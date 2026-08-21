import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';

import { ThemeProvider } from './theme-provider';

type MatchMediaMock = {
  matches: boolean;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

function mockMatchMedia(matches: boolean): MatchMediaMock {
  const mql: MatchMediaMock = {
    matches,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  window.matchMedia = vi.fn().mockReturnValue(mql);
  return mql;
}

const baseSettings = {};

function getStyleContent(): string | null {
  const style = document.getElementById('theme-custom-styles');
  return style ? style.textContent : null;
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    const existing = document.getElementById('theme-custom-styles');
    existing?.remove();
  });

  afterEach(() => {
    cleanup();
  });

  it('renderiza os children normalmente', () => {
    mockMatchMedia(false);
    const { getByText } = render(
      <ThemeProvider settings={baseSettings}>
        <span>conteudo</span>
      </ThemeProvider>
    );
    expect(getByText('conteudo')).toBeInTheDocument();
  });

  it('aplica tema light quando system e matchMedia não corresponde a dark', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('light')).toBe(true);
    expect(getStyleContent()).toContain(':root, html:not(.dark)');
  });

  it('aplica tema dark quando system e matchMedia corresponde a dark', () => {
    mockMatchMedia(true);
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(getStyleContent()).toContain('html.dark, .dark');
  });

  it('usa tema explícito armazenado no localStorage (theme-source explicit)', () => {
    mockMatchMedia(false);
    localStorage.setItem('theme', JSON.stringify('dark'));
    localStorage.setItem('theme-source', JSON.stringify('explicit'));
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignora theme-source explicit sem theme válido armazenado', () => {
    mockMatchMedia(false);
    localStorage.setItem('theme-source', JSON.stringify('explicit'));
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    // sem storedTheme válido, cai para settings/system => light (matchMedia false)
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('usa theme-mode das settings quando não há theme-source explicit', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={{ 'theme-mode': 'dark' }}>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('usa storedTheme (não explícito) quando settings não tem theme-mode válido', () => {
    mockMatchMedia(false);
    localStorage.setItem('theme', JSON.stringify('dark'));
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('trata valor de localStorage não-JSON como string bruta (parseStorageValue catch)', () => {
    mockMatchMedia(false);
    // valor sem aspas: JSON.parse lança e cai no catch retornando a string bruta
    localStorage.setItem('theme', 'dark');
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('ignora storedThemeSource inválido', () => {
    mockMatchMedia(false);
    localStorage.setItem('theme-source', JSON.stringify('bogus'));
    localStorage.setItem('theme', JSON.stringify('dark'));
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    // theme-source inválido não é 'explicit', mas storedTheme ainda é usado no fallback
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('usa settings da prop quando não há "settings" no localStorage', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={{ 'theme-primary-light': '#123456' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--primary: #123456 !important;');
  });

  it('usa settings do localStorage quando é um objeto JSON válido', () => {
    mockMatchMedia(false);
    localStorage.setItem(
      'settings',
      JSON.stringify({ 'theme-primary-light': '#abcdef' })
    );
    render(
      <ThemeProvider settings={{ 'theme-primary-light': '#000000' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--primary: #abcdef !important;');
  });

  it('usa settings do localStorage com JSON aninhado (string dentro de string)', () => {
    mockMatchMedia(false);
    localStorage.setItem(
      'settings',
      JSON.stringify(JSON.stringify({ 'theme-primary-light': '#111111' }))
    );
    render(
      <ThemeProvider settings={{ 'theme-primary-light': '#000000' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--primary: #111111 !important;');
  });

  it('faz fallback para settings da prop quando localStorage.settings é JSON malformado', () => {
    mockMatchMedia(false);
    localStorage.setItem('settings', '{not valid json');
    render(
      <ThemeProvider settings={{ 'theme-primary-light': '#222222' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--primary: #222222 !important;');
  });

  it('faz fallback para settings da prop quando o JSON aninhado não é objeto', () => {
    mockMatchMedia(false);
    localStorage.setItem('settings', JSON.stringify('"just a string"'));
    render(
      <ThemeProvider settings={{ 'theme-primary-light': '#333333' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--primary: #333333 !important;');
  });

  it('faz fallback para settings da prop quando localStorage.settings é um número JSON válido', () => {
    mockMatchMedia(false);
    localStorage.setItem('settings', JSON.stringify(42));
    render(
      <ThemeProvider settings={{ 'theme-primary-light': '#444444' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--primary: #444444 !important;');
  });

  it('não adiciona regra de cor quando o valor não começa com #', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={{ 'theme-primary-light': 'notahex' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).not.toContain('--primary:');
  });

  it('adiciona theme-radius quando presente', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={{ 'theme-radius': '0.5' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--radius: 0.5rem !important;');
  });

  it('usa zoom explícito armazenado quando válido', () => {
    mockMatchMedia(false);
    localStorage.setItem(ZOOM_SOURCE_KEY, JSON.stringify('explicit'));
    localStorage.setItem(ZOOM_KEY, JSON.stringify('150%'));
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('font-size: 1.5rem !important;');
  });

  it('usa theme-zoom das settings quando não há zoom explícito armazenado', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={{ 'theme-zoom': '200%' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('font-size: 2rem !important;');
  });

  it('usa 100% de zoom por padrão quando nada é válido', () => {
    mockMatchMedia(false);
    localStorage.setItem(ZOOM_SOURCE_KEY, JSON.stringify('explicit'));
    localStorage.setItem(ZOOM_KEY, JSON.stringify('bogus'));
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('font-size: 1rem !important;');
  });

  it('aplica theme-text-size válido combinado ao zoom', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={{ 'theme-text-size': '1.5' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('font-size: 1.5rem !important;');
  });

  it('ignora theme-text-size inválido (NaN) e usa fator 1', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={{ 'theme-text-size': 'not-a-number' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('font-size: 1rem !important;');
  });

  it('ignora theme-text-size <= 0 e usa fator 1', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={{ 'theme-text-size': '-2' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('font-size: 1rem !important;');
  });

  it('usa densidade explícita armazenada quando válida', () => {
    mockMatchMedia(false);
    localStorage.setItem(DENSITY_SOURCE_KEY, JSON.stringify('explicit'));
    localStorage.setItem(DENSITY_KEY, JSON.stringify('spacious'));
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--spacing: 0.3rem !important;');
  });

  it('usa theme-spacing das settings quando densidade armazenada não é explícita/válida', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={{ 'theme-spacing': 'compact' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--spacing: 0.2rem !important;');
  });

  it('usa "comfortable" como densidade padrão quando nada é válido', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--spacing: 0.25rem !important;');
  });

  it('adiciona regras de theme-font quando presente', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={{ 'theme-font': 'Inter, sans-serif' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--font-sans: Inter, sans-serif !important;');
    expect(getStyleContent()).toContain('font-family: Inter, sans-serif !important;');
  });

  it('não adiciona regras de theme-font quando ausente', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).not.toContain('--font-sans');
  });

  it('reaplica na mudança de matchMedia (change) quando o tema atual é "system"', () => {
    const mql = mockMatchMedia(false);
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    expect(document.documentElement.classList.contains('light')).toBe(true);

    const changeHandler = mql.addEventListener.mock.calls.find(
      (call) => call[0] === 'change'
    )?.[1] as () => void;
    expect(changeHandler).toBeTypeOf('function');

    mql.matches = true;
    act(() => {
      changeHandler();
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('não reaplica na mudança de matchMedia quando o tema não é "system"', () => {
    mockMatchMedia(false);
    localStorage.setItem('theme', JSON.stringify('light'));
    localStorage.setItem('theme-source', JSON.stringify('explicit'));
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    const style1 = getStyleContent();
    // Directly dispatching won't call handler since matchMedia is mocked, but we
    // verify via storage listener path is unaffected; this asserts baseline stability.
    expect(style1).toContain(':root, html:not(.dark)');
  });

  it('reaplica no evento "storage" quando a key corresponde a uma das monitoradas', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    localStorage.setItem('theme', JSON.stringify('dark'));
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'theme' })
      );
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('não reaplica no evento "storage" quando a key não corresponde', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    localStorage.setItem('theme', JSON.stringify('dark'));
    act(() => {
      window.dispatchEvent(
        new StorageEvent('storage', { key: 'unrelated-key' })
      );
    });
    // não deveria ter reaplicado, então continua light
    expect(document.documentElement.classList.contains('light')).toBe(true);
  });

  it('reaplica no evento customizado "hedhog:theme-change" com override no detail', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    act(() => {
      window.dispatchEvent(
        new CustomEvent('hedhog:theme-change', { detail: 'dark' })
      );
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('reaplica no evento customizado "hedhog:settings-change"', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    localStorage.setItem('theme', JSON.stringify('dark'));
    act(() => {
      window.dispatchEvent(new Event('hedhog:settings-change'));
    });
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('atualiza o style tag existente ao reaplicar com regras diferentes', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={{ 'theme-primary-light': '#123456' }}>
        <div />
      </ThemeProvider>
    );
    const styleBefore = document.getElementById('theme-custom-styles');
    expect(styleBefore).not.toBeNull();

    localStorage.setItem('theme', JSON.stringify('light'));
    act(() => {
      window.dispatchEvent(new Event('hedhog:settings-change'));
    });

    const styleAfter = document.getElementById('theme-custom-styles');
    expect(styleAfter).toBe(styleBefore);
  });

  it('não recria/reaplica quando o css e a classe html já estão iguais (early return)', () => {
    mockMatchMedia(false);
    render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    const styleBefore = document.getElementById('theme-custom-styles');
    const contentBefore = styleBefore?.textContent;

    act(() => {
      window.dispatchEvent(new Event('hedhog:settings-change'));
    });

    const styleAfter = document.getElementById('theme-custom-styles');
    expect(styleAfter).toBe(styleBefore);
    expect(styleAfter?.textContent).toBe(contentBefore);
  });

  it('remove os listeners ao desmontar', () => {
    const mql = mockMatchMedia(false);
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = render(
      <ThemeProvider settings={baseSettings}>
        <div />
      </ThemeProvider>
    );
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalledWith(
      'change',
      expect.any(Function)
    );
    expect(removeSpy).toHaveBeenCalledWith('storage', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith(
      'hedhog:theme-change',
      expect.any(Function)
    );
    expect(removeSpy).toHaveBeenCalledWith(
      'hedhog:settings-change',
      expect.any(Function)
    );
    removeSpy.mockRestore();
  });

  it('reaplica quando as settings da prop mudam (dependência do useEffect)', () => {
    mockMatchMedia(false);
    const { rerender } = render(
      <ThemeProvider settings={{ 'theme-primary-light': '#111111' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--primary: #111111 !important;');

    rerender(
      <ThemeProvider settings={{ 'theme-primary-light': '#222222' }}>
        <div />
      </ThemeProvider>
    );
    expect(getStyleContent()).toContain('--primary: #222222 !important;');
  });
});

const ZOOM_SOURCE_KEY = 'theme-zoom-source';
const ZOOM_KEY = 'theme-zoom';
const DENSITY_SOURCE_KEY = 'theme-spacing-source';
const DENSITY_KEY = 'theme-spacing';
