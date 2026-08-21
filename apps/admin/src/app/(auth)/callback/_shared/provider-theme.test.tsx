import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import {
  getOAuthProviderTheme,
  normalizeOAuthProviderName,
} from './provider-theme';

describe('normalizeOAuthProviderName', () => {
  it('normaliza e resolve um provider oauth conhecido', () => {
    expect(normalizeOAuthProviderName('google_oauth')).toBe('google');
    expect(normalizeOAuthProviderName('GITHUB_OAUTH')).toBe('github');
  });

  it('retorna o próprio slug normalizado quando não há mapeamento oauth', () => {
    expect(normalizeOAuthProviderName('unknown_provider')).toBe('unknown-provider');
  });
});

describe('getOAuthProviderTheme', () => {
  it('retorna as classes de tema e um ícone renderizável para o google', () => {
    const theme = getOAuthProviderTheme('google');
    expect(theme.titleClassName).toContain('1A73E8');
    expect(theme.cardClassName).toBeTruthy();
    expect(theme.iconContainerClassName).toBeTruthy();
    expect(theme.spinnerTopClassName).toBeTruthy();
    expect(theme.dotClassName).toBeTruthy();
    expect(theme.buttonClassName).toBeTruthy();

    const { container } = render(<>{theme.icon}</>);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('retorna o tema padrão (fallback) para um provider desconhecido', () => {
    const theme = getOAuthProviderTheme('some-unknown-provider');
    expect(theme.titleClassName).toBe('text-foreground');
    expect(theme.buttonClassName).toContain('bg-foreground');
  });

  it('resolve o tema de providers oauth específicos (github/facebook/microsoft/apple/linkedin)', () => {
    expect(getOAuthProviderTheme('github_oauth').cardClassName).toBeTruthy();
    expect(getOAuthProviderTheme('facebook_oauth').titleClassName).toContain('1877F2');
    expect(getOAuthProviderTheme('microsoft_oauth').titleClassName).toContain('0078D4');
    expect(getOAuthProviderTheme('apple_oauth').titleClassName).toBe('text-foreground');
    expect(getOAuthProviderTheme('linkedin_oauth').titleClassName).toContain('0A66C2');
  });
});
