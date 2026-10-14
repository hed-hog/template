'use client';

import { useApp, useQuery } from '@hed-hog/next-app-provider';
import { toBlob } from 'html-to-image';

/**
 * Suporte e Melhorias do próprio admin, como cliente da Fábrica de Software
 * (app `hub` em `/factory/client/hub/*`). Este arquivo e os componentes desta
 * pasta são do shell: não importam nada da biblioteca factory. Em projeto sem
 * a Fábrica a rota de status não existe e o suporte simplesmente não aparece.
 */
export const SUPPORT_APP = 'hub';
export const SUPPORT_API = `/factory/client/${SUPPORT_APP}`;
/** Tela de Suporte e Melhorias (asset da biblioteca factory). */
export const SUPPORT_PAGE = '/factory/suporte';

/** Pede a abertura do "Propor melhoria" (ex.: botão dentro do fórum). */
export const PROPOSE_IMPROVEMENT_EVENT = 'support-propose-improvement';
/** Pede a abertura do "Reportar erro". */
export const REPORT_BUG_EVENT = 'support-report-bug';
/** Avisa qual fluxo está tirando o print (`detail`: 'bug' | 'improvement' | null). */
export const SUPPORT_CAPTURING_EVENT = 'support-capturing';
/** Avisa as telas de suporte abertas que um chamado ou tópico novo existe. */
export const SUPPORT_CHANGED_EVENT = 'support-changed';

/** Marque com este atributo o que não deve sair no print (ex.: o botão). */
export const SCREENSHOT_IGNORE_ATTR = 'data-screenshot-ignore';

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const ACCEPTED_ATTACHMENT_TYPES = [...IMAGE_TYPES, 'application/pdf'];
/** Mesmo limite do backend; o print da tela conta como um. */
export const MAX_ATTACHMENTS = 5;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

export type SupportStatus = {
  available: boolean;
  isApprover: boolean;
  message?: string;
};

/**
 * Disponibilidade do suporte para o usuário logado. `null` quando o projeto não
 * tem a Fábrica (rota inexistente) ou a primeira consulta não voltou.
 */
export function useSupportStatus() {
  const { request } = useApp();
  const query = useQuery<SupportStatus | null>({
    queryKey: ['support-status', SUPPORT_APP],
    queryFn: async () => {
      try {
        const response = await request<SupportStatus>({
          url: `${SUPPORT_API}/status`,
          showErrors: false,
        });
        return response.data;
      } catch {
        return null;
      }
    },
    staleTime: 60_000,
  });
  return {
    status: query.data ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}

export const isImage = (file: File) => IMAGE_TYPES.includes(file.type);

/** Imagens coladas com Ctrl+V; o texto colado segue para o campo. */
export function imagesFromPaste(event: React.ClipboardEvent): File[] {
  const images = Array.from(event.clipboardData.files).filter((file) =>
    file.type.startsWith('image/')
  );
  if (!images.length) return [];
  event.preventDefault();
  return images.map(
    (image, index) =>
      new File(
        [image],
        image.name || `print-colado${index ? `-${index + 1}` : ''}.png`,
        { type: image.type }
      )
  );
}

/**
 * Print da área visível da tela como PNG. `html-to-image` desenha pelo próprio
 * navegador (SVG foreignObject), então as cores `oklch` do Tailwind 4 saem
 * certas. Devolve null se falhar: o formulário abre do mesmo jeito.
 */
/**
 * Imagem que não carregou (ex.: logo com 400). O html-to-image só trata 404
 * como imagem ausente; qualquer outro erro derruba o print inteiro.
 */
const isBrokenImage = (node: Node) =>
  node instanceof HTMLImageElement && node.complete && node.naturalWidth === 0;

export async function captureScreen(): Promise<File | null> {
  try {
    const blob = await toBlob(document.body, {
      width: window.innerWidth,
      height: window.innerHeight,
      pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      cacheBust: true,
      filter: (node) =>
        !(node instanceof Element && node.hasAttribute(SCREENSHOT_IGNORE_ATTR)) &&
        !isBrokenImage(node),
    });
    return blob ? new File([blob], 'print-tela.png', { type: 'image/png' }) : null;
  } catch (error) {
    console.error('Não foi possível capturar a tela:', error);
    return null;
  }
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Contexto da tela atual: título visível e módulo (1º item do breadcrumb). */
export function currentScreenContext() {
  const title =
    document.querySelector('[data-slot="page-header"] h1, main h1')?.textContent?.trim() ||
    document.title;
  return {
    screenName: title?.slice(0, 200) || undefined,
    pageUrl: `${window.location.pathname}${window.location.search}`.slice(0, 500),
  };
}

/** Texto visível de um HTML do editor (`<p></p>` vazio conta como vazio). */
export function isBlankRichText(value: string | null | undefined) {
  return !(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

/**
 * O que o navegador sabe do ambiente de quem abre o chamado. Navegador,
 * sistema e país a API completa pelo User-Agent e pelo IP.
 */
export function collectClientContext() {
  if (typeof window === 'undefined') return undefined;
  const connection = (
    navigator as Navigator & { connection?: { effectiveType?: string } }
  ).connection;
  let timezone: string | undefined;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    timezone = undefined;
  }
  return {
    screenWidth: window.screen?.width,
    screenHeight: window.screen?.height,
    viewportWidth: window.innerWidth,
    viewportHeight: window.innerHeight,
    pixelRatio: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    language: navigator.language,
    timezone,
    colorScheme: window.matchMedia?.('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
    connection: connection?.effectiveType,
  };
}
