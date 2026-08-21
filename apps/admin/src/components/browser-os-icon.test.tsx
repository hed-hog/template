import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import {
  BrowserIcon,
  CountryFlag,
  OsIcon,
  countryFlag,
} from './browser-os-icon';

describe('BrowserIcon', () => {
  it('renderiza o logo conhecido (chrome)', () => {
    const { container } = render(<BrowserIcon name="Chrome" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('normaliza espaços e maiúsculas (mobile safari)', () => {
    const { container } = render(<BrowserIcon name="Mobile  Safari" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('cai no ícone padrão (Monitor) quando desconhecido', () => {
    const { container } = render(<BrowserIcon name="UnknownBrowser" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('cai no ícone padrão quando nome é nulo/indefinido', () => {
    const { container } = render(<BrowserIcon name={null} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('aceita className e size customizados', () => {
    const { container } = render(
      <BrowserIcon name={undefined} className="my-class" size={30} />,
    );
    expect(container.querySelector('svg.my-class')).toBeInTheDocument();
  });

  it('usa width/height próprios do ícone quando definidos no set (vivaldi)', () => {
    const { container } = render(<BrowserIcon name="vivaldi" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});

describe('OsIcon', () => {
  it('renderiza o logo conhecido (windows)', () => {
    const { container } = render(<OsIcon name="Windows" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('renderiza nulo quando o nome é desconhecido', () => {
    const { container } = render(<OsIcon name="PlanetExpress OS" />);
    expect(container.innerHTML).toBe('');
  });

  it('renderiza nulo quando o nome é indefinido', () => {
    const { container } = render(<OsIcon name={undefined} />);
    expect(container.innerHTML).toBe('');
  });

  it('aceita className e size customizados', () => {
    const { container } = render(<OsIcon name="linux" className="my-os" size={20} />);
    expect(container.querySelector('svg.my-os')).toBeInTheDocument();
  });
});

// The flag subset is loaded with a dynamic `import()`, so the first paint is
// always the emoji span and the `<svg>` only replaces it on a later tick.
describe('CountryFlag', () => {
  it('mostra o emoji de imediato e troca pelo ícone colorido quando o chunk chega', async () => {
    const { container } = render(<CountryFlag code="br" className="flag" />);
    expect(container.querySelector('span.flag')).toBeInTheDocument();
    // O chunk dinâmico tem 1,9 MB; sob carga da suíte completa, o import()
    // demora mais que o timeout padrão de 1s do waitFor.
    await waitFor(
      () => expect(container.querySelector('svg.flag')).toBeInTheDocument(),
      { timeout: 5000 }
    );
  });

  it('retorna nulo para código nulo', () => {
    const { container } = render(<CountryFlag code={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('retorna nulo para código com tamanho diferente de 2', () => {
    const { container } = render(<CountryFlag code="brazil" />);
    expect(container.innerHTML).toBe('');
  });

  it('usa altura customizada e width padrão calculado', async () => {
    const { container } = render(<CountryFlag code="us" width={40} className="flag" />);
    await waitFor(
      () => expect(container.querySelector('svg.flag')).toBeInTheDocument(),
      { timeout: 5000 }
    );
    expect(container.querySelector('svg.flag')).toHaveAttribute('height', '30');
  });

  it('usa height explícito quando fornecido', async () => {
    const { container } = render(<CountryFlag code="us" width={40} height={50} />);
    await waitFor(
      () => expect(container.querySelector('svg')).toBeInTheDocument(),
      { timeout: 5000 }
    );
    expect(container.querySelector('svg')).toHaveAttribute('height', '50');
  });

  it('permanece no emoji quando o código não está no set de ícones', async () => {
    render(<CountryFlag code="zz" className="emoji-flag" />);
    // "zz" não é um ISO válido no set de bandeiras: o upgrade nunca acontece.
    const span = document.querySelector('span.emoji-flag');
    expect(span).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('img')).not.toBeInTheDocument());
    expect(document.querySelector('svg')).not.toBeInTheDocument();
  });
});

describe('countryFlag', () => {
  it('converte um código de país válido em emoji', () => {
    expect(countryFlag('US')).toBe('🇺🇸');
  });

  it('funciona com letras minúsculas', () => {
    expect(countryFlag('br')).toBe('🇧🇷');
  });

  it('retorna string vazia para código nulo/indefinido', () => {
    expect(countryFlag(null)).toBe('');
    expect(countryFlag(undefined)).toBe('');
  });

  it('retorna string vazia para código com tamanho inválido', () => {
    expect(countryFlag('brazil')).toBe('');
  });
});
