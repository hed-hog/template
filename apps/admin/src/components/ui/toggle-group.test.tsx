import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { ToggleGroup, ToggleGroupItem } from './toggle-group';

describe('ToggleGroup', () => {
  it('type="single": seleciona um item por vez e propaga onValueChange', () => {
    const onValueChange = vi.fn();

    render(
      <ToggleGroup type="single" onValueChange={onValueChange}>
        <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
        <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
      </ToggleGroup>,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Bold' }));
    expect(onValueChange).toHaveBeenCalledWith('bold');

    fireEvent.click(screen.getByRole('radio', { name: 'Italic' }));
    expect(onValueChange).toHaveBeenCalledWith('italic');
  });

  it('type="multiple": permite selecionar múltiplos itens', () => {
    const onValueChange = vi.fn();

    render(
      <ToggleGroup type="multiple" onValueChange={onValueChange}>
        <ToggleGroupItem value="bold">Bold</ToggleGroupItem>
        <ToggleGroupItem value="italic">Italic</ToggleGroupItem>
      </ToggleGroup>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['bold']);

    fireEvent.click(screen.getByRole('button', { name: 'Italic' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['bold', 'italic']);

    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(onValueChange).toHaveBeenLastCalledWith(['italic']);
  });

  it('não permite interação com item desabilitado', () => {
    const onValueChange = vi.fn();

    render(
      <ToggleGroup type="single" onValueChange={onValueChange}>
        <ToggleGroupItem value="bold" disabled>
          Bold
        </ToggleGroupItem>
      </ToggleGroup>,
    );

    const item = screen.getByRole('radio', { name: 'Bold' });
    expect(item).toBeDisabled();

    fireEvent.click(item);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('propaga variant e size do grupo para os itens via contexto', () => {
    render(
      <ToggleGroup type="single" variant="outline" size="lg" data-testid="group">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>,
    );

    const item = screen.getByRole('radio', { name: 'A' });
    expect(item).toHaveAttribute('data-variant', 'outline');
    expect(item).toHaveAttribute('data-size', 'lg');
  });

  it('item usa variant/size próprios quando o grupo não define (contexto default)', () => {
    render(
      <ToggleGroup type="single">
        <ToggleGroupItem value="a" variant="outline" size="sm">
          A
        </ToggleGroupItem>
      </ToggleGroup>,
    );

    const item = screen.getByRole('radio', { name: 'A' });
    expect(item).toHaveAttribute('data-variant', 'outline');
    expect(item).toHaveAttribute('data-size', 'sm');
  });

  it('aplica spacing customizado no data-spacing e className', () => {
    render(
      <ToggleGroup type="single" spacing={4} className="custom-group">
        <ToggleGroupItem value="a">A</ToggleGroupItem>
      </ToggleGroup>,
    );

    const group = screen.getByRole('group');
    expect(group).toHaveClass('custom-group');
    expect(group).toHaveAttribute('data-spacing', '4');
  });
});
