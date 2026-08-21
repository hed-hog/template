import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

// Stands in for the subset written by `scripts/generate-icon-subset.mjs`. Its
// shape is flat and every entry carries concrete dimensions — the generator
// resolves the set-level defaults at generation time, so the component no longer
// has a `?? set.width ?? 256` path to exercise. Every slug in
// `providerLogoIcons` must be present: the component indexes the record
// directly, which is exactly what `LogoSlug` guarantees at compile time.
vi.mock('@/generated/integration-logos', () => ({
  logoIcons: {
    'google-icon': { body: '<path d="M1"/>', width: 24, height: 24 },
    'microsoft-icon': { body: '<path d="M2"/>', width: 256, height: 256 },
    'linkedin-icon': { body: '<path d="M3"/>', width: 256, height: 32 },
    'claude-icon': { body: '<path d="M4"/>', width: 256, height: 256 },
    'whatsapp-icon': { body: '<path d="M5"/>', width: 256, height: 256 },
    'google-gmail': { body: '<path d="M6"/>', width: 256, height: 256 },
    'aws-ses': { body: '<path d="M7"/>', width: 256, height: 256 },
    'aws-s3': { body: '<path d="M8"/>', width: 256, height: 256 },
    'google-cloud': { body: '<path d="M9"/>', width: 256, height: 256 },
    'microsoft-azure': { body: '<path d="M10"/>', width: 256, height: 256 },
    'digital-ocean-icon': { body: '<path d="M11"/>', width: 256, height: 256 },
    kubernetes: { body: '<path d="M12"/>', width: 256, height: 256 },
    'google-play-icon': { body: '<path d="M15"/>', width: 256, height: 283 },
    recaptcha: { body: '<path d="M13"/>', width: 256, height: 256 },
    'cloudflare-icon': { body: '<path d="M14"/>', width: 256, height: 256 },
    'deepseek-icon': { body: '<path d="M16"/>', width: 256, height: 256 },
    facebook: { body: '<path d="M17"/>', width: 256, height: 256 },
  },
}));

import {
  IntegrationLogo,
  formatIntegrationProviderName,
  getIntegrationLogoTheme,
  normalizeIntegrationProvider,
  resolveOAuthProvider,
} from './integration-logo';

describe('normalizeIntegrationProvider', () => {
  it('substitui underscores por hifens e normaliza caixa e espaços', () => {
    expect(normalizeIntegrationProvider('  Google_OAuth  ')).toBe(
      'google-oauth'
    );
  });

  it('resolve aliases conhecidos', () => {
    expect(normalizeIntegrationProvider('microsft')).toBe('microsoft');
    expect(normalizeIntegrationProvider('microsoft_entra_id')).toBe(
      'microsoft-entra-id'
    );
    expect(normalizeIntegrationProvider('whatsapp_official')).toBe(
      'whatsapp-official'
    );
    expect(normalizeIntegrationProvider('evolution_api')).toBe(
      'evolution-api'
    );
    expect(normalizeIntegrationProvider('azure_blob')).toBe('azure-blob');
    expect(normalizeIntegrationProvider('s3_compatible')).toBe(
      's3-compatible'
    );
  });

  it('retorna o valor normalizado quando não há alias', () => {
    expect(normalizeIntegrationProvider('stripe')).toBe('stripe');
  });
});

describe('resolveOAuthProvider', () => {
  it('resolve provedores oauth para o provedor base', () => {
    expect(resolveOAuthProvider('google_oauth')).toBe('google');
    expect(resolveOAuthProvider('github_oauth')).toBe('github');
    expect(resolveOAuthProvider('microsoft_oauth')).toBe('microsoft');
    expect(resolveOAuthProvider('facebook_oauth')).toBe('facebook');
    expect(resolveOAuthProvider('microsoft_entra_id_oauth')).toBe(
      'microsoft-entra-id'
    );
    expect(resolveOAuthProvider('apple_oauth')).toBe('apple');
    expect(resolveOAuthProvider('linkedin_oauth')).toBe('linkedin');
  });

  it('retorna o provedor normalizado quando não é oauth', () => {
    expect(resolveOAuthProvider('stripe')).toBe('stripe');
  });
});

describe('formatIntegrationProviderName', () => {
  it('usa o rótulo de providerLogoIcons pelo provedor resolvido (oauth)', () => {
    expect(formatIntegrationProviderName('google_oauth')).toBe('Google');
  });

  it('usa o rótulo de providerLogoIcons pelo provedor normalizado direto', () => {
    expect(formatIntegrationProviderName('gmail')).toBe('Gmail');
  });

  it('usa o rótulo de providerPresentations pelo provedor resolvido (oauth)', () => {
    expect(formatIntegrationProviderName('github_oauth')).toBe('GitHub');
  });

  it('usa o rótulo de providerPresentations pelo provedor normalizado direto', () => {
    expect(formatIntegrationProviderName('stripe')).toBe('Stripe');
  });

  it('usa o rótulo de categorizedFallbacks quando não há logo/presentation', () => {
    expect(formatIntegrationProviderName('smtp')).toBe('SMTP');
    expect(formatIntegrationProviderName('local')).toBe('Local');
    expect(formatIntegrationProviderName('s3_compatible')).toBe(
      'S3 Compatible'
    );
  });

  it('usa fallbackName informado quando não há nenhum rótulo conhecido', () => {
    expect(
      formatIntegrationProviderName('unknown_provider_xyz', '  Custom Name  ')
    ).toBe('Custom Name');
  });

  it('usa toTitleCase quando não há fallbackName nem rótulo conhecido', () => {
    expect(formatIntegrationProviderName('unknown_provider_xyz')).toBe(
      'Unknown Provider Xyz'
    );
  });

  it('ignora fallbackName vazio/whitespace e cai para toTitleCase', () => {
    expect(formatIntegrationProviderName('unknown_provider_xyz', '   ')).toBe(
      'Unknown Provider Xyz'
    );
  });
});

