import type { HelmetOptions } from 'helmet';

// Helmet options shared between the bootstrap (main.ts) and the tests.
// Conservative for a JSON API consumed by front-ends from another origin:
//  - CSP disabled (the API doesn't serve HTML; avoids surprises).
//  - CORP/COEP relaxed for cross-origin: the front-end loads files/images
//    served by the API (e.g.: /file/open, /file/download).
// Keeps the valuable security headers: X-Content-Type-Options (nosniff),
// X-Frame-Options, HSTS, Referrer-Policy, and removes X-Powered-By.
export const helmetOptions: HelmetOptions = {
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' },
};
