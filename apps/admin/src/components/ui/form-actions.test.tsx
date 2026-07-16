import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { FormActions } from './form-actions';

describe('FormActions', () => {
  it('renderiza apenas o botão de submit quando onCancel não é informado', () => {
    render(<FormActions submitLabel="Salvar" />);

    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });

  it('renderiza o botão de cancelar e propaga onCancel/onSubmit', () => {
    const onCancel = vi.fn();
    const onSubmit = vi.fn();

    render(
      <FormActions
        submitLabel="Salvar"
        cancelLabel="Cancelar"
        onCancel={onCancel}
        onSubmit={onSubmit}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onCancel).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('renderiza statusContent, submitIcon e respeita submitDisabled/submitType', () => {
    render(
      <FormActions
        submitLabel="Enviar"
        submitIcon={<span data-testid="icon">*</span>}
        statusContent={<span>Salvo automaticamente</span>}
        submitDisabled
        submitType="submit"
      />
    );

    expect(screen.getByText('Salvo automaticamente')).toBeInTheDocument();
    expect(screen.getByTestId('icon')).toBeInTheDocument();
    const submitButton = screen.getByRole('button', { name: /Enviar/ });
    expect(submitButton).toBeDisabled();
    expect(submitButton).toHaveAttribute('type', 'submit');
  });

  it('usa cancelSize explícito quando informado, ao invés de herdar submitSize', () => {
    render(
      <FormActions
        submitLabel="Salvar"
        onCancel={() => {}}
        submitSize="lg"
        cancelSize="sm"
      />
    );

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
  });

  it('envolve o conteúdo em SheetFooter quando sheet=true', () => {
    const { container } = render(
      <FormActions submitLabel="Salvar" sheet sheetClassName="custom-sheet-class" />
    );

    const footer = container.querySelector('[data-slot="sheet-footer"]');
    expect(footer).toBeInTheDocument();
    expect(footer).toHaveClass('custom-sheet-class');
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument();
    expect(screen.getByTestId('sheet-submit')).toBeInTheDocument();
  });
});
