import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  it('renderiza desmarcado por padrão', () => {
    render(<Checkbox aria-label="aceitar" />);
    const checkbox = screen.getByRole('checkbox', { name: 'aceitar' });
    expect(checkbox).toHaveAttribute('data-state', 'unchecked');
  });

  it('alterna para marcado ao clicar e exibe o indicador', async () => {
    render(<Checkbox aria-label="aceitar" />);
    const checkbox = screen.getByRole('checkbox', { name: 'aceitar' });
    fireEvent.click(checkbox);
    expect(await screen.findByText((_, el) => el?.tagName === 'svg')).toBeTruthy();
    expect(checkbox).toHaveAttribute('data-state', 'checked');
  });

  it('chama onCheckedChange quando o estado muda', () => {
    const onCheckedChange = vi.fn();
    render(<Checkbox aria-label="aceitar" onCheckedChange={onCheckedChange} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'aceitar' }));
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('não permite interação quando desabilitado', () => {
    const onCheckedChange = vi.fn();
    render(
      <Checkbox aria-label="aceitar" disabled onCheckedChange={onCheckedChange} />,
    );
    const checkbox = screen.getByRole('checkbox', { name: 'aceitar' });
    expect(checkbox).toBeDisabled();
    fireEvent.click(checkbox);
    expect(onCheckedChange).not.toHaveBeenCalled();
  });
});
