'use client';

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

export type TagBadgeItem = {
  slug: string;
  color?: string | null;
};

export type TagBadgeListProps = {
  tags: TagBadgeItem[];
  /** Sem `onRemove` a lista e somente leitura (cards e tabela). */
  onRemove?: (slug: string) => void;
  /** Acima disso o excedente vira um "+N" com o resto no tooltip. */
  max?: number;
  /** `md` para campo de formulário; `sm`/`xs` para densidade de listagem. */
  size?: 'md' | 'sm' | 'xs';
  className?: string;
};

/**
 * Lista de tags como badges — a mesma em toda parte onde tags aparecem: nos
 * cards e na tabela (leitura), no filtro ativo e no painel de aplicacao em
 * massa (com remover).
 *
 * O pontinho colorido em vez de tingir o badge inteiro: as cores de `tag.color`
 * saem de uma paleta fixa por hash do slug (`CourseTagService.pickTagColor`),
 * sem garantia de contraste com o texto.
 */
export function TagBadgeList({
  tags,
  onRemove,
  max,
  size = 'sm',
  className,
}: TagBadgeListProps) {
  if (tags.length === 0) return null;

  const visible = max != null ? tags.slice(0, max) : tags;
  const hidden = max != null ? tags.slice(max) : [];

  const badgeSize =
    size === 'xs'
      ? 'h-4 px-1.5 text-[10px]'
      : size === 'md'
        ? 'h-7 gap-1.5 px-2.5 text-xs'
        : 'h-5 px-2 text-[11px]';

  return (
    <div className={cn('flex flex-wrap items-center gap-1', className)}>
      {visible.map((tag) => (
        <Badge
          key={tag.slug}
          variant="secondary"
          className={cn('max-w-40 gap-1 font-normal', badgeSize)}
        >
          {tag.color ? (
            <span
              className="inline-block size-1.5 shrink-0 rounded-full"
              style={{ backgroundColor: tag.color }}
            />
          ) : null}
          <span className="truncate">{tag.slug}</span>
          {onRemove ? (
            <button
              type="button"
              aria-label={tag.slug}
              className="-mr-0.5 shrink-0 cursor-pointer rounded-full opacity-60 transition-opacity hover:opacity-100"
              onClick={(event) => {
                event.stopPropagation();
                onRemove(tag.slug);
              }}
            >
              <X className={size === 'md' ? 'size-3' : 'size-2.5'} />
            </button>
          ) : null}
        </Badge>
      ))}

      {hidden.length > 0 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className={cn('font-normal', badgeSize)}
              >
                +{hidden.length}
              </Badge>
            </TooltipTrigger>
            <TooltipContent>
              {hidden.map((tag) => tag.slug).join(', ')}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  );
}
