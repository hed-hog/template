import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { Textarea } from './textarea';

describe('Textarea', () => {
  it('renderiza com data-slot e aceita digitação', () => {
    render(<Textarea placeholder="Escreva algo" />);
    const el = screen.getByPlaceholderText('Escreva algo');
    expect(el).toHaveAttribute('data-slot', 'textarea');
    fireEvent.change(el, { target: { value: 'olá' } });
    expect(el).toHaveValue('olá');
  });

  it('respeita o estado desabilitado', () => {
    render(<Textarea disabled placeholder="desabilitado" />);
    expect(screen.getByPlaceholderText('desabilitado')).toBeDisabled();
  });

  it('mescla className e repassa aria-invalid', () => {
    render(<Textarea className="custom" aria-invalid="true" placeholder="inválido" />);
    const el = screen.getByPlaceholderText('inválido');
    expect(el).toHaveClass('custom');
    expect(el).toHaveAttribute('aria-invalid', 'true');
  });
});
