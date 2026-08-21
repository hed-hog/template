import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { type ReactNode } from 'react';

// Tooltip (Radix) requires TooltipProvider; we replace it with a passthrough so
// the test focuses on the ToggleGroup. TooltipTrigger asChild renders the ToggleGroupItem.
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: ReactNode }) => children,
  TooltipTrigger: ({ children }: { children: ReactNode }) => children,
  TooltipContent: () => null,
  TooltipProvider: ({ children }: { children: ReactNode }) => children,
}));

import { ViewModeToggle } from './view-mode-toggle';

function setup(
  props: Partial<React.ComponentProps<typeof ViewModeToggle>> = {}
) {
  const onViewModeChange = vi.fn();
  render(
    <ViewModeToggle
      viewMode="cards"
      onViewModeChange={onViewModeChange}
      listLabel="Lista"
      cardsLabel="Cartões"
      {...props}
    />
  );
  return { onViewModeChange };
}

describe('ViewModeToggle', () => {
  it('renderiza os dois itens (role radio) com seus rótulos acessíveis', () => {
    setup();
    // ToggleGroup type="single" exposes the items as role "radio".
    expect(screen.getByRole('radio', { name: 'Cartões' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Lista' })).toBeInTheDocument();
  });

  it('ao clicar em "Lista" emite onViewModeChange("list")', () => {
    const { onViewModeChange } = setup({ viewMode: 'cards' });
    fireEvent.click(screen.getByRole('radio', { name: 'Lista' }));
    expect(onViewModeChange).toHaveBeenCalledWith('list');
  });

  it('clicar no item já ativo (desseleção → "") é filtrado pela guarda', () => {
    const { onViewModeChange } = setup({ viewMode: 'cards' });
    // Radix single: clicking the active item emits onValueChange(''), which the guard ignores.
    fireEvent.click(screen.getByRole('radio', { name: 'Cartões' }));
    expect(onViewModeChange).not.toHaveBeenCalled();
  });
});
