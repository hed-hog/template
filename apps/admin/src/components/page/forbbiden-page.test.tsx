import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const { logout } = vi.hoisted(() => ({ logout: vi.fn() }));
vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({ logout }),
}));

import { ForbiddenPage } from './forbbiden-page';

describe('ForbiddenPage', () => {
  it('renderiza o código 403 e a mensagem traduzida', () => {
    render(<ForbiddenPage />);

    expect(screen.getByText('403')).toBeInTheDocument();
    expect(screen.getByText('message')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'goToLogin' })
    ).toBeInTheDocument();
  });

  it('chama logout ao clicar no botão', () => {
    render(<ForbiddenPage />);

    fireEvent.click(screen.getByRole('button', { name: 'goToLogin' }));

    expect(logout).toHaveBeenCalledTimes(1);
  });
});
