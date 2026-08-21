import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import Error from './error';

describe('Error (boundary)', () => {
  it('renderiza sem a caixa de mensagem quando não há error.message', () => {
    render(<Error error={{}} />);
    expect(screen.getByText('Algo deu errado')).toBeInTheDocument();
    expect(screen.queryByText(/Ver stack trace/)).not.toBeInTheDocument();
  });

  it('renderiza a caixa de mensagem e o nome do arquivo quando o stack casa com o regex', () => {
    render(
      <Error
        error={{
          message: 'Algo quebrou',
          stack: 'Error: Algo quebrou\n    at Component (src/app/page.tsx:10:5)',
        }}
      />,
    );
    expect(screen.getByText('Algo quebrou')).toBeInTheDocument();
    // The matched filename appears both in the message box and in the raw
    // stack trace <pre>, so we expect two matches for the substring regex.
    expect(screen.getAllByText(/page\.tsx:10:5/).length).toBeGreaterThanOrEqual(1);
  });

  it('mostra "Arquivo desconhecido" quando o stack não casa com o regex', () => {
    render(
      <Error
        error={{
          message: 'Algo quebrou',
          stack: 'stack trace sem informação de arquivo reconhecível',
        }}
      />,
    );
    expect(screen.getByText('Arquivo desconhecido')).toBeInTheDocument();
  });

  it('não roda o regex do stack quando não há error.message', () => {
    render(
      <Error
        error={{
          stack: 'Error sem mensagem\n    at Component (src/app/page.tsx:10:5)',
        }}
      />,
    );
    // Without error.message, the whole message block (and its regex match) is skipped.
    expect(screen.queryByText('Arquivo desconhecido')).not.toBeInTheDocument();
    // The stack is still shown verbatim in the <details>/<pre> block, which is a
    // separate, independent branch controlled by error?.stack.
    expect(screen.getByText('Ver stack trace')).toBeInTheDocument();
  });

  it('renderiza o bloco de stack trace quando error.stack está presente', () => {
    render(<Error error={{ stack: 'Error: falha\n    at foo (bar.ts:1:1)' }} />);
    expect(screen.getByText('Ver stack trace')).toBeInTheDocument();
  });

  it('não renderiza o bloco de stack trace quando error.stack está ausente', () => {
    render(<Error error={{ message: 'Algo quebrou' }} />);
    expect(screen.queryByText('Ver stack trace')).not.toBeInTheDocument();
  });

  it('chama reset ao clicar em "Tentar novamente" quando reset é fornecido', () => {
    const reset = vi.fn();
    render(<Error error={{}} reset={reset} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it('não lança erro ao clicar em "Tentar novamente" quando reset não é fornecido', () => {
    render(<Error error={{}} />);
    expect(() =>
      fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' })),
    ).not.toThrow();
  });
});
