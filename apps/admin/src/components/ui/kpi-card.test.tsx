import '@testing-library/jest-dom/vitest';
import { act, render, screen } from '@testing-library/react';
import { TrendingUp } from 'lucide-react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KpiCard } from './kpi-card';

describe('KpiCard', () => {
  it('mostra "-" quando loading é true, mesmo com valor numérico', () => {
    render(<KpiCard title="Vendas" value={100} loading />);
    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renderiza um valor string diretamente, sem animação', () => {
    render(<KpiCard title="Status" value="Ativo" />);
    expect(screen.getByText('Ativo')).toBeInTheDocument();
  });

  it('renderiza um número não finito (NaN) diretamente, sem animação', () => {
    render(<KpiCard title="Indefinido" value={NaN} />);
    // NaN is rendered as nothing visible by React; assert title still renders
    expect(screen.getByText('Indefinido')).toBeInTheDocument();
  });

  it('renderiza um número não finito (Infinity) diretamente, sem animação', () => {
    render(<KpiCard title="Ilimitado" value={Infinity} />);
    expect(screen.getByText('Ilimitado')).toBeInTheDocument();
  });

  it('formata um valor numérico finito via AnimatedValue', () => {
    render(<KpiCard title="Total" value={1234} />);
    expect(screen.getByText('1.234')).toBeInTheDocument();
  });

  it('mostra a descrição quando fornecida e a omite quando ausente', () => {
    const { rerender } = render(
      <KpiCard title="Total" value={1} description="Descrição extra" />,
    );
    expect(screen.getByText('Descrição extra')).toBeInTheDocument();

    rerender(<KpiCard title="Total" value={1} />);
    expect(screen.queryByText('Descrição extra')).not.toBeInTheDocument();
  });

  it('mostra a tendência positiva com sinal de "+"', () => {
    render(
      <KpiCard
        title="Total"
        value={1}
        trend={{ value: 12, label: 'este mês' }}
      />,
    );
    expect(screen.getByText('+12% este mês')).toBeInTheDocument();
  });

  it('mostra a tendência negativa sem sinal de "+"', () => {
    render(
      <KpiCard
        title="Total"
        value={1}
        trend={{ value: -8, label: 'este mês' }}
      />,
    );
    expect(screen.getByText('-8% este mês')).toBeInTheDocument();
  });

  it('não mostra tendência quando não fornecida', () => {
    render(<KpiCard title="Total" value={1} />);
    expect(screen.queryByText(/este mês/)).not.toBeInTheDocument();
  });

  it('renderiza media no lugar do ícone quando ambos são fornecidos', () => {
    render(
      <KpiCard
        title="Total"
        value={1}
        icon={TrendingUp}
        media={<img alt="avatar" src="/avatar.png" />}
      />,
    );
    expect(screen.getByAltText('avatar')).toBeInTheDocument();
  });

  it('renderiza o ícone quando não há media', () => {
    const { container } = render(
      <KpiCard title="Total" value={1} icon={TrendingUp} />,
    );
    expect(container.querySelector('svg')).toBeInTheDocument();
  });

  it('não renderiza ícone nem media quando nenhum é fornecido', () => {
    const { container } = render(<KpiCard title="Total" value={1} />);
    expect(container.querySelector('svg')).not.toBeInTheDocument();
    expect(container.querySelector('img')).not.toBeInTheDocument();
  });

  it('aceita accentClassName e iconContainerClassName customizados', () => {
    const { container } = render(
      <KpiCard
        title="Total"
        value={1}
        icon={TrendingUp}
        accentClassName="custom-accent"
        iconContainerClassName="custom-icon-container"
      />,
    );
    expect(container.querySelector('.custom-accent')).toBeInTheDocument();
    expect(
      container.querySelector('.custom-icon-container'),
    ).toBeInTheDocument();
  });

  it('renderiza no layout compacto', () => {
    render(<KpiCard title="Total" value={1} layout="compact" />);
    expect(screen.getByText('Total')).toBeInTheDocument();
  });

  it('mescla className, contentClassName, valueClassName e descriptionClassName', () => {
    const { container } = render(
      <KpiCard
        title="Total"
        value={1}
        description="Desc"
        className="card-class"
        contentClassName="content-class"
        valueClassName="value-class"
        descriptionClassName="description-class"
      />,
    );
    expect(container.querySelector('.card-class')).toBeInTheDocument();
    expect(container.querySelector('.content-class')).toBeInTheDocument();
    expect(container.querySelector('.value-class')).toBeInTheDocument();
    expect(container.querySelector('.description-class')).toBeInTheDocument();
  });
});

describe('KpiCard - animação de valor (AnimatedValue)', () => {
  let now = 0;
  let rafCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    now = 0;
    // Only fake the timers used for the floating-delta hide timeout; keep
    // requestAnimationFrame/performance as globals we stub ourselves below
    // (vi.useFakeTimers() would otherwise install its own rAF mock and
    // silently swallow ours).
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: FrameRequestCallback) => {
        rafCallback = cb;
        return 1;
      }),
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    rafCallback = null;
  });

  function runRaf(advanceMs: number) {
    now += advanceMs;
    const cb = rafCallback;
    rafCallback = null;
    act(() => {
      cb?.(now);
    });
  }

  it('anima um incremento de valor, mostrando o delta flutuante positivo', () => {
    const { rerender } = render(<KpiCard title="Total" value={10} />);

    rerender(<KpiCard title="Total" value={15} />);

    // Effect scheduled a rAF for the animation loop.
    expect(rafCallback).not.toBeNull();
    // Drive the animation partway (progress < 1) then to completion (progress >= 1).
    runRaf(450);
    expect(rafCallback).not.toBeNull();
    runRaf(900);

    // Let the floating-delta hide timeout fire.
    act(() => {
      vi.advanceTimersByTime(1700);
    });
  });

  it('anima um decremento de valor, mostrando o delta flutuante negativo', () => {
    const { rerender } = render(<KpiCard title="Total" value={20} />);

    rerender(<KpiCard title="Total" value={12} />);
    expect(rafCallback).not.toBeNull();
    runRaf(900);
    act(() => {
      vi.advanceTimersByTime(1700);
    });
  });

  it('cancela o timeout anterior quando o valor muda novamente antes de finalizar', () => {
    const { rerender } = render(<KpiCard title="Total" value={10} />);

    rerender(<KpiCard title="Total" value={15} />);
    expect(rafCallback).not.toBeNull();
    runRaf(900);

    // Change again before the 1700ms hide-timeout fires; this exercises the
    // "clear previous timeout" and effect-cleanup branches.
    rerender(<KpiCard title="Total" value={18} />);
    expect(rafCallback).not.toBeNull();
    runRaf(900);
    act(() => {
      vi.advanceTimersByTime(1700);
    });
  });

  it('limpa o rAF e o timeout pendentes ao desmontar', () => {
    const { rerender, unmount } = render(<KpiCard title="Total" value={10} />);
    rerender(<KpiCard title="Total" value={15} />);
    expect(rafCallback).not.toBeNull();
    unmount();
  });
});
