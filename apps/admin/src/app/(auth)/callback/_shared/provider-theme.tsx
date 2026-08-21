import {
  getIntegrationLogoTheme,
  IntegrationLogo,
  normalizeIntegrationProvider,
  resolveOAuthProvider,
} from '@/components/ui/integration-logo';

type ProviderTheme = {
  cardClassName: string;
  iconContainerClassName: string;
  icon: React.ReactNode;
  spinnerTopClassName: string;
  dotClassName: string;
  titleClassName: string;
  buttonClassName: string;
};

export function getOAuthProviderTheme(providerName: string): ProviderTheme {
  const normalizedProvider = resolveOAuthProvider(providerName);
  const styles = getIntegrationLogoTheme(normalizedProvider);

  return {
    ...styles,
    icon: (
      <IntegrationLogo provider={normalizedProvider} size={24} decorative />
    ),
  };
}

export function normalizeOAuthProviderName(providerName: string): string {
  return resolveOAuthProvider(normalizeIntegrationProvider(providerName));
}
