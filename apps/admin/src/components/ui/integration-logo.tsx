import { cn } from '@/lib/utils';
import { icons as logosSet } from '@iconify-json/logos';
import {
  HardDrive,
  Mail,
  MessageCircle,
  PlugZap,
  Sparkles,
} from 'lucide-react';
import type { ReactNode } from 'react';

const providerAliases: Record<string, string> = {
  microsft: 'microsoft',
  microsoft_entra_id: 'microsoft-entra-id',
  google_oauth: 'google-oauth',
  github_oauth: 'github-oauth',
  microsoft_oauth: 'microsoft-oauth',
  facebook_oauth: 'facebook-oauth',
  microsoft_entra_id_oauth: 'microsoft-entra-id-oauth',
  apple_oauth: 'apple-oauth',
  linkedin_oauth: 'linkedin-oauth',
  whatsapp_official: 'whatsapp-official',
  evolution_api: 'evolution-api',
  azure_blob: 'azure-blob',
  s3_compatible: 's3-compatible',
};

const oauthToProvider: Record<string, string> = {
  'google-oauth': 'google',
  'github-oauth': 'github',
  'microsoft-oauth': 'microsoft',
  'facebook-oauth': 'facebook',
  'microsoft-entra-id-oauth': 'microsoft-entra-id',
  'apple-oauth': 'apple',
  'linkedin-oauth': 'linkedin',
};

type IconifySet = {
  icons: Record<string, { body: string; width?: number; height?: number }>;
  width?: number;
  height?: number;
};

/**
 * Renders a colored logo from the offline `@iconify-json/logos` package as an
 * inline `<svg>` (without depending on `@iconify/react`'s `<Icon>`), preserving
 * the icon's aspect ratio. Keeps this file server-safe, since the helpers
 * exported here are also used by server components.
 */
