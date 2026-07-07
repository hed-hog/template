import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { FillBlankStatementEditor } from './fill-blank-statement-editor';

describe('FillBlankStatementEditor', () => {
  it('renderiza com valores padrão vazios', () => {
    const onChange = vi.fn();
    render(
      <FillBlankStatementEditor
        statement=""
        blanks={[]}
        extraWords={[]}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('Frase')).toBeInTheDocument();
    expect(screen.getByText('Nenhuma lacuna marcada ainda. Clique nas palavras acima.')).toBeInTheDocument();
  });

  it('digitar uma frase emite o statement e mantém lacunas cujo índice de palavra ainda existe', () => {
    const onChange = vi.fn();
    render(
      <FillBlankStatementEditor
        statement="[[1]] gato"
        blanks={[{ answer: 'O', alternatives: [] }]}
        extraWords={[]}
        onChange={onChange}
      />,
    );
    const textarea = screen.getByPlaceholderText('Digite a frase completa…');
    // Position 0 ("O") was a blank; typing a 2-word replacement keeps that
    // position (0) marked, so the first word becomes the new blank marker.
    fireEvent.change(textarea, { target: { value: 'novo texto' } });
    expect(onChange).toHaveBeenCalled();
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.statement).toBe('[[1]] texto');
    expect(lastCall.blanks).toEqual([{ answer: 'novo', alternatives: [] }]);
  });

  it('descarta lacunas cujo índice de palavra fica fora do alcance do novo texto', () => {
    const onChange = vi.fn();
    render(
      <FillBlankStatementEditor
        statement="um dois tres"
        blanks={[]}
        extraWords={[]}
        onChange={onChange}
      />,
    );
    // Mark the 3rd word ("tres", index 2) as a blank.
    fireEvent.click(screen.getByText('tres'));
    let lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.blanks).toEqual([{ answer: 'tres', alternatives: [] }]);

    // Shrinking to a single word drops word index 2 — the blank is discarded.
    const textarea = screen.getByPlaceholderText('Digite a frase completa…');
    fireEvent.change(textarea, { target: { value: 'oi' } });
    lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.statement).toBe('oi');
    expect(lastCall.blanks).toEqual([]);
  });

  it('clica em uma palavra para marcá-la como lacuna e depois remover', () => {
    const onChange = vi.fn();
    render(
      <FillBlankStatementEditor
        statement="o gato subiu"
        blanks={[]}
        extraWords={[]}
        onChange={onChange}
      />,
    );
    const wordButton = screen.getByText('gato');
    fireEvent.click(wordButton);
    expect(onChange).toHaveBeenCalled();
    let lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.statement).toContain('[[1]]');
    expect(lastCall.blanks).toEqual([{ answer: 'gato', alternatives: [] }]);

    expect(screen.getByText('Lacuna 1')).toBeInTheDocument();
    // Remove the blank via the X button in the blanks list.
    fireEvent.click(screen.getByLabelText('Remover lacuna'));
    lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.blanks).toEqual([]);
  });

  it('atualiza as alternativas de uma lacuna', () => {
    const onChange = vi.fn();
    render(
      <FillBlankStatementEditor
        statement="o gato subiu"
        blanks={[]}
        extraWords={[]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByText('gato'));
    const altInput = screen.getByPlaceholderText(
      'Outras respostas aceitas (separadas por vírgula)',
    );
    fireEvent.change(altInput, { target: { value: 'felino, bichano' } });
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.blanks[0].alternatives).toEqual(['felino', 'bichano']);
  });

  it('adiciona palavras extras via botão e via Enter, e remove uma palavra', () => {
    const onChange = vi.fn();
    render(
      <FillBlankStatementEditor
        statement="ola"
        blanks={[]}
        extraWords={[]}
        onChange={onChange}
      />,
    );
    const input = screen.getByPlaceholderText(
      'Digite uma palavra e pressione Enter (separe várias por vírgula)',
    );
    fireEvent.change(input, { target: { value: 'mundo' } });
    fireEvent.click(screen.getByText('Adicionar'));
    expect(screen.getByText('mundo')).toBeInTheDocument();

    fireEvent.change(input, { target: { value: 'terra' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(screen.getByText('terra')).toBeInTheDocument();

    // duplicate word (case-insensitive) should not be added twice
    fireEvent.change(input, { target: { value: 'MUNDO' } });
    fireEvent.click(screen.getByText('Adicionar'));
    expect(screen.getAllByText(/mundo/i)).toHaveLength(1);

    // ignores blank input
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Adicionar'));

    // non-Enter key on input is a no-op
    fireEvent.keyDown(input, { key: 'a' });

    const removeButtons = screen.getAllByLabelText('Remover palavra');
    fireEvent.click(removeButtons[0]);
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCall.extraWords).not.toContain('mundo');
  });

  it('usa labels customizados quando fornecidos', () => {
    const onChange = vi.fn();
    render(
      <FillBlankStatementEditor
        statement=""
        blanks={[]}
        extraWords={[]}
        onChange={onChange}
        labels={{ sentence: 'Custom Sentence Label' }}
      />,
    );
    expect(screen.getByText('Custom Sentence Label')).toBeInTheDocument();
  });

  it('não renderiza a área de palavras quando o texto está vazio', () => {
    const onChange = vi.fn();
    render(
      <FillBlankStatementEditor
        statement=""
        blanks={[]}
        extraWords={[]}
        onChange={onChange}
      />,
    );
    expect(screen.queryByText('Lacunas (0)')).not.toBeInTheDocument();
  });

  it('renderiza corretamente quando o texto começa/termina com espaço', () => {
    const onChange = vi.fn();
    render(
      <FillBlankStatementEditor
        statement=" oi tudo bem "
        blanks={[]}
        extraWords={[]}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('oi')).toBeInTheDocument();
  });

  it('renderiza com palavras extras pré-existentes', () => {
    const onChange = vi.fn();
    render(
      <FillBlankStatementEditor
        statement="oi"
        blanks={[]}
        extraWords={['pre-existente']}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('pre-existente')).toBeInTheDocument();
  });
});
