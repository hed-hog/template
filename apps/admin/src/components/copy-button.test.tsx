import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const toastSuccess = vi.fn();
vi.mock('sonner', () => ({
  toast: { success: (...args: unknown[]) => toastSuccess(...args) },
}));

import { TooltipProvider } from '@/components/ui/tooltip';
import { CopyButton } from './copy-button';

function renderCopyButton(props: ComponentProps<typeof CopyButton>) {
  return render(
    <TooltipProvider>
      <CopyButton {...props} />
    </TooltipProvider>,
  );
}

describe('CopyButton', () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    vi.useFakeTimers();
  });

  it('copia o valor para a área de transferência e mostra o toast', () => {
    renderCopyButton({ value: 'hello-world' });
    const button = screen.getByRole('button', { name: 'copiedToClipboard' });
    fireEvent.click(button);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('hello-world');
    expect(toastSuccess).toHaveBeenCalledWith('copiedToClipboard');
  });

  it('volta ao ícone de copiar após 2 segundos', () => {
    const { container } = renderCopyButton({ value: 'x', className: 'custom' });
    const button = screen.getByRole('button', { name: 'copiedToClipboard' });
    fireEvent.click(button);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(container.querySelector('.custom')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
