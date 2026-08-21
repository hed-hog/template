import '@testing-library/jest-dom/vitest';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import { Page } from './page';

describe('Page', () => {
  it('renderiza os filhos', () => {
    render(
      <Page>
        <span>Conteúdo</span>
      </Page>
    );
    expect(screen.getByText('Conteúdo')).toBeInTheDocument();
  });

  it('aplica classes padrão sem className adicional', () => {
    const { container } = render(<Page>filho</Page>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('flex');
    expect(div.className).toContain('flex-col');
    expect(div.className).toContain('min-h-screen');
  });

  it('mescla className adicional com as classes padrão', () => {
    const { container } = render(<Page className="custom-page">filho</Page>);
    const div = container.firstChild as HTMLElement;
    expect(div.className).toContain('custom-page');
    expect(div.className).toContain('flex');
  });
});
