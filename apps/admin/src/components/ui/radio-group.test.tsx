import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';

import { RadioGroup, RadioGroupItem } from './radio-group';

function ControlledRadioGroup() {
  const [value, setValue] = useState('a');
  return (
    <RadioGroup value={value} onValueChange={setValue} data-testid="group">
      <RadioGroupItem value="a" aria-label="Option A" />
      <RadioGroupItem value="b" aria-label="Option B" />
      <RadioGroupItem value="c" aria-label="Option C" disabled />
    </RadioGroup>
  );
}

describe('RadioGroup', () => {
  it('renderiza itens com o valor inicial selecionado', () => {
    render(<ControlledRadioGroup />);
    expect(screen.getByRole('radio', { name: 'Option A' })).toHaveAttribute(
      'data-state',
      'checked',
    );
    expect(screen.getByRole('radio', { name: 'Option B' })).toHaveAttribute(
      'data-state',
      'unchecked',
    );
  });

  it('seleciona outro item ao clicar', () => {
    render(<ControlledRadioGroup />);
    fireEvent.click(screen.getByRole('radio', { name: 'Option B' }));
    expect(screen.getByRole('radio', { name: 'Option B' })).toHaveAttribute(
      'data-state',
      'checked',
    );
    expect(screen.getByRole('radio', { name: 'Option A' })).toHaveAttribute(
      'data-state',
      'unchecked',
    );
  });

  it('não seleciona um item desabilitado', () => {
    render(<ControlledRadioGroup />);
    const disabledItem = screen.getByRole('radio', { name: 'Option C' });
    expect(disabledItem).toBeDisabled();
    fireEvent.click(disabledItem);
    expect(disabledItem).toHaveAttribute('data-state', 'unchecked');
  });

  it('aplica className customizado ao grupo e ao item', () => {
    render(
      <RadioGroup className="custom-group" data-testid="group">
        <RadioGroupItem value="x" className="custom-item" aria-label="Option X" />
      </RadioGroup>,
    );
    expect(screen.getByTestId('group')).toHaveClass('custom-group');
    expect(screen.getByRole('radio', { name: 'Option X' })).toHaveClass('custom-item');
  });
});
