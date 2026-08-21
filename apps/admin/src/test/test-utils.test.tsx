import { describe, it, expect, vi } from 'vitest';
import type { ReactNode } from 'react';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), refresh: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('@bprogress/next', () => ({
  AppProgressProvider: ({ children }: { children: ReactNode }) => children,
}));

import { render, screen } from '@testing-library/react';
import { renderWithProviders, makeAppProviderWrapper } from './test-utils';
import { useQuery } from '@tanstack/react-query';
import { useApp } from '@hed-hog/next-app-provider';

function QueryProbe() {
  const { data } = useQuery({ queryKey: ['probe'], queryFn: () => Promise.resolve('ok') });
  return <span>{data ?? 'loading'}</span>;
}

function AppProbe() {
  const { getSettingValue } = useApp();
  return <span>{String(getSettingValue('nonexistent') ?? 'sem-valor')}</span>;
}

describe('test-utils', () => {
  it('renderWithProviders envolve em QueryClientProvider e resolve queries', async () => {
    renderWithProviders(<QueryProbe />);
    expect(await screen.findByText('ok')).toBeInTheDocument();
  });

  it('renderWithProviders aceita um queryClient customizado', () => {
    const { queryClient } = renderWithProviders(<QueryProbe />, {});
    expect(queryClient).toBeDefined();
  });

  it('makeAppProviderWrapper expõe o AppProvider real com uma apiBaseUrl customizada', () => {
    const Wrapper = makeAppProviderWrapper({ apiBaseUrl: 'http://custom.test' });
    render(<AppProbe />, { wrapper: Wrapper });
    expect(screen.getByText('sem-valor')).toBeInTheDocument();
  });

  it('makeAppProviderWrapper usa settings, locales e queryClient padrão quando só a apiBaseUrl é informada', () => {
    const Wrapper = makeAppProviderWrapper({ apiBaseUrl: 'http://default.test' });
    render(<AppProbe />, { wrapper: Wrapper });
    expect(screen.getByText('sem-valor')).toBeInTheDocument();
  });

});
