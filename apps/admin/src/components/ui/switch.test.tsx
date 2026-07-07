import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { Switch } from './switch';

describe('Switch', () => {
  it('renderiza desmarcado por padrão com os slots corretos', () => {
    render(<Switch aria-label="ativar" />);
    const el = screen.getByRole('switch', { name: 'ativar' });
    expect(el).toHaveAttribute('data-slot', 'switch');
    expect(el).toHaveAttribute('data-state', 'unchecked');
  });

  it('alterna o estado ao clicar (não controlado)', () => {
    const onCheckedChange = vi.fn();
    render(<Switch aria-label="ativar" onCheckedChange={onCheckedChange} />);
    const el = screen.getByRole('switch', { name: 'ativar' });
    fireEvent.click(el);
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('reflete o estado marcado quando controlado', () => {
    render(<Switch aria-label="ativar" checked readOnly />);
    expect(screen.getByRole('switch', { name: 'ativar' })).toHaveAttribute(
      'data-state',
      'checked'
    );
  });

  it('respeita o estado desabilitado', () => {
    render(<Switch aria-label="ativar" disabled />);
    expect(screen.getByRole('switch', { name: 'ativar' })).toBeDisabled();
  });
});
