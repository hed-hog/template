import '@testing-library/jest-dom/vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from './resizable';

describe('Resizable', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      vi.fn(() => ({
        disconnect: vi.fn(),
        observe: vi.fn(),
        unobserve: vi.fn(),
      })),
    );
  });

  it('renderiza um grupo horizontal com alça simples (sem grip)', () => {
    render(
      <ResizablePanelGroup direction="horizontal" data-testid="group">
        <ResizablePanel defaultSize={50}>A</ResizablePanel>
        <ResizableHandle data-testid="handle" />
        <ResizablePanel defaultSize={50}>B</ResizablePanel>
      </ResizablePanelGroup>,
    );

    expect(screen.getByTestId('group')).toHaveAttribute(
      'data-panel-group-direction',
      'horizontal',
    );
    expect(screen.getByTestId('handle').querySelector('svg')).not.toBeInTheDocument();
  });

  it('renderiza um grupo vertical com alça visível (com grip)', () => {
    render(
      <ResizablePanelGroup direction="vertical" data-testid="group-v">
        <ResizablePanel defaultSize={50}>A</ResizablePanel>
        <ResizableHandle withHandle data-testid="handle-v" />
        <ResizablePanel defaultSize={50}>B</ResizablePanel>
      </ResizablePanelGroup>,
    );

    expect(screen.getByTestId('group-v')).toHaveAttribute(
      'data-panel-group-direction',
      'vertical',
    );
    expect(screen.getByTestId('handle-v').querySelector('svg')).toBeInTheDocument();
  });

  it('aplica className customizado ao grupo e à alça', () => {
    render(
      <ResizablePanelGroup direction="horizontal" className="custom-group" data-testid="group-c">
        <ResizablePanel defaultSize={50}>A</ResizablePanel>
        <ResizableHandle className="custom-handle" data-testid="handle-c" />
        <ResizablePanel defaultSize={50}>B</ResizablePanel>
      </ResizablePanelGroup>,
    );

    expect(screen.getByTestId('group-c')).toHaveClass('custom-group');
    expect(screen.getByTestId('handle-c')).toHaveClass('custom-handle');
  });
});
