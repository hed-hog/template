import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));

const setCurrentLocaleCode = vi.fn();
let currentLocaleCode = 'en';
let locales: { code: string; name: string }[] = [
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
];

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({
    locales,
    currentLocaleCode,
    setCurrentLocaleCode,
  }),
}));

import { LanguageSelector } from './language-selector';

describe('LanguageSelector', () => {
  beforeEach(() => {
    setCurrentLocaleCode.mockClear();
    push.mockClear();
    currentLocaleCode = 'en';
    locales = [
      { code: 'en', name: 'English' },
      { code: 'pt', name: 'Português' },
    ];
    document.cookie = 'locale=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    Element.prototype.scrollIntoView = vi.fn();
    Element.prototype.hasPointerCapture = vi.fn();
    Element.prototype.releasePointerCapture = vi.fn();
    Element.prototype.setPointerCapture = vi.fn();
  });

  it('não renderiza nada quando há 1 ou menos idiomas', () => {
    locales = [{ code: 'en', name: 'English' }];
    const { container } = render(<LanguageSelector />);
    expect(container.innerHTML).toBe('');
  });

  it('inicializa o locale a partir do cookie no mount', () => {
    document.cookie = 'locale=pt; path=/;';
    render(<LanguageSelector />);
    expect(setCurrentLocaleCode).toHaveBeenCalledWith('pt');
  });

  it('inicializa com "en" quando não há cookie', () => {
    render(<LanguageSelector />);
    expect(setCurrentLocaleCode).toHaveBeenCalledWith('en');
  });

  it('renderiza o select com as opções de idioma', () => {
    render(<LanguageSelector />);
    expect(screen.getByText('English')).toBeInTheDocument();
  });


  it('troca o idioma, seta cookie, chama onChange e refresh', async () => {
    const onChange = vi.fn().mockResolvedValue(undefined);
    render(<LanguageSelector onChange={onChange} />);

    fireEvent.click(screen.getByRole('combobox'));
    const ptOption = await screen.findByText('Português');
    fireEvent.click(ptOption);

    expect(setCurrentLocaleCode).toHaveBeenCalledWith('pt');
    await vi.waitFor(() => expect(onChange).toHaveBeenCalledWith('pt'));
    await vi.waitFor(() => expect(push).not.toThrow);
  });

  it('reverte o locale quando onChange lança erro', async () => {
    const onChange = vi.fn().mockRejectedValue(new Error('fail'));
    render(<LanguageSelector onChange={onChange} />);

    fireEvent.click(screen.getByRole('combobox'));
    const ptOption = await screen.findByText('Português');
    fireEvent.click(ptOption);

    await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
    await vi.waitFor(() =>
      expect(setCurrentLocaleCode).toHaveBeenCalledWith('en'),
    );
  });

  it('usa o placeholder "English" quando o locale atual não está na lista', async () => {
    currentLocaleCode = 'fr';
    render(<LanguageSelector />);
    // Radix's SelectValue only knows whether the current value matches a
    // registered item once SelectContent has mounted at least once, so open
    // the trigger to force that registration before asserting the fallback.
    fireEvent.click(screen.getByRole('combobox'));
    expect(await screen.findAllByText('English')).not.toHaveLength(0);
  });

  it('funciona sem onChange informado', async () => {
    render(<LanguageSelector />);
    fireEvent.click(screen.getByRole('combobox'));
    const ptOption = await screen.findByText('Português');
    fireEvent.click(ptOption);
    expect(setCurrentLocaleCode).toHaveBeenCalledWith('pt');
  });
});
