import {
  Breadcrumb,
  BreadcrumbEllipsis,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useIsMobile } from '@/hooks/use-mobile';
import { MoreVertical } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Fragment, ReactNode } from 'react';

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

export type PageHeaderAction = {
  label: string;
  onClick: () => void;
  variant?:
    | 'default'
    | 'outline'
    | 'secondary'
    | 'ghost'
    | 'link'
    | 'destructive';
  icon?: ReactNode;
  size?:
    | 'default'
    | 'sm'
    | 'lg'
    | 'icon'
    | 'icon-sm'
    | 'icon-lg'
    | null
    | undefined;
  disabled?: boolean;
  iconOnly?: boolean;
  ariaLabel?: string;
};

export type PageHeaderProps = {
  breadcrumbs: BreadcrumbItem[];
  actions?: PageHeaderAction[] | ReactNode;
  icon?: ReactNode;
  title?: string | ReactNode;
  description?: string;
  extraContent?: ReactNode;
};

export function PageHeader({
  breadcrumbs,
  actions = [],
  title,
  description,
  extraContent,
}: PageHeaderProps) {
  const isMobile = useIsMobile();
  const t = useTranslations('core.PageHeader');
  const actionItems = Array.isArray(actions) ? actions : [];

  const homeBreadcrumb = breadcrumbs[0];
  const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
  const middleBreadcrumbs = breadcrumbs.slice(1, -1);

  const renderDesktopAction = (action: PageHeaderAction, index: number) => {
    const actionLabel = action.ariaLabel || action.label;
    const button = (
      <Button
        key={index}
        variant={action.variant || 'default'}
        onClick={action.onClick}
        size={action.size || (action.iconOnly ? 'icon-sm' : 'default')}
        disabled={action.disabled}
        aria-label={actionLabel}
        title={action.iconOnly ? actionLabel : undefined}
      >
        {action.icon && (
          <span className={action.iconOnly ? '' : 'mr-2'}>{action.icon}</span>
        )}
        {!action.iconOnly && action.label}
      </Button>
    );

    if (!action.iconOnly) {
      return button;
    }

    return (
      <TooltipProvider key={index}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="bottom">{actionLabel}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <header>
      <div className="flex items-center justify-between gap-2 border-b py-2">
        <div className="flex min-w-0 items-center gap-2 sm:space-x-4">
          <SidebarTrigger className="-ml-1" />
          <Breadcrumb className="min-w-0">
            <BreadcrumbList className="min-w-0 flex-nowrap overflow-hidden">
              {isMobile && breadcrumbs.length > 1 ? (
                <>
                  <BreadcrumbItem className="min-w-0 shrink">
                    {homeBreadcrumb?.href ? (
                      <BreadcrumbLink
                        asChild
                        className="block max-w-26 truncate"
                      >
                        <Link href={homeBreadcrumb.href}>
                          {homeBreadcrumb.label}
                        </Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage className="block max-w-26 truncate">
                        {homeBreadcrumb?.label}
                      </BreadcrumbPage>
                    )}
                  </BreadcrumbItem>

                  {middleBreadcrumbs.length > 0 && (
                    <>
                      <BreadcrumbSeparator />
                      <BreadcrumbItem>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              aria-label={t('openBreadcrumbLevels')}
                            >
                              <BreadcrumbEllipsis className="size-7" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="start"
                            className="max-w-64"
                          >
                            {middleBreadcrumbs.map((item, index) => (
                              <DropdownMenuItem
                                key={`${item.label}-${index}`}
                                asChild
                              >
                                {item.href ? (
                                  <Link href={item.href}>{item.label}</Link>
                                ) : (
                                  <span>{item.label}</span>
                                )}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </BreadcrumbItem>
                    </>
                  )}

                  <BreadcrumbSeparator />
                  <BreadcrumbItem className="min-w-0 shrink">
                    <BreadcrumbPage className="block max-w-38 truncate">
                      {currentBreadcrumb?.label}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                </>
              ) : (
                breadcrumbs.map((item, index) => (
                  <Fragment key={`${item.label}-${index}`}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem className="min-w-0">
                      {item.href ? (
                        <BreadcrumbLink asChild className="max-w-56 truncate">
                          <Link href={item.href}>{item.label}</Link>
                        </BreadcrumbLink>
                      ) : (
                        <BreadcrumbPage className="max-w-56 truncate">
                          {item.label}
                        </BreadcrumbPage>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))
              )}
            </BreadcrumbList>
          </Breadcrumb>
        </div>
        <div className="min-h-8 shrink-0">
          {Array.isArray(actions) ? (
            actionItems.length > 0 &&
            (isMobile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t('openActionsMenu')}
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {actionItems.map((action, index) => (
                    <DropdownMenuItem
                      key={`${action.label}-${index}`}
                      onClick={action.onClick}
                      disabled={action.disabled}
                    >
                      {action.icon && (
                        <span className="mr-2">{action.icon}</span>
                      )}
                      <span>{action.label}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex gap-2">
                {actionItems.map(renderDesktopAction)}
              </div>
            ))
          ) : (
            <>{actions}</>
          )}
        </div>
      </div>
      {(title || description) && (
        <div className="flex items-center justify-between">
          <div className="py-2">
            {title && <h1 className="text-2xl font-bold">{title}</h1>}
            {description && (
              <p className="text-muted-foreground text-sm">{description}</p>
            )}
          </div>
          <div className="py-2">{extraContent}</div>
        </div>
      )}
    </header>
  );
}
