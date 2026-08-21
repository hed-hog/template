'use client';

import type { LucideIcon } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

/**
 * Resolução de ícone lucide a partir de um nome kebab-case — o mesmo formato
 * que `menu.yaml` já guarda e que o dashboard usa. A leitura é no barrel do
 * `lucide-react` (que o admin já importa), e não no `lucide-react/dynamic`:
 * a lista abaixo é curada, então não vale pagar lazy-import de ~1500 ícones.
 */

/** Normaliza qualquer grafia (`KeyRound`, `key_round`, `Key Round`) em kebab-case. */
export function normalizeIconSlug(value: string): string {
  return value
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/([a-zA-Z])(\d)/g, '$1-$2')
    .replace(/(\d)([a-zA-Z])/g, '$1-$2')
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.toLowerCase())
    .join('-');
}

function toComponentName(value: string): string {
  return normalizeIconSlug(value)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function isLucideIconComponent(candidate: unknown): candidate is LucideIcon {
  return (
    candidate !== null &&
    candidate !== undefined &&
    (typeof candidate === 'function' || typeof candidate === 'object')
  );
}

/** Componente do ícone, ou `null` quando o nome não existe no lucide. */
export function resolveLucideIcon(slug?: string | null): LucideIcon | null {
  const componentName = slug ? toComponentName(slug) : '';
  const candidate = componentName
    ? LucideIcons[componentName as keyof typeof LucideIcons]
    : undefined;

  return isLucideIconComponent(candidate) ? (candidate as LucideIcon) : null;
}

export function isValidIconSlug(slug: string): boolean {
  return resolveLucideIcon(slug) !== null;
}

/**
 * Conjunto curado de ícones oferecidos nos seletores. Parte das sugestões do
 * dashboard e acrescenta ícones de segurança, infraestrutura e negócio (úteis
 * para nomear cofres).
 */
export const ICON_OPTIONS: string[] = [
  // Segurança e credenciais
  'shield',
  'shield-check',
  'shield-alert',
  'lock',
  'lock-keyhole',
  'unlock',
  'key',
  'key-round',
  'key-square',
  'fingerprint',
  'scan-face',
  'eye-off',
  'vault',
  'id-card',
  'badge-check',
  // Negócio e finanças
  'briefcase',
  'building-2',
  'landmark',
  'store',
  'wallet',
  'banknote',
  'credit-card',
  'circle-dollar-sign',
  'badge-dollar-sign',
  'hand-coins',
  'receipt',
  'shopping-cart',
  'package',
  'truck',
  'factory',
  // Pessoas e comunicação
  'users',
  'user-round',
  'contact-round',
  'handshake',
  'mail',
  'message-square',
  'phone',
  'send',
  'inbox',
  'megaphone',
  'bell',
  // Infraestrutura e desenvolvimento
  'server',
  'database',
  'hard-drive',
  'cloud',
  'network',
  'wifi',
  'router',
  'terminal',
  'code',
  'file-code-2',
  'git-branch',
  'bug',
  'cpu',
  'monitor',
  'smartphone',
  'tablet',
  'plug',
  'wrench',
  'settings-2',
  'sliders-horizontal',
  // Documentos e organização
  'folder',
  'folder-open',
  'folder-kanban',
  'folder-lock',
  'file-text',
  'files',
  'notebook-text',
  'clipboard-list',
  'archive',
  'book-open',
  'book-marked',
  'library',
  'bookmark',
  'tags',
  'hash',
  'ticket',
  'stamp',
  'scale',
  'gavel',
  // Dados e métricas
  'layout-dashboard',
  'chart-column',
  'chart-line',
  'chart-no-axes-combined',
  'pie-chart',
  'trending-up',
  'activity',
  'target',
  'gauge',
  'list',
  'layout-grid',
  'kanban',
  // Tempo e lugar
  'calendar',
  'calendar-days',
  'clock-3',
  'timer',
  'hourglass',
  'globe',
  'map-pinned',
  'navigation',
  'compass',
  'plane',
  'car',
  'home',
  'house',
  // Diversos
  'zap',
  'flame',
  'star',
  'heart',
  'thumbs-up',
  'rocket',
  'sparkles',
  'palette',
  'camera',
  'image',
  'video',
  'music',
  'headphones',
  'mic',
  'gift',
  'graduation-cap',
  'stethoscope',
  'leaf',
  'sun',
  'moon',
  'circle-help',
  'info',
  'alert-triangle',
  'check-circle-2',
];

/** Renderiza um ícone pelo nome, caindo em `fallback` quando o nome não resolve. */
export function LucideIconByName({
  name,
  fallback: Fallback,
  className,
}: {
  name?: string | null;
  fallback: LucideIcon;
  className?: string;
}) {
  // `resolveLucideIcon` devolve uma referência estável do barrel do lucide, não
  // um componente novo a cada render — o lint não consegue enxergar isso.
  const Icon = resolveLucideIcon(name) ?? Fallback;
  // eslint-disable-next-line react-hooks/static-components
  return <Icon className={className} />;
}
