import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/components/page/mfa-page', () => ({
  MfaPage: () => <div data-testid="mfa-page-stub" />,
}));

import Page from './page';

describe('MfaPage (route wrapper)', () => {
  it('renderiza o componente MfaPage', () => {
    render(<Page />);
    expect(screen.getByTestId('mfa-page-stub')).toBeInTheDocument();
  });
});
