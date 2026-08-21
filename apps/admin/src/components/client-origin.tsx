'use client';

import { BrowserIcon, CountryFlag, OsIcon } from '@/components/browser-os-icon';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { logoIcons } from '@/generated/browser-os-logos';
import { Icon } from '@iconify/react';
import { Monitor, Smartphone, Tablet } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * De onde um acesso veio: site ou aplicativo, qual navegador, qual sistema,
 * qual aparelho, de onde no mundo.
 *
 * Os componentes recebem `t` por parâmetro em vez de chamarem `useTranslations`:
 * cada tela que os usa tem seu próprio namespace de mensagens, e é o padrão que
 * `DeviceMeta` (na aba de alunos do curso) já seguia.
 */

export type ClientOriginData = {
  clientKind?: string | null;
  clientApp?: string | null;
  appVersion?: string | null;
  deviceType?: string | null;
  browser?: string | null;
  browserVersion?: string | null;
  os?: string | null;
  osVersion?: string | null;
  screenWidth?: number | null;
  screenHeight?: number | null;
  ip?: string | null;
  city?: string | null;
  country?: string | null;
  /** Origem deduzida do acesso mais próximo, não medida no próprio evento. */
  inferred?: boolean;
};

/** Assinatura mínima compatível com o `t` do next-intl, sem amarrar namespace. */
type Translate = (key: string, values?: Record<string, string | number | Date>) => string;

const KNOWN_DEVICE_TYPES = ['mobile', 'tablet', 'desktop'];

/** Cores por plataforma. O verde do Android e o cinza da Apple são as marcas. */
const PLATFORM_STYLE: Record<string, string> = {
  ios: 'border-zinc-400/30 bg-zinc-500/10 text-zinc-700 dark:text-zinc-300',
  android: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  web: 'border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300',
};

export function deviceTypeLabel(t: Translate, type: string | null | undefined) {
  const key = (type ?? '').toLowerCase();
  return t(`deviceTypes.${KNOWN_DEVICE_TYPES.includes(key) ? key : 'desktop'}`);
}

export function DeviceTypeIcon({
  type,
  className,
}: {
  type: string | null | undefined;
  className?: string;
}) {
  switch ((type ?? '').toLowerCase()) {
    case 'mobile':
      return <Smartphone className={className} />;
    case 'tablet':
      return <Tablet className={className} />;
    default:
      return <Monitor className={className} />;
  }
}

/**
 * Logo da plataforma nativa. `apple` e `android-icon` vêm do mesmo subconjunto
 * do Iconify que já alimenta os ícones de navegador e sistema, então não custam
 * nenhum ícone novo no bundle.
 */
function PlatformLogo({ kind, size = 12 }: { kind: string; size?: number }) {
  const slug = kind === 'ios' ? 'apple' : kind === 'android' ? 'android-icon' : null;
  if (!slug) return null;
  return <Icon icon={logoIcons[slug]} height={size} className="shrink-0" />;
}

/** Junta "Nome versão" ignorando as partes vazias. */
function nameWithVersion(name?: string | null, version?: string | null) {
  return [name, version].filter(Boolean).join(' ') || null;
}

/** Versão "maior" para rótulo curto: 131.0.0.0 → 131. */
function majorVersion(version?: string | null) {
  return version ? (version.split('.')[0] ?? null) : null;
}

function Chip({
  icon,
  label,
  tooltip,
}: {
  icon: ReactNode;
  label?: ReactNode;
  tooltip: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex min-w-0 cursor-default items-center gap-1">
          {icon}
          {label != null && <span className="truncate">{label}</span>}
        </span>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}

/** Nome do portal/app, quando conhecido: "App Class", "Class", "Training". */
function appLabel(t: Translate, origin: ClientOriginData) {
  const app = origin.clientApp;
  if (!app) return null;
  const key = `clientApps.${app}`;
  return nameWithVersion(t(key), origin.appVersion);
}

/**
 * Selo de plataforma: a resposta curta para "site ou aplicativo".
 *
 * No app nativo o logo é o da plataforma; na web é o do próprio navegador, que
 * já diz mais do que a palavra "web" diria.
 */
export function ClientOriginBadge({
  origin,
  t,
  className,
}: {
  origin: ClientOriginData | null | undefined;
  t: Translate;
  className?: string;
}) {
  const kind = origin?.clientKind ?? null;
  if (!kind || kind === 'unknown') return null;

  const isNative = kind === 'ios' || kind === 'android';

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 px-1.5 py-0 text-[10px] font-normal',
        PLATFORM_STYLE[kind] ?? '',
        className,
      )}
    >
      {isNative ? <PlatformLogo kind={kind} /> : <BrowserIcon name={origin?.browser} size={11} />}
      {isNative
        ? (appLabel(t, origin!) ?? t(`platform.${kind}`))
        : (appLabel(t, origin!) ?? t('platform.web'))}
    </Badge>
  );
}

