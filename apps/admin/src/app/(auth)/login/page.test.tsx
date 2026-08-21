import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/page/login-page', () => ({
  LoginPage: () => <div data-testid="login-page-stub" />,
}));

import Page from './page';

describe('LoginPage (route wrapper)', () => {
  it('renderiza o componente LoginPage', () => {
    render(<Page />);
    expect(screen.getByTestId('login-page-stub')).toBeInTheDocument();
  });
});
