import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { TooltipProvider } from '@/components/ui/tooltip';
import { TagsInput } from './tags-input';

// Each rendered tag wraps its remove button in a <Tooltip>, which requires a
// <TooltipProvider> ancestor (Radix throws otherwise).
function renderTagsInput(ui: ReactElement) {
  const result = render(<TooltipProvider>{ui}</TooltipProvider>);
  return {
    ...result,
    rerender: (nextUi: ReactElement) =>
      result.rerender(<TooltipProvider>{nextUi}</TooltipProvider>),
  };
}

describe('TagsInput', () => {
  it('adiciona uma tag ao pressionar Enter (modo não controlado)', () => {
    renderTagsInput(<TagsInput placeholder="Adicionar tag" />);

    const input = screen.getByPlaceholderText('Adicionar tag');
    fireEvent.change(input, { target: { value: 'react' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getByText('react')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('adiciona uma tag ao pressionar vírgula', () => {
    renderTagsInput(<TagsInput placeholder="Adicionar tag" />);

    const input = screen.getByPlaceholderText('Adicionar tag');
    fireEvent.change(input, { target: { value: 'vitest' } });
    fireEvent.keyDown(input, { key: ',' });

    expect(screen.getByText('vitest')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('não adiciona tag vazia/apenas espaços', () => {
    renderTagsInput(<TagsInput placeholder="Adicionar tag" />);

    const input = screen.getByPlaceholderText('Adicionar tag');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.queryByText('   ')).not.toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('não adiciona tag duplicada', () => {
    renderTagsInput(
      <TagsInput placeholder="Adicionar tag" defaultValue={['react']} />,
    );

    const input = screen.getByPlaceholderText('Adicionar tag');
    fireEvent.change(input, { target: { value: 'react' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(screen.getAllByText('react')).toHaveLength(1);
  });

  it('remove a última tag ao pressionar Backspace com input vazio', () => {
    renderTagsInput(
      <TagsInput placeholder="Adicionar tag" defaultValue={['alpha', 'beta']} />,
    );

    const input = screen.getByPlaceholderText('Adicionar tag');
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();

    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(screen.queryByText('beta')).not.toBeInTheDocument();
    expect(screen.getByText('alpha')).toBeInTheDocument();
  });

  it('não remove tag com Backspace se o input não estiver vazio', () => {
    renderTagsInput(
      <TagsInput placeholder="Adicionar tag" defaultValue={['alpha']} />,
    );

    const input = screen.getByPlaceholderText('Adicionar tag');
    fireEvent.change(input, { target: { value: 'te' } });
    fireEvent.keyDown(input, { key: 'Backspace' });

    expect(screen.getByText('alpha')).toBeInTheDocument();
  });

  it('remove uma tag ao clicar no botão de remover (x)', () => {
    renderTagsInput(
      <TagsInput placeholder="Adicionar tag" defaultValue={['alpha', 'beta']} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove alpha' }));

    expect(screen.queryByText('alpha')).not.toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('adiciona o texto pendente como tag ao perder o foco (blur)', () => {
    renderTagsInput(<TagsInput placeholder="Adicionar tag" />);

    const input = screen.getByPlaceholderText('Adicionar tag');
    fireEvent.change(input, { target: { value: 'onblur' } });
    fireEvent.blur(input);

    expect(screen.getByText('onblur')).toBeInTheDocument();
  });

  it('não adiciona nada no blur se o input estiver vazio', () => {
    renderTagsInput(
      <TagsInput placeholder="Adicionar tag" defaultValue={['alpha']} />,
    );

    const input = screen.getByPlaceholderText('Adicionar tag');
    fireEvent.blur(input);

    expect(screen.getAllByText('alpha')).toHaveLength(1);
  });

  it('foca o input ao clicar no container', () => {
    const { container } = renderTagsInput(
      <TagsInput placeholder="Adicionar tag" />,
    );

    const input = screen.getByPlaceholderText('Adicionar tag');
    const outerDiv = container.querySelector(
      '[placeholder="Adicionar tag"]',
    )?.parentElement as HTMLElement;

    expect(input).not.toHaveFocus();
    fireEvent.click(outerDiv);
    expect(input).toHaveFocus();
  });

  it('modo controlado: chama onChange mas não atualiza sozinho sem a prop value mudar', () => {
    const onChange = vi.fn();
    const { rerender } = renderTagsInput(
      <TagsInput placeholder="Adicionar tag" value={['fixed']} onChange={onChange} />,
    );

    const input = screen.getByPlaceholderText('Adicionar tag');
    fireEvent.change(input, { target: { value: 'new-tag' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // onChange is called with the computed next value...
    expect(onChange).toHaveBeenCalledWith(['fixed', 'new-tag']);
    // ...but since `value` prop wasn't updated, the displayed tags don't change.
    expect(screen.getByText('fixed')).toBeInTheDocument();
    expect(screen.queryByText('new-tag')).not.toBeInTheDocument();

    // Once the parent updates the `value` prop, the new tag shows up.
    rerender(
      <TagsInput
        placeholder="Adicionar tag"
        value={['fixed', 'new-tag']}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('new-tag')).toBeInTheDocument();
  });

  it('modo controlado: remover tag chama onChange com a lista filtrada', () => {
    const onChange = vi.fn();
    renderTagsInput(
      <TagsInput
        placeholder="Adicionar tag"
        value={['alpha', 'beta']}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove alpha' }));

    expect(onChange).toHaveBeenCalledWith(['beta']);
    // Controlled: display still reflects the (unchanged) `value` prop.
    expect(screen.getByText('alpha')).toBeInTheDocument();
  });

  it('encaminha a ref para o elemento input interno', () => {
    const ref = { current: null as HTMLInputElement | null };
    renderTagsInput(<TagsInput ref={ref} placeholder="Adicionar tag" />);

    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });
});
