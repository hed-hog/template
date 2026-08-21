import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { Avatar, AvatarImage, AvatarFallback } from './avatar';

describe('Avatar', () => {
  it('renderiza o fallback quando a imagem não carrega (jsdom não carrega imagens)', () => {
    render(
      <Avatar>
        <AvatarImage src="https://example.com/avatar.png" alt="Usuário" />
        <AvatarFallback>US</AvatarFallback>
      </Avatar>,
    );
    expect(screen.getByText('US')).toBeInTheDocument();
  });

  it('aceita className customizado no root', () => {
    render(
      <Avatar className="custom-avatar">
        <AvatarFallback>AB</AvatarFallback>
      </Avatar>,
    );
    const root = document.querySelector('[data-slot="avatar"]');
    expect(root).toHaveClass('custom-avatar');
  });
});
