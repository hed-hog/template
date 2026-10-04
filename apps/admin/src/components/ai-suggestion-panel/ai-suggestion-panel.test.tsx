import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import {
  AiSuggestionPanel,
  isUsableSuggestion,
  type AiSuggestionPanelLabels,
  type AiSuggestionPanelSuggestion,
} from './ai-suggestion-panel';

const labels: AiSuggestionPanelLabels = {
  title: 'Sugestao da IA',
  emptyHint: 'Sem rascunho',
  generate: 'Sugerir',
  refine: 'Refinar',
  refinePlaceholder: 'Peca um ajuste',
  send: 'Enviar',
  edit: 'Editar',
  editDone: 'Concluir',
  discard: 'Descartar',
  helpful: 'Util',
  notHelpful: 'Nao ajudou',
  expand: 'Expandir',
  collapse: 'Recolher',
  failed: 'Falhou',
  autoBadge: 'Automatica',
  model: (model) => `via ${model}`,
  counter: (count, max) => `${count} de ${max}`,
  overLimit: 'acima do limite',
};

const ready = (
  patch: Partial<AiSuggestionPanelSuggestion> = {}
): AiSuggestionPanelSuggestion => ({
  id: 1,
  status: 'ready',
  text: 'Oi! Obrigado pelo comentario.',
  feedback: null,
  model: 'gpt-x',
  origin: 'auto',
  ...patch,
});

describe('isUsableSuggestion', () => {
  it('descartada, usada ou ausente nao contam', () => {
    expect(isUsableSuggestion(null)).toBe(false);
    expect(isUsableSuggestion(ready({ status: 'used' }))).toBe(false);
    expect(isUsableSuggestion(ready({ status: 'discarded' }))).toBe(false);
    expect(isUsableSuggestion(ready({ status: 'failed' }))).toBe(true);
  });
});

describe('AiSuggestionPanel', () => {
  it('sem rascunho oferece gerar e chama o handler', async () => {
    const onGenerate = vi.fn().mockResolvedValue(undefined);
    render(
      <AiSuggestionPanel
        suggestion={null}
        labels={labels}
        onGenerate={onGenerate}
        notice="IA desligada"
      />
    );
    expect(screen.getByText('Sem rascunho')).toBeInTheDocument();
    expect(screen.getByText('IA desligada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Sugerir' }));
    await waitFor(() => expect(onGenerate).toHaveBeenCalledTimes(1));
  });

  it('somente leitura nao mostra acoes', () => {
    render(
      <AiSuggestionPanel
        suggestion={ready()}
        labels={labels}
        readOnly
        onSend={vi.fn()}
      />
    );
    expect(screen.getByTestId('ai-suggestion-text')).toHaveTextContent(
      'Oi! Obrigado pelo comentario.'
    );
    expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull();
  });

  it('mostra o selo automatico, o modelo e o contador', () => {
    render(
      <AiSuggestionPanel
        suggestion={ready()}
        labels={labels}
        maxLength={100}
        onSend={vi.fn()}
      />
    );
    expect(screen.getByText('Automatica')).toBeInTheDocument();
    expect(screen.getByText('via gpt-x')).toBeInTheDocument();
    expect(screen.getByTestId('ai-suggestion-counter')).toHaveTextContent(
      '29 de 100'
    );
  });

  it('acima do limite desabilita o envio', () => {
    render(
      <AiSuggestionPanel
        suggestion={ready()}
        labels={labels}
        maxLength={10}
        onSend={vi.fn()}
      />
    );
    expect(screen.getByTestId('ai-suggestion-counter')).toHaveTextContent(
      'acima do limite'
    );
    expect(screen.getByRole('button', { name: 'Enviar' })).toBeDisabled();
  });

  it('edita no proprio painel e envia o texto editado', async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(
      <AiSuggestionPanel suggestion={ready()} labels={labels} onSend={onSend} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Editar' }), {
      target: { value: 'Texto novo' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar' }));
    await waitFor(() => expect(onSend).toHaveBeenCalledWith('Texto novo'));
  });

  it('com onUseInComposer, editar entrega o texto ao compositor', () => {
    const onUseInComposer = vi.fn();
    render(
      <AiSuggestionPanel
        suggestion={ready()}
        labels={labels}
        onUseInComposer={onUseInComposer}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(onUseInComposer).toHaveBeenCalledWith(
      'Oi! Obrigado pelo comentario.'
    );
  });

  it('refina com a instrucao e o rascunho atual', async () => {
    const onRefine = vi.fn().mockResolvedValue(undefined);
    render(
      <AiSuggestionPanel
        suggestion={ready()}
        labels={labels}
        onRefine={onRefine}
      />
    );
    const input = screen.getByRole('textbox', { name: 'Peca um ajuste' });
    fireEvent.change(input, { target: { value: 'mais curto' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() =>
      expect(onRefine).toHaveBeenCalledWith(
        'mais curto',
        'Oi! Obrigado pelo comentario.'
      )
    );
    await waitFor(() => expect(input).toHaveValue(''));
  });

  it('feedback alterna e desfaz no segundo clique', async () => {
    const onFeedback = vi.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <AiSuggestionPanel
        suggestion={ready()}
        labels={labels}
        onFeedback={onFeedback}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Util' }));
    await waitFor(() => expect(onFeedback).toHaveBeenLastCalledWith('helpful'));

    rerender(
      <AiSuggestionPanel
        suggestion={ready({ feedback: 'helpful' })}
        labels={labels}
        onFeedback={onFeedback}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Util' }));
    await waitFor(() => expect(onFeedback).toHaveBeenLastCalledWith(null));
  });

  it('descarta e engole a rejeicao do handler', async () => {
    const onDiscard = vi.fn().mockRejectedValue(new Error('boom'));
    render(
      <AiSuggestionPanel
        suggestion={ready()}
        labels={labels}
        onDiscard={onDiscard}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    await waitFor(() => expect(onDiscard).toHaveBeenCalled());
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Descartar' })
      ).not.toBeDisabled()
    );
  });

  it('falhou: mostra o erro e oferece gerar de novo', () => {
    render(
      <AiSuggestionPanel
        suggestion={ready({ status: 'failed', text: null, error: 'Sem cota' })}
        labels={labels}
        onGenerate={vi.fn()}
        onSend={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Sem cota');
    expect(screen.getByRole('button', { name: 'Sugerir' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enviar' })).toBeNull();
  });
});
