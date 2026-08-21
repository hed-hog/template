'use client';

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { PresenceStatus } from './use-presence';

const AWAY = new Set(['Away', 'BeRightBack', 'AwayIdle']);
const BUSY = new Set(['Busy', 'DoNotDisturb', 'BusyIdle', 'InAMeeting', 'Presenting']);

function colorFor(status?: PresenceStatus): string {
  if (!status?.online) return 'bg-muted-foreground/40';
  const av = status.teamsAvailability ?? '';
  if (BUSY.has(av)) return 'bg-rose-500';
  if (AWAY.has(av)) return 'bg-amber-500';
  return 'bg-emerald-500';
}

function labelFor(status?: PresenceStatus): string {
  if (!status?.online) return 'Offline';
  const parts: string[] = [];
  if (status.appOnline) parts.push('ativo no app');
  if (status.teamsOnline) {
    parts.push(
      status.teamsAvailability
        ? `Teams: ${status.teamsAvailability}`
        : 'presente no Teams',
    );
  }
  return parts.length ? `Online — ${parts.join(' · ')}` : 'Online';
}

/**
 * Small presence indicator: a colored dot reflecting the combined online status
 * (app heartbeat merged with Teams presence). Green = online, amber = away,
 * red = busy, gray = offline. Reusable across collaborator, user list, etc.
 */
export function PresenceDot({
  status,
  className,
  showRing = true,
}: {
  status?: PresenceStatus;
  className?: string;
  showRing?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            'inline-block size-2.5 shrink-0 rounded-full',
            colorFor(status),
            showRing && 'ring-2 ring-background',
            className,
          )}
          aria-label={labelFor(status)}
        />
      </TooltipTrigger>
      <TooltipContent>{labelFor(status)}</TooltipContent>
    </Tooltip>
  );
}