function iconifyLogo(slug: string, size: number): ReactNode | null {
  const set: IconifySet = logosSet;
  const entry = set.icons[slug];
  if (!entry) return null;
  /* v8 ignore next 2 -- the trailing `?? 256` is a defensive fallback: @iconify-json/logos always defines a top-level width/height (256/256), so `set.width`/`set.height` are never nullish in practice */
  const w = entry.width ?? set.width ?? 256;
  const h = entry.height ?? set.height ?? 256;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${w} ${h}`}
      height={size}
      width={Math.round((size * w) / h)}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: entry.body }}
    />
  );
}

/**
 * Provider (normalized/resolved slug) → colored Iconify logo.
 * We only map clean, square icons from the `logos` set; brands without a
 * suitable icon — wordmarks (stripe, gemini), monochrome ones (github, openai)
 * or without an equivalent (microsoft-entra-id, mercado-pago, evolution-api) —
 * use a custom SVG in `providerPresentations` instead.
 */
const providerLogoIcons: Record<string, { slug: string; label: string }> = {
  google: { slug: 'google-icon', label: 'Google' },
  microsoft: { slug: 'microsoft-icon', label: 'Microsoft' },
  facebook: { slug: 'facebook', label: 'Facebook' },
  linkedin: { slug: 'linkedin-icon', label: 'LinkedIn' },
  claude: { slug: 'claude-icon', label: 'Claude' },
  'whatsapp-official': { slug: 'whatsapp-icon', label: 'WhatsApp' },
  gmail: { slug: 'google-gmail', label: 'Gmail' },
  ses: { slug: 'aws-ses', label: 'Amazon SES' },
  s3: { slug: 'aws-s3', label: 'Amazon S3' },
  gcs: { slug: 'google-cloud', label: 'Google Cloud Storage' },
  'azure-blob': { slug: 'microsoft-azure', label: 'Azure Blob' },
  digitalocean: { slug: 'digital-ocean-icon', label: 'DigitalOcean' },
  kubernetes: { slug: 'kubernetes', label: 'Kubernetes' },
  recaptcha: { slug: 'recaptcha', label: 'Google reCAPTCHA' },
  'cloudflare-turnstile': {
    slug: 'cloudflare-icon',
    label: 'Cloudflare Turnstile',
  },
};

type ProviderPresentation = {
  icon: ReactNode;
  label: string;
};

const providerPresentations: Record<string, ProviderPresentation> = {
  apple: {
    label: 'Apple',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 256 315"
        fill="currentColor"
        aria-hidden="true"
        className="text-black dark:text-white"
      >
        <path d="M213.803 167.03c.442 47.58 41.74 63.413 42.197 63.615c-.35 1.116-6.599 22.563-21.757 44.716c-13.104 19.153-26.705 38.235-48.13 38.63c-21.05.388-27.82-12.483-51.888-12.483c-24.061 0-31.582 12.088-51.51 12.871c-20.68.783-36.428-20.71-49.64-39.793c-27-39.033-47.633-110.3-19.928-158.406c13.763-23.89 38.36-39.017 65.056-39.405c20.307-.387 39.475 13.662 51.889 13.662c12.406 0 35.699-16.895 60.186-14.414c10.25.427 39.026 4.14 57.503 31.186c-1.49.923-34.335 20.044-33.978 59.822M174.24 50.199c10.98-13.29 18.369-31.79 16.353-50.199c-15.826.636-34.962 10.546-46.314 23.828c-10.173 11.763-19.082 30.589-16.678 48.633c17.64 1.365 35.66-8.964 46.64-22.262" />
      </svg>
    ),
  },
  github: {
    label: 'GitHub',
    icon: (
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
        className="text-black dark:text-white"
      >
        <path d="M12 0C5.37 0 0 5.37 0 12a12.01 12.01 0 0 0 8.21 11.39c.6.11.82-.26.82-.58v-2.24c-3.34.73-4.04-1.42-4.04-1.42-.55-1.38-1.34-1.75-1.34-1.75-1.09-.75.08-.73.08-.73 1.21.09 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.49 1 .11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.12-3.17 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6.01 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.65.25 2.87.12 3.17.77.84 1.24 1.91 1.24 3.22 0 4.61-2.81 5.62-5.49 5.92.43.37.82 1.1.82 2.22v3.29c0 .32.22.69.82.57A12 12 0 0 0 24 12c0-6.63-5.37-12-12-12Z" />
      </svg>
    ),
  },
  'microsoft-entra-id': {
    label: 'Microsoft Entra ID',
    icon: (
      <svg
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="m3.802,14.032c.388.242,1.033.511,1.715.511.621,0,1.198-.18,1.676-.487,0,0,.001,0,.002-.001l1.805-1.128v4.073c-.286,0-.574-.078-.824-.234l-4.374-2.734Z"
          fill="#225086"
        />
        <path
          d="m7.853,1.507L.353,9.967c-.579.654-.428,1.642.323,2.111,0,0,2.776,1.735,3.126,1.954.388.242,1.033.511,1.715.511.621,0,1.198-.18,1.676-.487,0,0,.001,0,.002-.001l1.805-1.128-4.364-2.728,4.365-4.924V1s0,0,0,0c-.424,0-.847.169-1.147.507Z"
          fill="#6df"
        />
        <polygon
          points="4.636 10.199 4.688 10.231 9 12.927 9.001 12.927 9.001 12.927 9.001 5.276 9 5.275 4.636 10.199"
          fill="#cbf8ff"
        />
        <path
          d="m17.324,12.078c.751-.469.902-1.457.323-2.111l-4.921-5.551c-.397-.185-.842-.291-1.313-.291-.925,0-1.752.399-2.302,1.026l-.109.123h0s4.364,4.924,4.364,4.924h0s0,0,0,0l-4.365,2.728v4.073c.287,0,.573-.078.823-.234l7.5-4.688Z"
          fill="#074793"
        />
        <path
          d="m9.001,1v4.275s.109-.123.109-.123c.55-.627,1.377-1.026,2.302-1.026.472,0,.916.107,1.313.291l-2.579-2.909c-.299-.338-.723-.507-1.146-.507Z"
          fill="#0294e4"
        />
        <polygon
          points="13.365 10.199 13.365 10.199 13.365 10.199 9.001 5.276 9.001 12.926 13.365 10.199"
          fill="#96bcc2"
        />
      </svg>
    ),
  },
  'mercado-pago': {
    label: 'Mercado Pago',
    icon: (
      <svg width="24" height="24" viewBox="0 0 150 104" aria-hidden="true">
        <path
          fill="#0A0080"
          d="M150 49.027c0-26.944-33.685-48.87-75-48.87-41.501 0-75 21.926-75 48.87v2.787c0 28.616 29.404 51.843 75 51.843 45.968 0 75-23.227 75-51.843v-2.787Z"
        />
        <path
          fill="#2ABCFF"
          d="M147.022 49.027c0 25.457-32.196 46.083-72.022 46.083-39.826 0-72.022-20.626-72.022-46.083C2.978 23.57 35.174 2.944 75 2.944c39.826.186 72.022 20.626 72.022 46.083Z"
        />
        <path
          fill="#fff"
          d="M50.993 34.533s-.745.743-.373 1.487c1.117 1.486 4.653 2.23 8.189 1.486 2.047-.557 4.839-2.601 7.444-4.645 2.792-2.23 5.583-4.46 8.56-5.389 2.979-.93 4.84-.558 6.142-.186 1.49.372 2.978 1.3 5.584 3.345 5.024 3.716 24.751 20.997 28.101 23.97 2.792-1.3 15.075-6.503 31.638-10.22-1.117-8.919-6.514-17.095-14.702-23.784-11.353 4.831-25.31 7.247-39.082.557 0 0-7.444-3.53-14.702-3.345-10.794.186-15.447 5.017-20.472 9.849l-6.327 6.875Z"
        />
        <path
          fill="#fff"
          d="M114.082 56.274c-.186-.186-23.263-20.44-28.474-24.342-2.978-2.23-4.653-2.788-6.514-3.16-.93-.185-2.233 0-3.163.372-2.42.744-5.584 2.788-8.375 5.017-2.978 2.416-5.77 4.46-8.189 5.017-3.163.93-7.258 0-9.119-1.114-.744-.558-1.303-1.115-1.489-1.673-.744-1.486.559-2.787.745-2.973l6.327-6.875 2.233-2.23c-2.047.186-3.908.743-5.769 1.3-2.233.558-4.466 1.302-6.7 1.302-.93 0-5.955-.744-6.885-1.115-5.77-1.487-10.794-3.16-18.425-6.69C11.166 25.8 5.211 34.161 3.536 43.452c1.303.372 3.35.93 4.28 1.115 20.472 4.46 26.8 9.291 28.102 10.22 1.303-1.3 2.978-2.23 5.025-2.23 2.233 0 4.28 1.115 5.583 2.974 1.117-.93 2.792-1.673 4.839-1.673.93 0 1.86.186 2.977.558a6.83 6.83 0 0 1 4.095 3.716c.744-.372 1.675-.557 2.791-.557 1.117 0 2.233.185 3.35.743 3.722 1.672 4.28 5.389 4.094 8.176h.745c4.466 0 8.189 3.716 8.189 8.176 0 1.3-.373 2.601-.931 3.902 1.303.743 4.28 2.23 7.072 1.858 2.233-.186 2.978-.929 3.35-1.486.186-.372.372-.558.186-.93l-5.77-6.503s-.93-.93-.558-1.3c.373-.372.93.185 1.303.557 2.978 2.415 6.514 6.132 6.514 6.132s.372.557 1.675.743c1.116.186 3.163 0 4.652-1.115.373-.372.745-.743.93-1.115 1.49-1.858-.185-3.716-.185-3.716l-6.7-7.619s-.93-.929-.558-1.3c.372-.372.93.185 1.302.557a253.206 253.206 0 0 1 8.003 7.619c.558.371 3.164 2.044 6.513-.186 2.048-1.301 2.42-2.973 2.42-4.274-.186-1.672-1.489-2.787-1.489-2.787l-9.305-9.291s-.93-.744-.558-1.301c.372-.372.93.186 1.302.557 2.978 2.416 10.98 9.663 10.98 9.663.186 0 2.792 2.044 6.328-.186 1.303-.743 2.047-1.858 2.047-3.345-.372-2.044-2.047-3.53-2.047-3.53Z"
        />
        <path
          fill="#fff"
          d="M69.417 67.98c-1.489 0-2.978.744-3.164.744-.186 0 0-.558.186-.93.186-.371 2.047-5.946-2.605-7.99-3.536-1.486-5.583.186-6.328.93-.186.185-.372.185-.372 0 0-.93-.558-3.717-3.536-4.646-4.28-1.3-7.072 1.672-7.816 2.787-.373-2.415-2.42-4.46-5.025-4.46a5 5 0 0 0-5.025 5.018 5 5 0 0 0 5.025 5.017c1.303 0 2.605-.558 3.536-1.487v.186c-.186 1.3-.559 5.76 4.094 7.619 1.861.743 3.536.186 4.839-.744.372-.371.372-.185.372.186-.186 1.115 0 3.717 3.536 5.017 2.605 1.115 4.28 0 5.21-.929.373-.371.56-.371.56.372.185 3.345 2.977 5.946 6.327 5.946 3.536 0 6.327-2.787 6.327-6.318.186-3.344-2.605-6.132-6.141-6.318Z"
        />
        <path
          fill="#0A0080"
          d="M115.012 53.858c-7.072-6.132-23.635-20.44-27.915-23.785-2.606-1.858-4.28-2.973-5.77-3.344-.744-.186-1.674-.372-2.791-.372s-2.42.186-3.536.558c-2.792.929-5.77 3.158-8.56 5.388l-.187.186c-2.605 2.044-5.21 4.088-7.258 4.646-.93.185-1.861.371-2.605.371-2.234 0-4.28-.743-5.025-1.672-.186-.186 0-.372.186-.744l6.141-7.06c4.839-4.832 9.492-9.477 20.1-9.663h.558c6.7 0 13.213 2.973 13.958 3.345 6.327 2.973 12.655 4.46 19.168 4.46 6.7 0 13.586-1.673 21.03-5.018-.744-.743-1.675-1.3-2.605-2.044-6.328 2.787-12.469 4.088-18.425 4.088-5.955 0-12.096-1.486-17.866-4.274-.372-.186-7.63-3.53-15.26-3.53h-.558c-8.933.186-13.958 3.344-17.308 6.132-3.35 0-6.142.929-8.747 1.672-2.233.558-4.28 1.115-6.142 1.115h-2.233c-2.233 0-13.213-2.787-21.96-6.132-.93.557-1.675 1.3-2.605 2.044 9.119 3.716 20.285 6.69 23.82 6.875.931 0 2.048.186 2.979.186 2.233 0 4.652-.557 6.885-1.3 1.303-.372 2.792-.744 4.28-1.116l-1.302 1.301-6.328 6.876c-.558.557-1.674 1.858-.93 3.53.372.743.93 1.3 1.675 1.858 1.489.93 4.28 1.673 6.7 1.673.93 0 1.86 0 2.605-.372 2.606-.557 5.397-2.787 8.375-5.203 2.42-1.858 5.77-4.274 8.188-5.017.745-.186 1.675-.372 2.234-.372h.558c1.675.186 3.35.744 6.328 2.973 5.21 3.903 28.287 24.157 28.473 24.343 0 0 1.489 1.3 1.303 3.344 0 1.115-.744 2.23-1.861 2.974-.93.557-2.047.929-2.978.929-1.488 0-2.605-.744-2.605-.744s-8.002-7.247-10.98-9.662c-.372-.372-.93-.744-1.303-.744-.186 0-.372.186-.558.372-.372.557 0 1.3.744 1.858l9.305 9.291s1.117 1.115 1.303 2.416c0 1.486-.744 2.787-2.233 3.902-1.117.743-2.233 1.115-3.35 1.115-1.489 0-2.42-.557-2.605-.743l-1.303-1.301c-2.42-2.416-4.839-4.831-6.7-6.318-.372-.371-.93-.743-1.303-.743-.186 0-.372 0-.558.186-.186.186-.372.743.186 1.3a2.3 2.3 0 0 0 .372.558l6.7 7.618s1.303 1.673.186 3.16l-.186.37-.558.558c-1.117.93-2.606 1.115-3.35 1.115h-.93c-.745-.186-1.117-.371-1.303-.557-.373-.372-3.722-3.902-6.514-6.132-.372-.372-.744-.743-1.303-.743-.186 0-.372 0-.558.185-.558.558.372 1.487.558 1.859l5.77 6.317s0 .186-.186.372c-.187.372-.931.93-2.978 1.3h-.745c-2.233 0-4.466-1.114-5.583-1.672.559-1.115.745-2.415.745-3.716 0-4.645-3.908-8.548-8.561-8.548h-.372c.186-2.23-.186-6.317-4.28-7.99-1.117-.557-2.42-.743-3.537-.743-.93 0-1.86.186-2.605.557-.93-1.672-2.233-2.973-4.28-3.53-1.117-.372-2.048-.558-3.164-.558-1.675 0-3.35.558-4.839 1.487-1.303-1.672-3.536-2.787-5.583-2.787-1.861 0-3.722.743-5.211 2.044-1.861-1.301-8.933-5.947-27.916-10.22-.93-.186-2.977-.744-4.28-1.115-.186 1.115-.372 2.044-.558 3.159 0 0 3.536.929 4.28.929 19.355 4.274 25.868 8.733 26.985 9.662a7.446 7.446 0 0 0-.558 2.787c0 4.089 3.35 7.247 7.258 7.247.372 0 .93 0 1.303-.185.558 2.973 2.605 5.203 5.397 6.317.93.372 1.675.558 2.605.558.558 0 1.117 0 1.675-.186.558 1.3 1.861 3.159 4.466 4.274.931.372 1.861.557 2.792.557.745 0 1.489-.185 2.233-.371 1.303 3.159 4.467 5.389 8.003 5.389 2.233 0 4.466-.93 6.141-2.602 1.303.743 4.28 2.23 7.258 2.23h1.117c2.978-.372 4.28-1.487 4.839-2.416.186-.186.186-.371.372-.557.744.186 1.489.371 2.233.371 1.675 0 3.164-.557 4.653-1.672 1.489-1.115 2.605-2.601 2.791-4.088.559.186 1.117.186 1.489.186 1.675 0 3.35-.558 4.839-1.487 2.977-2.044 3.536-4.46 3.536-6.132.558.186 1.116.186 1.675.186 1.489 0 2.977-.557 4.466-1.3a6.49 6.49 0 0 0 3.164-5.018c.186-1.486-.186-2.787-.931-4.088 5.025-2.23 16.378-6.318 29.963-9.29 0-1.116-.186-2.045-.372-3.16-16.191 2.974-28.288 8.176-31.452 9.477ZM69.417 80.244c-3.164 0-5.77-2.415-5.956-5.574 0-.186 0-.93-.558-.93-.186 0-.372.187-.744.372-.745.558-1.675 1.301-2.792 1.301-.558 0-1.302-.186-1.86-.371-3.35-1.301-3.35-3.717-3.165-4.646 0-.186 0-.557-.186-.743l-.186-.186h-.186c-.186 0-.372 0-.558.186-1.117.743-2.047 1.115-2.978 1.115-.558 0-1.116-.186-1.675-.372-4.466-1.672-4.094-5.946-3.908-7.061 0-.186 0-.372-.186-.557l-.372-.186-.373.371c-.93.744-2.047 1.301-3.163 1.301-2.606 0-4.653-2.044-4.653-4.645 0-2.602 2.047-4.646 4.653-4.646 2.233 0 4.28 1.672 4.466 3.902l.186 1.301.745-1.115c0-.186 1.86-2.973 5.397-2.973.558 0 1.302.186 2.047.372 2.791.743 3.164 3.344 3.164 4.273 0 .558.558.558.558.558.186 0 .372-.186.558-.186.559-.557 1.675-1.486 3.35-1.486.745 0 1.675.185 2.606.557 4.28 1.858 2.419 7.247 2.419 7.433-.372.929-.372 1.3 0 1.486h.372c.186 0 .372 0 .745-.186.558-.185 1.489-.557 2.233-.557 3.164 0 5.955 2.602 5.955 5.946 0 3.345-2.605 5.946-5.955 5.946Z"
        />
      </svg>
    ),
  },
  stripe: {
    label: 'Stripe',
    icon: (
      <svg width="24" height="24" viewBox="0 0 400 400" aria-hidden="true">
        <path fill="#635BFF" d="M0 0h400v400H0z" />
        <path
          fill="#FFFFFF"
          d="M184.4 155.5c0-9.4 7.7-13.1 20.5-13.1 18.4 0 41.6 5.6 60 15.5v-56.8C244.8 93.1 225 90 205 90c-49.1 0-81.7 25.6-81.7 68.4 0 66.7 91.9 56.1 91.9 84.9 0 11.1-9.7 14.7-23.2 14.7-20.1 0-45.7-8.2-66-19.3v57.5c22.5 9.7 45.2 13.8 66 13.8 50.3 0 84.9-24.9 84.9-68.2-.4-72-92.5-59.2-92.5-86.3z"
        />
      </svg>
    ),
  },
  openai: {
    label: 'OpenAI',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#10A37F" />
        <path
          fill="white"
          d="M12 6.5a2.8 2.8 0 0 1 2.8 2.8v1.2h1.2a2.8 2.8 0 1 1 0 5.6h-1.2v1.2A2.8 2.8 0 1 1 9.2 17.3v-1.2H8a2.8 2.8 0 1 1 0-5.6h1.2V9.3A2.8 2.8 0 0 1 12 6.5Zm0 1.8a1 1 0 0 0-1 1v1.8a1 1 0 0 1-1 1H8a1 1 0 1 0 0 2h2a1 1 0 0 1 1 1v1.8a1 1 0 1 0 2 0v-1.8a1 1 0 0 1 1-1h2a1 1 0 1 0 0-2h-2a1 1 0 0 1-1-1V9.3a1 1 0 0 0-1-1Z"
        />
      </svg>
    ),
  },
  gemini: {
    label: 'Gemini',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <defs>
          <linearGradient id="gemini-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#1A73E8" />
            <stop offset="100%" stopColor="#A142F4" />
          </linearGradient>
        </defs>
        <path
          fill="url(#gemini-gradient)"
          d="M12 2.5c.42 0 .76.34.76.76A8.74 8.74 0 0 0 20.5 11c.42 0 .76.34.76.76a.76.76 0 0 1-.76.76 8.74 8.74 0 0 0-7.74 7.74.76.76 0 0 1-1.52 0 8.74 8.74 0 0 0-7.74-7.74.76.76 0 0 1 0-1.52 8.74 8.74 0 0 0 7.74-7.74c0-.42.34-.76.76-.76Z"
        />
      </svg>
    ),
  },
  'evolution-api': {
    label: 'Evolution API',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="11" fill="#25D366" />
        <path
          fill="white"
          d="M16.64 13.98c-.24-.12-1.44-.71-1.67-.8-.23-.08-.39-.12-.56.12-.16.24-.64.79-.78.95-.14.16-.28.18-.52.06-.24-.12-1-.37-1.91-1.18-.7-.62-1.18-1.39-1.32-1.63-.14-.24-.02-.36.1-.48.1-.1.24-.26.36-.39.12-.14.16-.24.24-.4.08-.16.04-.3-.02-.42-.06-.12-.56-1.35-.77-1.85-.2-.48-.41-.41-.56-.42h-.48c-.16 0-.42.06-.64.3-.22.24-.84.82-.84 2s.86 2.31.98 2.47c.12.16 1.69 2.58 4.09 3.61.57.25 1.02.4 1.37.5.58.18 1.1.15 1.52.09.46-.07 1.44-.59 1.64-1.17.2-.58.2-1.08.14-1.17-.06-.1-.22-.16-.46-.28Z"
        />
      </svg>
    ),
  },
};

const categorizedFallbacks: Record<string, ProviderPresentation> = {
  smtp: {
    label: 'SMTP',
    icon: <Mail className="text-blue-600" size={20} aria-hidden="true" />,
  },
  local: {
    label: 'Local',
    icon: <HardDrive className="text-slate-600" size={20} aria-hidden="true" />,
  },
  's3-compatible': {
    label: 'S3 Compatible',
    icon: <HardDrive className="text-teal-500" size={20} aria-hidden="true" />,
  },
};

function toTitleCase(value: string): string {
  return value
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function normalizeIntegrationProvider(provider: string): string {
  const normalized = provider.trim().toLowerCase().replace(/_/g, '-');
  return providerAliases[normalized] ?? normalized;
}

export function resolveOAuthProvider(provider: string): string {
  const normalized = normalizeIntegrationProvider(provider);
  return oauthToProvider[normalized] ?? normalized;
}

export function formatIntegrationProviderName(
  provider: string,
  fallbackName?: string
): string {
  const normalized = normalizeIntegrationProvider(provider);
  const resolved = resolveOAuthProvider(normalized);
  return (
    providerLogoIcons[resolved]?.label ??
    /* v8 ignore next -- unreachable: `resolved` only differs from `normalized` when `normalized` is an oauth-suffixed key, and no "-oauth"-suffixed key exists in `providerLogoIcons`, so this is never truthy while the `resolved` lookup above is falsy */
    providerLogoIcons[normalized]?.label ??
    providerPresentations[resolved]?.label ??
    /* v8 ignore next -- unreachable for the same reason: no "-oauth"-suffixed key exists in `providerPresentations` */
    providerPresentations[normalized]?.label ??
    categorizedFallbacks[normalized]?.label ??
    (fallbackName?.trim() || toTitleCase(normalized))
  );
}

export function getIntegrationLogoTheme(provider: string): {
  cardClassName: string;
  iconContainerClassName: string;
  spinnerTopClassName: string;
  dotClassName: string;
  titleClassName: string;
  buttonClassName: string;
} {
  const normalized = resolveOAuthProvider(provider);

  if (normalized === 'google') {
    return {
      cardClassName: 'border border-slate-100',
      iconContainerClassName: 'bg-white',
      spinnerTopClassName: 'border-t-[#4285F4]',
      dotClassName: 'bg-[#4285F4]',
      titleClassName: 'text-[#1A73E8]',
      buttonClassName: 'bg-[#4285F4] text-white hover:bg-[#3367D6]',
    };
  }

  if (normalized === 'facebook') {
    return {
      cardClassName: 'border border-slate-100',
      iconContainerClassName: 'bg-white',
      spinnerTopClassName: 'border-t-[#1877F2]',
      dotClassName: 'bg-[#1877F2]',
      titleClassName: 'text-[#1877F2]',
      buttonClassName: 'bg-[#1877F2] text-white hover:bg-[#166FE5]',
    };
  }

  if (normalized === 'microsoft') {
    return {
      cardClassName: 'border border-slate-100',
      iconContainerClassName: 'bg-white',
      spinnerTopClassName: 'border-t-[#00a4ef]',
      dotClassName: 'bg-[#00a4ef]',
      titleClassName: 'text-[#0078D4]',
      buttonClassName: 'bg-[#00a4ef] text-white hover:bg-[#0088cb]',
    };
  }

  if (normalized === 'apple') {
    return {
      cardClassName: 'border border-slate-100',
      iconContainerClassName: 'bg-white',
      spinnerTopClassName: 'border-t-foreground',
      dotClassName: 'bg-foreground',
      titleClassName: 'text-foreground',
      buttonClassName: 'bg-black text-white hover:bg-neutral-800',
    };
  }

  if (normalized === 'linkedin') {
    return {
      cardClassName: 'border border-slate-100',
      iconContainerClassName: 'bg-white',
      spinnerTopClassName: 'border-t-[#0A66C2]',
      dotClassName: 'bg-[#0A66C2]',
      titleClassName: 'text-[#0A66C2]',
      buttonClassName: 'bg-[#0A66C2] text-white hover:bg-[#0958a5]',
    };
  }

  return {
    cardClassName: 'border border-border',
    iconContainerClassName: 'bg-white',
    spinnerTopClassName: 'border-t-foreground',
    dotClassName: 'bg-foreground',
    titleClassName: 'text-foreground',
    buttonClassName: 'bg-foreground text-background hover:bg-foreground/90',
  };
}

export function IntegrationLogo({
  provider,
  size = 20,
  className,
  title,
  decorative = true,
}: {
  provider: string;
  size?: number;
  className?: string;
  title?: string;
  decorative?: boolean;
}) {
  const normalized = normalizeIntegrationProvider(provider);
  const resolved = resolveOAuthProvider(normalized);

  // 1) Colored Iconify logo (offline data from @iconify-json/logos).
  const logoEntry =
    providerLogoIcons[resolved] ?? providerLogoIcons[normalized];
  const iconifyNode = logoEntry ? iconifyLogo(logoEntry.slug, size) : null;

  // 2/3/4) Remaining custom SVG, categorized Lucide fallback, or dynamic one.
  const presentation = providerPresentations[resolved] ??
    providerPresentations[normalized] ??
    categorizedFallbacks[normalized] ?? {
      label: toTitleCase(normalized),
      icon:
        normalized.includes('message') || normalized.includes('whatsapp') ? (
          <MessageCircle
            className="text-green-500"
            size={20}
            aria-hidden="true"
          />
        ) : normalized.includes('ai') ||
          normalized === 'gemini' ||
          normalized === 'claude' ? (
          <Sparkles className="text-violet-500" size={20} aria-hidden="true" />
        ) : /* v8 ignore next 4 -- unreachable: any string containing 'mail' already contains 'ai' (matched above), and 'smtp'/'gmail' are always resolved earlier via categorizedFallbacks/providerLogoIcons before this default */
          normalized.includes('mail') ||
          normalized === 'smtp' ||
          normalized === 'gmail' ? (
          <Mail className="text-blue-600" size={20} aria-hidden="true" />
        ) : normalized.includes('storage') ||
          normalized.includes('s3') ||
          normalized.includes('blob') ? (
          <HardDrive className="text-amber-500" size={20} aria-hidden="true" />
        ) : (
          <PlugZap className="text-primary" size={20} aria-hidden="true" />
        ),
    };

  const icon = iconifyNode ?? presentation.icon;
  const label = iconifyNode
    ? /* v8 ignore next -- unreachable: `iconifyNode` is only ever truthy when `logoEntry` is truthy (it's computed from `logoEntry.slug`), so `logoEntry?.label` is never nullish here and `presentation.label` is never used as the fallback */
      (logoEntry?.label ?? presentation.label)
    : presentation.label;

  return (
    <span
      className={cn('inline-flex items-center justify-center', className)}
      style={iconifyNode ? { height: size } : { width: size, height: size }}
      title={title ?? label}
      aria-hidden={decorative}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : (title ?? label)}
    >
      {icon}
    </span>
  );
}
