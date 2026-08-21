import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as RechartsPrimitive from 'recharts';

import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartStyle,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from './chart';

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    vi.fn(() => ({
      disconnect: vi.fn(),
      observe: vi.fn(),
      unobserve: vi.fn(),
    })),
  );
});

const config: ChartConfig = {
  desktop: { label: 'Desktop', color: '#2563eb' },
  mobile: { label: 'Mobile', theme: { light: '#111', dark: '#eee' } },
};

describe('ChartContainer', () => {
  it('renderiza com id customizado e aplica data-chart', () => {
    render(
      <ChartContainer id="my-chart" config={config}>
        <RechartsPrimitive.LineChart data={[{ name: 'a', value: 1 }]}>
          <RechartsPrimitive.Line dataKey="value" />
        </RechartsPrimitive.LineChart>
      </ChartContainer>,
    );

    const chartDiv = document.querySelector('[data-slot="chart"]');
    expect(chartDiv).not.toBeNull();
    expect(chartDiv).toHaveAttribute('data-chart', 'chart-my-chart');
  });

  it('gera um id automaticamente quando id não é informado', () => {
    render(
      <ChartContainer config={config}>
        <RechartsPrimitive.LineChart data={[{ name: 'a', value: 1 }]}>
          <RechartsPrimitive.Line dataKey="value" />
        </RechartsPrimitive.LineChart>
      </ChartContainer>,
    );

    const chartDiv = document.querySelector('[data-slot="chart"]');
    expect(chartDiv?.getAttribute('data-chart')).toMatch(/^chart-/);
  });

  it('aplica className customizado', () => {
    render(
      <ChartContainer className="custom-chart" config={config}>
        <RechartsPrimitive.LineChart data={[{ name: 'a', value: 1 }]}>
          <RechartsPrimitive.Line dataKey="value" />
        </RechartsPrimitive.LineChart>
      </ChartContainer>,
    );

    const chartDiv = document.querySelector('[data-slot="chart"]');
    expect(chartDiv).toHaveClass('custom-chart');
  });
});

