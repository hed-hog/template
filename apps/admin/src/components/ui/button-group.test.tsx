import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { ButtonGroup, ButtonGroupSeparator, ButtonGroupText } from './button-group';

describe('ButtonGroup', () => {
  it('renderiza com classes padrão quando nenhuma orientação é especificada', () => {
    render(
      <ButtonGroup>
        <ButtonGroupText>Texto</ButtonGroupText>
      </ButtonGroup>,
    );
    const group = screen.getByRole('group');
    expect(group).not.toHaveAttribute('data-orientation');
    expect(group.className).toContain('rounded-l-none');
  });

  it('renderiza com orientação vertical quando especificado', () => {
    render(<ButtonGroup orientation="vertical" />);
    expect(screen.getByRole('group')).toHaveAttribute('data-orientation', 'vertical');
  });

  it('renderiza ButtonGroupText como Slot quando asChild é true', () => {
    render(
      <ButtonGroupText asChild>
        <a href="/link">Link</a>
      </ButtonGroupText>,
    );
    const link = screen.getByText('Link');
    expect(link.tagName).toBe('A');
  });

  it('renderiza ButtonGroupSeparator com orientação vertical por padrão', () => {
    render(<ButtonGroupSeparator data-testid="separator" />);
    expect(screen.getByTestId('separator')).toHaveAttribute('data-slot', 'button-group-separator');
  });

  it('renderiza ButtonGroupSeparator com orientação horizontal', () => {
    render(<ButtonGroupSeparator orientation="horizontal" data-testid="separator-h" />);
    expect(screen.getByTestId('separator-h')).toBeInTheDocument();
  });
});