/**
 * Linha compacta de origem, para o rodapé do painel ao vivo e a célula da
 * tabela. Tudo com ícone e tooltip: o texto sozinho ocuparia o dobro do espaço.
 */
export function ClientOriginInline({
  origin,
  t,
  className,
  showBadge = true,
}: {
  origin: ClientOriginData | null | undefined;
  t: Translate;
  className?: string;
  showBadge?: boolean;
}) {
  if (!origin) {
    return <span className={cn('text-muted-foreground', className)}>{t('origin.unknown')}</span>;
  }

  const browser = nameWithVersion(origin.browser, majorVersion(origin.browserVersion));
  const os = nameWithVersion(origin.os, origin.osVersion);
  const place = [origin.city, origin.country].filter(Boolean).join(', ');

  return (
    <span
      className={cn(
        'text-muted-foreground flex min-w-0 items-center gap-x-2',
        origin.inferred && 'opacity-70',
        className,
      )}
    >
      {showBadge && <ClientOriginBadge origin={origin} t={t} />}

      {origin.browser && (
        <Chip
          icon={<BrowserIcon name={origin.browser} size={12} />}
          label={browser}
          tooltip={t('tooltips.browser', { value: browser ?? '' })}
        />
      )}

      {origin.os && (
        <Chip
          icon={<OsIcon name={origin.os} size={12} />}
          label={os}
          tooltip={t('tooltips.os', { value: os ?? '' })}
        />
      )}

      {origin.deviceType && (
        <Chip
          icon={<DeviceTypeIcon type={origin.deviceType} className="size-3 shrink-0" />}
          tooltip={t('tooltips.device', { value: deviceTypeLabel(t, origin.deviceType) })}
        />
      )}

      {place && (
        <Chip
          icon={<CountryFlag code={origin.country} width={14} />}
          label={place}
          tooltip={t('tooltips.location', { value: place })}
        />
      )}

      {origin.inferred && (
        <Chip
          icon={<span className="text-[10px]">≈</span>}
          tooltip={t('origin.inferredHint')}
        />
      )}
    </span>
  );
}

/** Bloco completo, para o painel de detalhe de um evento. */
export function ClientOriginDetails({
  origin,
  t,
}: {
  origin: ClientOriginData | null | undefined;
  t: Translate;
}) {
  if (!origin) return null;

  const resolution =
    origin.screenWidth && origin.screenHeight
      ? `${origin.screenWidth} × ${origin.screenHeight}`
      : null;

  const rows: Array<{ key: string; value: ReactNode }> = [];

  const push = (key: string, value: ReactNode) => {
    if (value !== null && value !== undefined && value !== '') rows.push({ key, value });
  };

  push(
    'platform',
    origin.clientKind && origin.clientKind !== 'unknown' ? (
      <span className="flex items-center gap-1.5">
        {origin.clientKind === 'web' ? (
          <BrowserIcon name={origin.browser} size={13} />
        ) : (
          <PlatformLogo kind={origin.clientKind} size={13} />
        )}
        {appLabel(t, origin) ?? t(`platform.${origin.clientKind}`)}
      </span>
    ) : null,
  );
  push(
    'browser',
    origin.browser ? (
      <span className="flex items-center gap-1.5">
        <BrowserIcon name={origin.browser} size={13} />
        {nameWithVersion(origin.browser, origin.browserVersion)}
      </span>
    ) : null,
  );
  push(
    'os',
    origin.os ? (
      <span className="flex items-center gap-1.5">
        <OsIcon name={origin.os} size={13} />
        {nameWithVersion(origin.os, origin.osVersion)}
      </span>
    ) : null,
  );
  push(
    'device',
    origin.deviceType ? (
      <span className="flex items-center gap-1.5">
        <DeviceTypeIcon type={origin.deviceType} className="size-3.5" />
        {deviceTypeLabel(t, origin.deviceType)}
      </span>
    ) : null,
  );
  push('resolution', resolution);
  push(
    'location',
    origin.city || origin.country ? (
      <span className="flex items-center gap-1.5">
        <CountryFlag code={origin.country} width={16} />
        {[origin.city, origin.country].filter(Boolean).join(', ')}
      </span>
    ) : null,
  );
  push('ip', origin.ip ? <span className="font-mono text-xs">{origin.ip}</span> : null);

  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-muted-foreground flex items-center gap-2 text-xs font-medium tracking-wide uppercase">
        {t('origin.title')}
        {origin.inferred && (
          <span className="normal-case opacity-70">· {t('origin.inferred')}</span>
        )}
      </p>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        {rows.map((row) => (
          <div key={row.key} className="rounded-lg border p-3">
            <dt className="text-muted-foreground text-xs">{t(`origin.fields.${row.key}`)}</dt>
            <dd className="font-medium">{row.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