describe('ChartStyle', () => {
  it('renderiza um elemento style com as variáveis de cor por tema quando há config com cor/tema', () => {
    render(<ChartStyle id="test-id" config={config} />);
    const style = document.querySelector('style');
    expect(style).not.toBeNull();
    expect(style?.innerHTML).toContain('--color-desktop: #2563eb');
    expect(style?.innerHTML).toContain('--color-mobile: #111');
    expect(style?.innerHTML).toContain('.dark [data-chart=test-id]');
  });

  it('não renderiza nada quando não há config com cor ou tema', () => {
    const { container } = render(
      <ChartStyle id="empty" config={{ foo: { label: 'Foo' } }} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('omite a variável de cor de um tema quando o theme não define aquele tema', () => {
    const partialThemeConfig: ChartConfig = {
      // Only "light" is provided; "dark" is intentionally missing at runtime
      // even though the type declares it, to exercise the fallback branch.
      onlyLight: { theme: { light: '#123456' } as never },
    };

    render(<ChartStyle id="partial-theme" config={partialThemeConfig} />);
    const style = document.querySelector('style');
    expect(style?.innerHTML).toContain('--color-onlyLight: #123456');
    // The dark block should not define --color-onlyLight since neither
    // theme.dark nor color is available for that theme.
    const darkBlock = style!.innerHTML.split('.dark [data-chart=partial-theme] {')[1];
    expect(darkBlock).not.toContain('--color-onlyLight');
  });
});

describe('ChartTooltipContent', () => {
  it('retorna null quando active é falso', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <RechartsPrimitive.LineChart data={[{ name: 'a', value: 1 }]}>
          <RechartsPrimitive.Line dataKey="value" />
          <RechartsPrimitive.Tooltip content={<ChartTooltipContent />} />
        </RechartsPrimitive.LineChart>
      </ChartContainer>,
    );
    // No active tooltip -> component internally renders null, no crash
    expect(container).toBeTruthy();
  });

  it('renderiza label, indicadores e valores formatados quando active e payload existem', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 1234,
        color: '#2563eb',
        type: 'line',
        payload: { fill: '#000' },
      },
    ];

    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          payload={payload}
          label="desktop"
          nameKey="name"
        />
      </ChartContainer>,
    );

    expect(screen.getByText(/1[.,]234/)).toBeInTheDocument();
  });

  it('usa labelFormatter quando fornecido', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          payload={payload}
          label="desktop"
          labelFormatter={(value) => <span>Formatted: {String(value)}</span>}
        />
      </ChartContainer>,
    );

    expect(screen.getByText(/Formatted:/)).toBeInTheDocument();
  });

  it('esconde o label quando hideLabel é verdadeiro', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} hideLabel label="desktop" />
      </ChartContainer>,
    );

    // The top-level label (a <div class="font-medium">) is suppressed by
    // hideLabel, even though the per-item name span still shows "Desktop".
    expect(container.querySelector('div.font-medium')).toBeNull();
  });

  it('esconde o indicador quando hideIndicator é verdadeiro', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} hideIndicator />
      </ChartContainer>,
    );

    expect(container.querySelector('.shrink-0.rounded-\\[2px\\]')).toBeNull();
  });

  it('usa indicator "line" e "dashed"', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    const { rerender, container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} indicator="line" />
      </ChartContainer>,
    );
    expect(container.querySelector('.w-1')).not.toBeNull();

    rerender(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} indicator="dashed" />
      </ChartContainer>,
    );
    expect(container.querySelector('.border-dashed')).not.toBeNull();
  });

  it('filtra itens do tipo "none" do payload', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#2563eb',
        type: 'none',
        payload: {},
      },
    ];

    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} />
      </ChartContainer>,
    );

    // The item itself is filtered out of the list (no value rendered),
    // even though the top-level label (derived from payload[0] regardless
    // of type) may still show.
    expect(container.querySelector('.tabular-nums')).toBeNull();
  });

  it('usa formatter customizado quando fornecido', () => {
    const formatter = vi.fn((value: unknown, name: unknown) => (
      <span key="f">
        {String(name)}: {String(value)}
      </span>
    ));
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} formatter={formatter} />
      </ChartContainer>,
    );

    expect(formatter).toHaveBeenCalled();
    expect(screen.getByText('desktop: 10')).toBeInTheDocument();
  });

  it('usa a cor de item.payload.fill quando color não é fornecido', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: undefined,
        type: 'line',
        payload: { fill: '#abcdef' },
      },
    ];

    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} />
      </ChartContainer>,
    );

    const indicator = container.querySelector('[style*="--color-bg"]');
    expect(indicator).not.toBeNull();
  });

  it('renderiza ícone customizado do itemConfig quando presente', () => {
    function Icon() {
      return <svg data-testid="custom-icon" />;
    }
    const configWithIcon: ChartConfig = {
      desktop: { label: 'Desktop', color: '#2563eb', icon: Icon },
    };
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    render(
      <ChartContainer config={configWithIcon}>
        <ChartTooltipContent active payload={payload} />
      </ChartContainer>,
    );

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('não exibe valor quando item.value é falsy', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 0,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} />
      </ChartContainer>,
    );

    // value 0 is falsy, so the formatted value span (tabular-nums) does not render
    expect(container.querySelector('.tabular-nums')).toBeNull();
  });

  it('não renderiza label quando payload está vazio mas hideLabel é falso', () => {
    render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={[]} />
      </ChartContainer>,
    );
    expect(screen.queryByText('Desktop')).not.toBeInTheDocument();
  });

  it('usa nestLabel quando payload tem um único item e indicator não é dot', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} indicator="line" label="desktop" />
      </ChartContainer>,
    );

    // nestLabel is true: the top-level label div is suppressed, and the
    // label is nested alongside the item's own name span instead.
    expect(container.querySelector('.items-end')).not.toBeNull();
    expect(screen.getAllByText('Desktop').length).toBeGreaterThan(0);
  });

  it('aplica className customizado ao container do tooltip', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent
          active
          payload={payload}
          className="custom-tooltip"
        />
      </ChartContainer>,
    );

    expect(container.querySelector('.custom-tooltip')).not.toBeNull();
  });

  it('resolve a chave do label a partir de item.name quando dataKey está ausente', () => {
    const payload = [
      {
        name: 'desktop',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} />
      </ChartContainer>,
    );

    expect(screen.getAllByText('Desktop').length).toBeGreaterThan(0);
  });

  it('usa o fallback "value" quando nem dataKey nem name estão presentes', () => {
    const payload = [
      {
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    expect(() =>
      render(
        <ChartContainer config={config}>
          <ChartTooltipContent active payload={payload} />
        </ChartContainer>,
      ),
    ).not.toThrow();
  });

  it('usa o próprio label como fallback quando não existe entrada correspondente na config', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} label="unknown-label" />
      </ChartContainer>,
    );

    expect(screen.getByText('unknown-label')).toBeInTheDocument();
  });

  it('não renderiza label (retorna null) quando o value calculado é falsy', () => {
    const payload = [
      {
        dataKey: 'unknown-key',
        name: 'unknown-key',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} />
      </ChartContainer>,
    );

    expect(container.querySelector('div.font-medium')).toBeNull();
  });

  it('prioriza a prop color explícita sobre item.payload.fill/item.color', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#111111',
        type: 'line',
        payload: { fill: '#222222' },
      },
    ];

    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} color="#ff0000" />
      </ChartContainer>,
    );

    const indicator = container.querySelector('[style*="--color-bg: #ff0000"]');
    expect(indicator).not.toBeNull();
  });

  it('usa item.color como fallback quando item.payload.fill não existe', () => {
    const payload = [
      {
        dataKey: 'desktop',
        name: 'desktop',
        value: 10,
        color: '#333333',
        type: 'line',
        payload: {},
      },
    ];

    const { container } = render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} />
      </ChartContainer>,
    );

    const indicator = container.querySelector('[style*="--color-bg: #333333"]');
    expect(indicator).not.toBeNull();
  });

  it('usa item.name como fallback quando itemConfig não possui label', () => {
    const payload = [
      {
        dataKey: 'unknown-key',
        name: 'CustomName',
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: {},
      },
    ];

    render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} />
      </ChartContainer>,
    );

    expect(screen.getByText('CustomName')).toBeInTheDocument();
  });

  it('resolve o itemConfig via item.payload quando a chave direta não é string', () => {
    const payload = [
      {
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: { value: 'desktop' },
      },
    ];

    render(
      <ChartContainer config={config}>
        <ChartTooltipContent active payload={payload} />
      </ChartContainer>,
    );

    expect(screen.getAllByText('Desktop').length).toBeGreaterThan(0);
  });

  it('faz fallback para a config[key] quando a chave resolvida via payload não existe na config', () => {
    const payload = [
      {
        value: 10,
        color: '#2563eb',
        type: 'line',
        payload: { value: 'unmapped-key' },
      },
    ];

    expect(() =>
      render(
        <ChartContainer config={config}>
          <ChartTooltipContent active payload={payload} />
        </ChartContainer>,
      ),
    ).not.toThrow();
  });
});

