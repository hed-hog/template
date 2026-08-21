import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/page/forgot-page', () => ({
  ForgotPage: () => <div data-testid="forgot-page-stub" />,
}));

import Page from './page';

describe('ForgotPage (route wrapper)', () => {
  it('renderiza o componente ForgotPage', () => {
    render(<Page />);
    expect(screen.getByTestId('forgot-page-stub')).toBeInTheDocument();
  });
});
