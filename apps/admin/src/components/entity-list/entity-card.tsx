'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ReactNode } from 'react';

export interface EntityCardProps {
  avatar?: {
    src?: string;
    fallback: string;
  };
  title: string;
  description?: string;
  badges?: Array<{
    label: string;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
  }>;
  metadata?: Array<{
    label: string;
    value: string;
    icon?: ReactNode;
  }>;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'ghost';
    icon?: ReactNode;
  }>;
  onClick?: () => void;
}

export function EntityCard({
  avatar,
  title,
  description,
  badges,
  metadata,
  actions,
  onClick,
}: EntityCardProps) {
  return (
    <Card
      className={`overflow-hidden transition-all hover:shadow-md ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {avatar && (
            <Avatar className="h-12 w-12 shrink-0">
              <AvatarImage src={avatar.src} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {avatar.fallback}
              </AvatarFallback>
            </Avatar>
          )}
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium leading-none">{title}</h3>
                {description && (
                  <p className="text-muted-foreground mt-1 text-sm">
                    {description}
                  </p>
                )}
              </div>
              {badges && badges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {badges.map((badge, index) => (
                    <Badge key={index} variant={badge.variant || 'default'}>
                      {badge.label}
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {metadata && metadata.length > 0 && (
              <div className="space-y-1">
                {metadata.map((item, index) => (
                  <div
                    key={index}
                    className="text-muted-foreground flex items-center gap-2 text-xs"
                  >
                    {item.icon && <span className="h-3 w-3">{item.icon}</span>}
                    <span className="font-medium">{item.label}:</span>
                    <span>{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            {actions && actions.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {actions.map((action, index) => (
                  <Button
                    key={index}
                    variant={action.variant || 'outline'}
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      action.onClick();
                    }}
                  >
                    {action.icon && <span className="mr-1">{action.icon}</span>}
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
