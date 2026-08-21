'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

export interface PaginationFooterProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: readonly number[];
  selectedCount?: number;
}

export function PaginationFooter({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [6, 12, 24, 48, 96],
  selectedCount = 0,
}: PaginationFooterProps) {
  const t = useTranslations('core.PaginationFooter');
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  const canPreviousPage = safeCurrentPage > 1;
  const canNextPage = safeCurrentPage < totalPages;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-1 pt-4">
      <div className="text-muted-foreground hidden flex-1 text-sm lg:flex">
        {selectedCount > 0
          ? t('selectedItems', { count: selectedCount, total: totalItems })
          : t('totalItems', { total: totalItems })}
      </div>
      <div className="flex w-full flex-wrap items-center gap-4 sm:gap-8 lg:w-fit">
        <div className="hidden items-center gap-2 lg:flex">
          <Label htmlFor="rows-per-page" className="text-sm font-medium">
            {t('itemsPerPage')}
          </Label>
          <select
            id="rows-per-page"
            className="border-input bg-background text-foreground h-9 w-20 rounded-md border px-2 text-sm outline-none"
            value={`${pageSize}`}
            onChange={(event) => {
              const nextPageSize = Number(event.target.value);

              if (!Number.isFinite(nextPageSize) || nextPageSize === pageSize) {
                return;
              }

              onPageSizeChange(nextPageSize);
            }}
          >
            {pageSizeOptions.map((option) => (
              <option key={option} value={`${option}`}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div className="flex w-fit items-center justify-center text-sm font-medium">
          {t('page')} {safeCurrentPage} {t('of')} {totalPages}
        </div>
        <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="hidden lg:flex"
                onClick={() => onPageChange(1)}
                disabled={!canPreviousPage}
              >
                <span className="sr-only">{t('goToFirstPage')}</span>
                <ChevronsLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('goToFirstPage')}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(safeCurrentPage - 1)}
                disabled={!canPreviousPage}
              >
                <span className="sr-only">{t('goToPreviousPage')}</span>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('goToPreviousPage')}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                onClick={() => onPageChange(safeCurrentPage + 1)}
                disabled={!canNextPage}
              >
                <span className="sr-only">{t('goToNextPage')}</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('goToNextPage')}</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="hidden lg:flex"
                onClick={() => onPageChange(totalPages)}
                disabled={!canNextPage}
              >
                <span className="sr-only">{t('goToLastPage')}</span>
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('goToLastPage')}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
