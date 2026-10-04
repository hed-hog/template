'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type IconAction = {
  key: string;
  label: ReactNode;
  icon: ReactNode;
  /** Pode retornar Promise: o Button mostra o spinner sozinho até ela resolver. */
  onClick: () => void | Promise<void>;
  destructive?: boolean;
  disabled?: boolean;
  /** Força o estado de carregando quando a assincronia não passa pelo onClick. */
  loading?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
};

type IconActionGroupProps = {
  actions: IconAction[];
  className?: string;
  buttonClassName?: string;
};

export function IconActionGroup({
  actions,
  className,
  buttonClassName,
}: IconActionGroupProps) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {actions.map((action) => {
        const labelText =
          typeof action.label === 'string' || typeof action.label === 'number'
            ? String(action.label)
            : action.key;

        return (
          <Button
            key={action.key}
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn(
              action.destructive && 'text-destructive hover:text-destructive',
              buttonClassName
            )}
            onClick={(event) => {
              event.stopPropagation();
              return action.onClick();
            }}
            disabled={action.disabled}
            loading={action.loading}
            aria-label={labelText}
            tooltip={action.label ?? labelText}
            tooltipSide={action.side}
          >
            {action.icon}
            <span className="sr-only">{labelText}</span>
          </Button>
        );
      })}
    </div>
  );
}
