import { buildAdminApiUrl, fetchAdminApiJson } from '@/lib/admin-api';
import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const contentType = 'image/png';
export const size = {
  width: 32,
  height: 32,
};
export const revalidate = 3600; // 1 hora, mas pode ser revalidado manualmente

type IconSettingsResponse = {
  setting?: {
    'icon-url'?: string;
  };
};

const renderFallbackIcon = () =>
  new ImageResponse(
    <div
      style={{
        fontSize: 20,
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontWeight: 'bold',
      }}
    >
      HH
    </div>,
    {
      ...size,
    }
  );

export default async function Icon({}: {
  params?: Promise<Record<string, string | string[] | undefined>>;
} = {}) {
  try {
    const data = await fetchAdminApiJson<IconSettingsResponse>(
      '/setting/initial',
      {
        next: { tags: ['icon-url'] },
      }
    );

    const iconUrl = data?.setting?.['icon-url'];

    if (iconUrl) {
      // Se a URL for absoluta (http/https), busca a imagem
      if (iconUrl.startsWith('http://') || iconUrl.startsWith('https://')) {
        const imageResponse = await fetch(iconUrl, {
          cache: 'no-store',
        });

        if (!imageResponse.ok) {
          console.warn(
            `Failed to fetch icon from ${iconUrl}: ${imageResponse.status} ${imageResponse.statusText}`
          );
          throw new Error(`HTTP ${imageResponse.status}`);
        }

        const imageBuffer = await imageResponse.arrayBuffer();

        return new Response(imageBuffer, {
          headers: {
            'Content-Type':
              imageResponse.headers.get('content-type') || 'image/png',
            'Cache-Control': 'public, max-age=3600, must-revalidate',
          },
        });
      }

      // Se for um caminho relativo, busca da API
      if (iconUrl.startsWith('/')) {
        const fullUrl = buildAdminApiUrl(iconUrl);
        const imageResponse = await fetch(fullUrl, {
          cache: 'no-store',
          next: { tags: ['icon-url'] },
        });

        if (!imageResponse.ok) {
          console.warn(
            `Failed to fetch icon from ${fullUrl}: ${imageResponse.status} ${imageResponse.statusText}`
          );
          return renderFallbackIcon();
        }

        const imageBuffer = await imageResponse.arrayBuffer();

        return new Response(imageBuffer, {
          headers: {
            'Content-Type':
              imageResponse.headers.get('content-type') || 'image/png',
            'Cache-Control': 'public, max-age=3600, must-revalidate',
          },
        });
      }
    }
  } catch (error) {
    console.error('Error loading dynamic icon:', error);
  }

  // Fallback: gera um ícone simples com as iniciais HH
  return renderFallbackIcon();
}
