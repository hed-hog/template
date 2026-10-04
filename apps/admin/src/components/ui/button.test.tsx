import '@testing-library/jest-dom/vitest';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';

import { Button, buttonVariants } from './button';

describe('Button', () => {
  it('renderiza a variante e tamanho default', () => {
    render(<Button>Clique</Button>);
    const button = screen.getByRole('button', { name: 'Clique' });
    expect(button).toHaveClass('bg-primary');
    expect(button).toHaveClass('h-9');
  });

  it.each([
    ['default', 'bg-primary'],
    ['destructive', 'bg-destructive'],
    ['outline', 'bg-background'],
    ['secondary', 'bg-secondary'],
    ['ghost', 'hover:bg-accent'],
    ['link', 'text-primary'],
  ] as const)('renderiza a variante %s', (variant, expectedClass) => {
    render(<Button variant={variant}>Botão</Button>);
    expect(screen.getByRole('button')).toHaveClass(expectedClass);
  });

  it.each([
    ['default', 'h-9'],
    ['sm', 'h-8'],
    ['lg', 'h-10'],
    ['icon', 'size-9'],
    ['icon-sm', 'size-8'],
    ['icon-lg', 'size-10'],
  ] as const)('renderiza o tamanho %s', (size, expectedClass) => {
    render(
      <Button size={size} aria-label="Botão">
        Botão
      </Button>
    );
    expect(screen.getByRole('button')).toHaveClass(expectedClass);
  });

  it('renderiza como Slot quando asChild é true', () => {
    render(
      <Button asChild>
        <a href="/link">Link</a>
      </Button>
    );
    const link = screen.getByText('Link');
    expect(link.tagName).toBe('A');
    expect(link).toHaveAttribute('data-slot', 'button');
  });

  it('dispara onClick ao ser clicado', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Clique</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  it('exporta buttonVariants como função utilitária de classes', () => {
    expect(buttonVariants({ variant: 'outline', size: 'sm' })).toContain(
      'border'
    );
  });
});

describe('Button — feedback de carregando', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('entra em loading sozinho quando o onClick devolve uma Promise', async () => {
    let resolveClick: () => void = () => {};
    const onClick = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveClick = resolve;
        })
    );

    render(<Button onClick={onClick}>Salvar</Button>);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toHaveAttribute('data-loading');
    expect(
      document.querySelector('[data-slot="button-spinner"]')
    ).toBeInTheDocument();

    await act(async () => {
      resolveClick();
    });

    expect(button).not.toBeDisabled();
    expect(document.querySelector('[data-slot="button-spinner"]')).toBeNull();
  });

  it('ignora cliques repetidos enquanto a Promise do clique nao resolve', () => {
    const onClick = vi.fn(() => new Promise<void>(() => {}));

    render(<Button onClick={onClick}>Abrir</Button>);
    const button = screen.getByRole('button');

    fireEvent.click(button);
    fireEvent.click(button);
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('volta do loading quando a Promise do clique rejeita', async () => {
    // Thenable manual: o Button relanca o erro para preservar o report de
    // unhandled rejection, e aqui o relance e absorvido para nao poluir o run.
    const onClick = vi.fn(() => ({
      then: (_onOk: () => void, onFail: (error: unknown) => void) => {
        queueMicrotask(() => {
          try {
            onFail(new Error('falhou'));
          } catch {
            /* relance esperado */
          }
        });
      },
    }));

    render(<Button onClick={onClick}>Salvar</Button>);
    const button = screen.getByRole('button');

    fireEvent.click(button);
    await waitFor(() => expect(button).toBeDisabled());
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it('nao entra em loading quando o onClick e sincrono', () => {
    const onClick = vi.fn();

    render(<Button onClick={onClick}>Salvar</Button>);
    const button = screen.getByRole('button');

    fireEvent.click(button);

    expect(button).not.toBeDisabled();
    expect(document.querySelector('[data-slot="button-spinner"]')).toBeNull();
  });

  it('mostra o spinner e desabilita com a prop loading', () => {
    render(<Button loading>Salvar</Button>);
    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('data-loading');
    expect(
      document.querySelector('[data-slot="button-spinner"]')
    ).toBeInTheDocument();
  });

  it('troca o label pelo loadingLabel enquanto carrega', () => {
    render(
      <Button loading loadingLabel="Salvando...">
        Salvar
      </Button>
    );

    expect(screen.getByRole('button')).toHaveTextContent('Salvando...');
    expect(screen.getByRole('button')).not.toHaveTextContent('Salvar');
  });

  it('a prop loading vence a deteccao automatica', () => {
    const onClick = vi.fn(() => new Promise<void>(() => {}));

    render(
      <Button loading={false} onClick={onClick}>
        Abrir
      </Button>
    );
    const button = screen.getByRole('button');

    fireEvent.click(button);
    expect(button).not.toBeDisabled();
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(2);
  });

  it('substitui o conteudo pelo spinner em botao so-com-icone', () => {
    render(
      <Button size="icon" loading tooltip="Editar">
        <span data-testid="icone" />
      </Button>
    );

    expect(screen.queryByTestId('icone')).toBeNull();
    expect(
      document.querySelector('[data-slot="button-spinner"]')
    ).toBeInTheDocument();
  });

  it('ignora loading com asChild e avisa em desenvolvimento', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <Button asChild loading>
        <a href="/link">Link</a>
      </Button>
    );

    expect(screen.getByText('Link')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="button-spinner"]')).toBeNull();
    expect(warn).toHaveBeenCalled();
  });
});

describe('Button — tooltip', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('usa o tooltip string como aria-label', () => {
    render(
      <Button size="icon" tooltip="Editar pessoa">
        <span />
      </Button>
    );

    expect(
      screen.getByRole('button', { name: 'Editar pessoa' })
    ).toBeInTheDocument();
  });

  it('mantem o aria-label explicito acima do tooltip', () => {
    render(
      <Button size="icon" tooltip="Dica longa" aria-label="Editar">
        <span />
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Editar' })).toBeInTheDocument();
  });

  it('avisa em desenvolvimento quando botao so-com-icone nao tem rotulo', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(
      <Button size="icon">
        <span />
      </Button>
    );

    expect(warn).toHaveBeenCalled();
  });

  it('nao avisa quando o botao tem texto', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<Button>Salvar</Button>);

    expect(warn).not.toHaveBeenCalled();
  });
});
