import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// MaintenanceAlertBanner only calls useApp() for getSettingValue/currentLocaleCode,
// so we mock the provider hook directly for precise per-test control (simpler than
// wiring the real AppProvider + MSW for a component with no network calls).
const { mockGetSettingValue } = vi.hoisted(() => ({
  mockGetSettingValue: vi.fn(),
}));

let currentLocaleCode = 'pt-BR';

vi.mock('@hed-hog/next-app-provider', () => ({
  useApp: () => ({
    getSettingValue: mockGetSettingValue,
    currentLocaleCode,
  }),
}));

import { MaintenanceAlertBanner } from './maintenance-alert-banner';

describe('MaintenanceAlertBanner', () => {
  beforeEach(() => {
    mockGetSettingValue.mockReset();
    currentLocaleCode = 'pt-BR';
  });

  it('não renderiza nada quando o modo de manutenção está desativado', () => {
    mockGetSettingValue.mockReturnValue(false);
    const { container } = render(<MaintenanceAlertBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('não renderiza nada quando o valor da configuração é undefined', () => {
    mockGetSettingValue.mockReturnValue(undefined);
    const { container } = render(<MaintenanceAlertBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renderiza o texto em português quando o modo de manutenção está ativo e o locale é pt', () => {
    mockGetSettingValue.mockReturnValue(true);
    currentLocaleCode = 'pt-BR';
    render(<MaintenanceAlertBanner />);
    expect(screen.getByText('Sistema em manutenção')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Alguns recursos podem ficar instáveis enquanto concluímos a manutenção.'
      )
    ).toBeInTheDocument();
  });

  it('renderiza o texto em inglês quando o modo de manutenção está ativo e o locale não é pt', () => {
    mockGetSettingValue.mockReturnValue(true);
    currentLocaleCode = 'en-US';
    render(<MaintenanceAlertBanner />);
    expect(screen.getByText('System under maintenance')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Some features may be unstable while maintenance is in progress.'
      )
    ).toBeInTheDocument();
  });
});
