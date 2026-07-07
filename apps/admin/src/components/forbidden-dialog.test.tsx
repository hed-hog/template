import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock('next/navigation', () => ({
  usePathname: () => '/core/account',
}));

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

const setForbiddenError = vi.fn();
let forbiddenError: {
  show: boolean;
  message: string;
  url: string;
  method: string;
  statusCode?: number;
} = { show: false, message: '', url: '', method: '', statusCode: undefined };
let user: { id?: number; name?: string } | null = { id: 7, name: 'Root' };
let userEmail = 'root@example.com';

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({ forbiddenError, setForbiddenError, user, userEmail }),
}));

import { ForbiddenDialog } from './forbidden-dialog';

describe('ForbiddenDialog', () => {
  beforeEach(() => {
    setForbiddenError.mockClear();
    toastSuccess.mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    forbiddenError = {
      show: false,
      message: '',
      url: '',
      method: '',
      statusCode: undefined,
    };
    user = { id: 7, name: 'Root' };
    userEmail = 'root@example.com';
  });

  it('não mostra o conteúdo quando forbiddenError.show é falso', () => {
    render(<ForbiddenDialog />);
    expect(screen.queryByText('title')).not.toBeInTheDocument();
  });

  it('mostra a mensagem padrão e não mostra detalhes técnicos quando não há dados', () => {
    forbiddenError = {
      show: true,
      message: '',
      url: '',
      method: '',
      statusCode: undefined,
    };
    render(<ForbiddenDialog />);
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getAllByText('defaultMessage').length).toBeGreaterThan(0);
    expect(screen.queryByText(/statusCode:/)).not.toBeInTheDocument();
  });

  it('mostra mensagem customizada e detalhes técnicos (status/method/url)', () => {
    forbiddenError = {
      show: true,
      message: 'Acesso negado',
      url: '/api/secret',
      method: 'GET',
      statusCode: 403,
    };
    render(<ForbiddenDialog />);
    expect(screen.getByText('Acesso negado')).toBeInTheDocument();
    expect(screen.getByText(/statusCode: 403/)).toBeInTheDocument();
    expect(screen.getByText(/method:/)).toBeInTheDocument();
    expect(screen.getByText(/url:/)).toBeInTheDocument();
  });

  it('mostra somente o method quando statusCode e url estão ausentes', () => {
    forbiddenError = {
      show: true,
      message: '',
      url: '',
      method: 'DELETE',
      statusCode: undefined,
    };
    render(<ForbiddenDialog />);
    expect(screen.getByText(/method:/)).toBeInTheDocument();
    expect(screen.queryByText(/statusCode:/)).not.toBeInTheDocument();
  });

  it('mostra somente a url quando statusCode e method estão ausentes', () => {
    forbiddenError = {
      show: true,
      message: '',
      url: '/only/url',
      method: '',
      statusCode: undefined,
    };
    render(<ForbiddenDialog />);
    expect(screen.getByText(/url:/)).toBeInTheDocument();
    expect(screen.queryByText(/method:/)).not.toBeInTheDocument();
  });

  it('exibe usuário sem id e sem e-mail com fallback "—"', () => {
    forbiddenError = { show: true, message: '', url: '', method: '', statusCode: undefined };
    user = { name: 'SemId' };
    userEmail = '';
    render(<ForbiddenDialog />);
    fireEvent.click(screen.getByText('technicalDetails'));
    expect(screen.getByText(/SemId/)).toBeInTheDocument();
  });

  it('exibe "—" quando não há usuário', () => {
    forbiddenError = { show: true, message: '', url: '', method: '', statusCode: undefined };
    user = null;
    render(<ForbiddenDialog />);
    fireEvent.click(screen.getByText('technicalDetails'));
    expect(screen.getAllByText(/—/).length).toBeGreaterThan(0);
  });

  it('abre e fecha os detalhes técnicos (collapsible)', () => {
    forbiddenError = { show: true, message: '', url: '', method: '', statusCode: undefined };
    render(<ForbiddenDialog />);
    const trigger = screen.getByText('technicalDetails');
    fireEvent.click(trigger);
    expect(screen.getByText(/currentPath:/)).toBeInTheDocument();
    fireEvent.click(trigger);
  });

  it('copia os detalhes ao clicar em copiar e volta ao ícone original', () => {
    vi.useFakeTimers();
    forbiddenError = {
      show: true,
      message: 'Erro',
      url: '/x',
      method: 'POST',
      statusCode: 500,
    };
    render(<ForbiddenDialog />);
    fireEvent.click(screen.getByText('copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith('copySuccess');
    expect(screen.getByText('copied')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByText('copy')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it('copia o texto usando a mensagem padrão quando forbiddenError.message está vazio', () => {
    forbiddenError = {
      show: true,
      message: '',
      url: '',
      method: '',
      statusCode: undefined,
    };
    render(<ForbiddenDialog />);
    fireEvent.click(screen.getByText('copy'));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining('defaultMessage'),
    );
  });

  it('usa "—" para navegador/SO quando o userAgent está vazio', () => {
    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: '',
    });
    forbiddenError = { show: true, message: '', url: '', method: '', statusCode: undefined };
    render(<ForbiddenDialog />);
    fireEvent.click(screen.getByText('technicalDetails'));
    expect(screen.getAllByText(/—/).length).toBeGreaterThan(0);
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
  });

  it('trata o ambiente sem "navigator" (SSR-like) com fallback vazio', () => {
    const originalNavigator = globalThis.navigator;
    // @ts-expect-error simulating an environment without `navigator`
    delete globalThis.navigator;
    forbiddenError = { show: true, message: '', url: '', method: '', statusCode: undefined };
    render(<ForbiddenDialog />);
    expect(screen.getByText('title')).toBeInTheDocument();
    globalThis.navigator = originalNavigator;
  });

  it('fecha o diálogo e reseta o estado ao clicar em "understood"', () => {
    forbiddenError = { show: true, message: '', url: '', method: '', statusCode: undefined };
    render(<ForbiddenDialog />);
    fireEvent.click(screen.getByText('understood'));
    expect(setForbiddenError).toHaveBeenCalledWith({
      show: false,
      message: '',
      url: '',
      method: '',
      statusCode: undefined,
    });
  });
});
