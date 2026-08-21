'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type IconAction = {
  key: string;
  label: ReactNode;
  icon: ReactNode;
  onClick: () => void;
  destructive?: boolean;
  disabled?: boolean;
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
    <TooltipProvider delayDuration={300}>
      <div className={cn('flex items-center gap-1', className)}>
        {actions.map((action) => {
          const labelText =
            typeof action.label === 'string' ||
            typeof action.label === 'number'
              ? String(action.label)
              : action.key;

          return (
            <Tooltip key={action.key}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8',
                    action.destructive &&
                      'text-destructive hover:text-destructive',
                    buttonClassName
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    action.onClick();
                  }}
                  disabled={action.disabled}
                  aria-label={labelText}
                >
                  {action.icon}
                  <span className="sr-only">{labelText}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side={action.side}>
                {action.label ?? labelText}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