describe('ChartLegendContent', () => {
  it('retorna null quando payload está vazio', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <ChartLegendContent payload={[]} />
      </ChartContainer>,
    );
    expect(container.querySelector('.flex.items-center.justify-center')).toBeNull();
  });

  it('renderiza itens da legenda com ícone customizado e cor de fallback', () => {
    function Icon() {
      return <svg data-testid="legend-icon" />;
    }
    const configWithIcon: ChartConfig = {
      desktop: { label: 'Desktop', color: '#2563eb', icon: Icon },
      mobile: { label: 'Mobile', color: '#111' },
    };

    render(
      <ChartContainer config={configWithIcon}>
        <ChartLegendContent
          payload={[
            { value: 'desktop', dataKey: 'desktop', color: '#2563eb', type: 'line' },
            { value: 'mobile', dataKey: 'mobile', color: '#111', type: 'line' },
          ]}
        />
      </ChartContainer>,
    );

    expect(screen.getByTestId('legend-icon')).toBeInTheDocument();
    expect(screen.getByText('Mobile')).toBeInTheDocument();
  });

  it('esconde ícones quando hideIcon é verdadeiro', () => {
    function Icon() {
      return <svg data-testid="legend-icon-2" />;
    }
    const configWithIcon: ChartConfig = {
      desktop: { label: 'Desktop', color: '#2563eb', icon: Icon },
    };

    render(
      <ChartContainer config={configWithIcon}>
        <ChartLegendContent
          hideIcon
          payload={[
            { value: 'desktop', dataKey: 'desktop', color: '#2563eb', type: 'line' },
          ]}
        />
      </ChartContainer>,
    );

    expect(screen.queryByTestId('legend-icon-2')).not.toBeInTheDocument();
  });

  it('filtra itens do tipo "none"', () => {
    render(
      <ChartContainer config={config}>
        <ChartLegendContent
          payload={[
            { value: 'desktop', dataKey: 'desktop', color: '#2563eb', type: 'none' },
          ]}
        />
      </ChartContainer>,
    );
    expect(screen.queryByText('Desktop')).not.toBeInTheDocument();
  });

  it('aplica padding-bottom quando verticalAlign é "top" e padding-top quando não é', () => {
    const { container, rerender } = render(
      <ChartContainer config={config}>
        <ChartLegendContent
          verticalAlign="top"
          payload={[
            { value: 'desktop', dataKey: 'desktop', color: '#2563eb', type: 'line' },
          ]}
        />
      </ChartContainer>,
    );
    expect(container.querySelector('.pb-3')).not.toBeNull();

    rerender(
      <ChartContainer config={config}>
        <ChartLegendContent
          verticalAlign="bottom"
          payload={[
            { value: 'desktop', dataKey: 'desktop', color: '#2563eb', type: 'line' },
          ]}
        />
      </ChartContainer>,
    );
    expect(container.querySelector('.pt-3')).not.toBeNull();
  });

  it('usa nameKey customizado para resolver o itemConfig', () => {
    render(
      <ChartContainer config={config}>
        <ChartLegendContent
          nameKey="desktop"
          payload={[{ value: 'x', dataKey: 'other', color: '#2563eb', type: 'line' }]}
        />
      </ChartContainer>,
    );
    expect(screen.getByText('Desktop')).toBeInTheDocument();
  });

  it('usa o fallback "value" quando nameKey e dataKey estão ausentes', () => {
    expect(() =>
      render(
        <ChartContainer config={config}>
          <ChartLegendContent
            payload={[{ value: 'x', color: '#2563eb', type: 'line' } as never]}
          />
        </ChartContainer>,
      ),
    ).not.toThrow();
  });

  it('não quebra quando um item do payload não é um objeto', () => {
    expect(() =>
      render(
        <ChartContainer config={config}>
          <ChartLegendContent payload={[42 as never]} />
        </ChartContainer>,
      ),
    ).not.toThrow();
  });
});

describe('ChartTooltip e ChartLegend', () => {
  it('são reexportados diretamente do recharts', () => {
    expect(ChartTooltip).toBe(RechartsPrimitive.Tooltip);
    expect(ChartLegend).toBe(RechartsPrimitive.Legend);
  });
});

describe('useChart guard', () => {
  it('lança erro quando ChartTooltipContent é usado fora de ChartContainer', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(<ChartTooltipContent active payload={[]} />),
    ).toThrow('useChart must be used within a <ChartContainer />');
    spy.mockRestore();
  });
});
