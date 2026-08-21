import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const isStandaloneBuild =
  process.env.NEXT_STANDALONE === 'true' || process.env.NEXT_STANDALONE === '1';

const nextConfig: NextConfig = {
  output: isStandaloneBuild ? 'standalone' : undefined,
  transpilePackages: ['@hed-hog/next-app-provider', '@hed-hog/next-build-skew'],
  // Página prerenderizada responde `s-maxage=60, stale-while-revalidate=<expireTime - 60>`,
  // e o padrão do Next para `expireTime` é um ano. `stale-while-revalidate` vale
  // também para o cache privado do navegador: quem já visitou recebe o HTML de
  // um build antigo direto do disco, por meses, revalidando só em segundo
  // plano. Esse HTML aponta para chunks que o deploy seguinte apagou do pod (o
  // nome tem hash de conteúdo) e a página quebra com "module factory is not
  // available". Cinco minutos limitam a janela sem perder o alívio de tráfego.
  expireTime: 300,
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
