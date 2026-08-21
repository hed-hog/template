import type { HelmetOptions } from 'helmet';

// Opções do helmet compartilhadas entre o bootstrap (main.ts) e os testes.
// Conservadoras para uma API JSON consumida por front-ends de outra origem:
//  - CSP desligado (a API não serve HTML; evita surpresas).
//  - CORP/COEP liberados para cross-origin: o front carrega arquivos/imagens
//    servidos pela API (ex.: /file/open, /file/download).
// Mantém os headers de segurança valiosos: X-Content-Type-Options (nosniff),
// X-Frame-Options, HSTS, Referrer-Policy, e remove X-Powered-By.
export const helmetOptions: HelmetOptions = {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
};
