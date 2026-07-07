import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const isStandaloneBuild =
  process.env.NEXT_STANDALONE === 'true' || process.env.NEXT_STANDALONE === '1';

const nextConfig: NextConfig = {
  output: isStandaloneBuild ? 'standalone' : undefined,
  transpilePackages: ['@hed-hog/next-app-provider'],
  experimental: {
    proxyClientMaxBodySize: '100mb',
  },
  devIndicators: {
    position: 'bottom-right',
  },
  async rewrites() {
    if (process.env.NODE_ENV !== 'development') {
      return [];
    }

    // Prioritize the server-side internal URL in containers and fall back to
    // an absolute public base URL when one is configured for local/dev flows.
    const internalApiUrl = process.env.INTERNAL_API_URL?.trim();
    const publicBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL?.trim();

    const apiUrl = (
      internalApiUrl ||
      (publicBaseUrl && /^https?:\/\//i.test(publicBaseUrl)
        ? publicBaseUrl
        : undefined) ||
      'http://localhost:3100'
    ).replace(/\/$/, '');
    const apiBaseUrl = apiUrl.replace(/\/api$/, '');

    return [
      {
        source: '/api/:path*',
        destination: `${apiBaseUrl}/:path*`,
      },
    ];
  },
};

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

export default withNextIntl(nextConfig);
