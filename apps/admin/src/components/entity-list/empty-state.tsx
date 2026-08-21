import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ReactNode } from 'react';

export type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionIcon?: ReactNode;
  className?: string;
};

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  actionIcon,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-slate-300 px-6 py-12 text-center',
        className
      )}
    >
      <div className="flex flex-col items-center space-y-4">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <h3 className="text-lg font-semibold">{title}</h3>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>
        {actionLabel && onAction && (
          <Button onClick={onAction}>
            {actionIcon}
            {actionLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
