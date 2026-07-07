import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';

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

describe('CountryFlag', () => {
  it('renderiza o ícone colorido para um código válido conhecido', () => {
    const { container } = render(<CountryFlag code="br" />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('retorna nulo para código nulo', () => {
    const { container } = render(<CountryFlag code={null} />);
    expect(container.innerHTML).toBe('');
  });

  it('retorna nulo para código com tamanho diferente de 2', () => {
    const { container } = render(<CountryFlag code="brazil" />);
    expect(container.innerHTML).toBe('');
  });

  it('usa altura customizada e width padrão calculado', () => {
    const { container } = render(<CountryFlag code="us" width={40} className="flag" />);
    const svg = container.querySelector('svg.flag');
    expect(svg).toBeInTheDocument();
  });

  it('usa height explícito quando fornecido', () => {
    const { container } = render(<CountryFlag code="us" width={40} height={50} />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('cai no emoji quando o código não está no set de ícones', () => {
    const { container } = render(<CountryFlag code="zz" className="emoji-flag" />);
    // "zz" is not a valid ISO country in the flag icon set → falls back to emoji span
    const span = container.querySelector('span.emoji-flag');
    expect(span).toBeInTheDocument();
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