describe('getIntegrationLogoTheme', () => {
  it('retorna tema do google', () => {
    expect(getIntegrationLogoTheme('google_oauth').dotClassName).toBe(
      'bg-[#4285F4]'
    );
  });

  it('retorna tema do facebook', () => {
    expect(getIntegrationLogoTheme('facebook_oauth').dotClassName).toBe(
      'bg-[#1877F2]'
    );
  });

  it('retorna tema do microsoft', () => {
    expect(getIntegrationLogoTheme('microsoft_oauth').dotClassName).toBe(
      'bg-[#00a4ef]'
    );
  });

  it('retorna tema do microsoft entra id, distinto do microsoft', () => {
    expect(getIntegrationLogoTheme('microsoft_entra_id_oauth').dotClassName).toBe(
      'bg-[#0294e4]'
    );
  });

  it('retorna tema do apple', () => {
    expect(getIntegrationLogoTheme('apple_oauth').dotClassName).toBe(
      'bg-foreground'
    );
  });

  it('retorna tema do linkedin', () => {
    expect(getIntegrationLogoTheme('linkedin_oauth').dotClassName).toBe(
      'bg-[#0A66C2]'
    );
  });

  it('retorna tema padrão para provedores desconhecidos', () => {
    expect(getIntegrationLogoTheme('stripe').dotClassName).toBe(
      'bg-foreground'
    );
  });
});

describe('IntegrationLogo', () => {
  it('renderiza o logo colorido do iconify com o viewBox do ícone', () => {
    const { container } = render(<IntegrationLogo provider="google" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
    expect(svg).toHaveAttribute('height', '20');
  });

  it('preserva a proporção de ícones não-quadrados na largura', () => {
    const { container } = render(<IntegrationLogo provider="google_play" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg).toHaveAttribute('viewBox', '0 0 256 283');
    // 20 (size) * 256 / 283, arredondado.
    expect(svg).toHaveAttribute('width', '18');
  });

  it('renderiza a apresentação customizada (SVG próprio) quando não há logo iconify', () => {
    const { container } = render(<IntegrationLogo provider="apple" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renderiza o ícone Lucide MessageCircle para provedores de mensagens', () => {
    render(<IntegrationLogo provider="whatsapp_unofficial" />);
    expect(document.querySelector('svg.lucide-message-circle')).toBeTruthy();
  });

  it('renderiza o ícone Lucide Sparkles para provedores de IA', () => {
    render(<IntegrationLogo provider="my-ai-service" />);
    expect(document.querySelector('svg.lucide-sparkles')).toBeTruthy();
  });

  it('avalia o branch normalized === "claude" na apresentação padrão (mesmo com logo iconify disponível)', () => {
    // "claude" não contém a substring "ai" nem bate em providerPresentations/
    // categorizedFallbacks, então o objeto de apresentação padrão (com o
    // ternário Sparkles/Mail/HardDrive/PlugZap) é sempre construído — mesmo
    // que o ícone final exibido seja o logo iconify (prioridade sobre a
    // apresentação). Isso exercita o branch `normalized === 'claude'`.
    const { container } = render(<IntegrationLogo provider="claude" />);
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('renderiza o ícone Lucide HardDrive para provedores de armazenamento', () => {
    render(<IntegrationLogo provider="custom_storage_service" />);
    expect(document.querySelector('svg.lucide-hard-drive')).toBeTruthy();
  });

  it('renderiza o logo colorido do Google Play para o slug google_play', () => {
    const { container } = render(
      <IntegrationLogo provider="google_play" decorative={false} />
    );
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('viewBox', '0 0 256 283');
    expect(container.querySelector('svg.lucide-plug-zap')).toBeFalsy();
    expect(container.querySelector('[role="img"]')).toHaveAttribute(
      'aria-label',
      'Google Play Billing'
    );
  });

  it('renderiza o ícone Lucide PlugZap como fallback genérico', () => {
    render(<IntegrationLogo provider="totally_unknown_thing" />);
    expect(document.querySelector('svg.lucide-plug-zap')).toBeTruthy();
  });

  it('respeita o título customizado', () => {
    const { getByTitle } = render(
      <IntegrationLogo provider="google" title="Custom Title" />
    );
    expect(getByTitle('Custom Title')).toBeTruthy();
  });

  it('aplica className customizada', () => {
    const { container } = render(
      <IntegrationLogo provider="google" className="my-class" />
    );
    expect(container.querySelector('span')).toHaveClass('my-class');
  });

  it('é decorativo por padrão (aria-hidden, sem role)', () => {
    const { container } = render(<IntegrationLogo provider="google" />);
    const span = container.querySelector('span');
    expect(span).toHaveAttribute('aria-hidden', 'true');
    expect(span).not.toHaveAttribute('role');
    expect(span).not.toHaveAttribute('aria-label');
  });

  it('expõe role=img e aria-label quando não é decorativo', () => {
    const { container } = render(
      <IntegrationLogo provider="google" decorative={false} />
    );
    const span = container.querySelector('span');
    expect(span).toHaveAttribute('role', 'img');
    expect(span).toHaveAttribute('aria-label', 'Google');
    expect(span).toHaveAttribute('aria-hidden', 'false');
  });
});
