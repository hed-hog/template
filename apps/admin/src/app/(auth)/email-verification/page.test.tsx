import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/page/email-verification-page', () => ({
  EmailVerificationPage: () => <div data-testid="email-verification-page-stub" />,
}));

import Page from './page';

describe('EmailVerificationPage (route wrapper)', () => {
  it('renderiza o componente EmailVerificationPage', () => {
    render(<Page />);
    expect(screen.getByTestId('email-verification-page-stub')).toBeInTheDocument();
  });
});
