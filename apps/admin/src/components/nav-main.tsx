'use client';

import { ChevronRight } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Skeleton } from '@/components/ui/skeleton';
import { Menu } from '@hed-hog/api-types';
import { useApp, useQuery } from '@hed-hog/next-app-provider';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavMain() {
  const { request, accessToken, currentLocaleCode } = useApp();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const pathname = usePathname();

  const STORAGE_KEY = 'hedhog:nav:expandedMenus';

  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>(
    () => {
      try {
        const raw = sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
  );

  const getSidebarScrollable = useCallback((): HTMLElement | null => {
    // This callback only ever runs from browser event handlers (collapsible
    // toggle / dropdown click) on an already-mounted 'use client' component,
    // so `document` is always defined; this is a defensive SSR-style guard.
    /* v8 ignore next */
    if (typeof document === 'undefined') return null;

    const sidebar = document.querySelector('[data-slot="sidebar"]');
    if (!sidebar) return null;

    return (
      (sidebar.querySelector(
        '[data-slot="sidebar-content"]'
      ) as HTMLElement | null) || (sidebar as HTMLElement)
    );
  }, []);

  const preserveScrollOnToggle = useCallback(
    (fn: () => void) => {
      const container = getSidebarScrollable();
      const previousScrollTop = container?.scrollTop ?? 0;

      fn();

      requestAnimationFrame(() => {
        if (container) {
          container.scrollTop = previousScrollTop;
        }
      });
    },
    [getSidebarScrollable]
  );

  const closeOnNavigate = useCallback(() => {
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMobile, setOpenMobile]);

  const setExpandedFor = useCallback((slug: string, value: boolean) => {
    setExpandedMap((prev) => {
      const next = { ...prev, [slug]: value };
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (state === 'collapsed') {
      setExpandedMap({});
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify({}));
      } catch {}
    }
  }, [state]);

  const { data: menus, isLoading: isLoadingMenus } = useQuery({
    queryKey: ['menus', currentLocaleCode],
    queryFn: async () => {
      const { data } = await request<Menu[]>({ url: '/menu/system' });
      return data;
    },
    enabled: accessToken !== null,
  });

  function MenuItemRecursive({
    item,
    isSubItem = false,
  }: {
    item: Menu;
    isSubItem?: boolean;
  }) {
    const hasChildren = Array.isArray(item.menu) && item.menu.length > 0;

    const renderIcon = (icon: string) => {
      try {
        const iconName = icon
          .split('-')
          .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { [iconName]: DynamicLucideIcon } = require('lucide-react');
        return DynamicLucideIcon ? (
          <DynamicLucideIcon className="h-4 w-4 text-current" />
        ) : null;
        // `icon` is always a non-empty string here (guarded by `item.icon &&`
        // at the call site), so `.split/.map/.join` never throws; this catch
        // only guards against a hypothetical failure of the dynamic
        // `require('lucide-react')` lookup and is otherwise unreachable.
        /* v8 ignore next 3 */
      } catch {
        return null;
      }
    };

    // When the sidebar is collapsed and there are submenus, show dropdown
    if (state === 'collapsed' && hasChildren) {
      return (
        <SidebarMenuItem key={item.slug}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                tooltip={item.name}
                className={
                  // Inside this `if (state === 'collapsed' && ...)` branch,
                  // `state === 'collapsed'` is always true, so the `:`
                  // alternative below is unreachable dead code.
                  /* v8 ignore next 3 */
                  state === 'collapsed'
                    ? 'justify-center hover:bg-accent cursor-pointer mx-2'
                    : 'hover:bg-accent cursor-pointer'
                }
              >
                {item.icon && renderIcon(item.icon)}
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              {Array.isArray(item.menu) &&
                item.menu.map((subItem: Menu) => (
                  <DropdownMenuItemRecursive
                    key={subItem.slug}
                    item={subItem}
                  />
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      );
    }

    if (hasChildren) {
      const open = Boolean(expandedMap[item.slug]);

      return (
        <Collapsible
          key={item.slug}
          asChild
          className="group/collapsible"
          open={open}
          onOpenChange={(v: boolean) =>
            preserveScrollOnToggle(() => setExpandedFor(item.slug, v))
          }
        >
          <SidebarMenuItem>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                tooltip={item.name}
                className={
                  // Reaching this branch means `hasChildren` is true and the
                  // earlier `if (state === 'collapsed' && hasChildren)` guard
                  // above did NOT return, so `state !== 'collapsed'` is
                  // guaranteed here; the `?` alternative is unreachable.
                  /* v8 ignore next 3 */
                  state === 'collapsed'
                    ? 'justify-center hover:bg-accent px-2 mx-2'
                    : 'hover:bg-accent px-2'
                }
              >
                {item.icon && renderIcon(item.icon)}
                {state !== 'collapsed' && <span>{item.name}</span>}
                {state !== 'collapsed' && (
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {Array.isArray(item.menu) &&
                  item.menu.map((subItem: Menu) => (
                    <MenuItemRecursive
                      key={subItem.slug}
                      item={subItem}
                      isSubItem={true}
                    />
                  ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      );
    }

    if (isSubItem) {
      const isActive = pathname === item.url;
      return (
        <SidebarMenuSubItem key={item.slug}>
          <SidebarMenuSubButton
            asChild
            className={
              // `isSubItem` is only ever set to `true` by the recursive call
              // inside the `hasChildren` branch above, which (per the
              // comment there) only renders when `state !== 'collapsed'`;
              // the collapsed alternative here is unreachable.
              /* v8 ignore next 3 */
              state === 'collapsed'
                ? 'justify-center hover:bg-accent mx-2'
                : 'hover:bg-accent'
            }
          >
            <Link
              href={String(item.url)}
              className={isActive ? 'text-primary font-medium px-2' : 'px-2'}
              onClick={closeOnNavigate}
            >
              {item.icon && renderIcon(item.icon)}
              {/* Same reasoning as above: state is never 'collapsed' when isSubItem is true. */}
              {/* v8 ignore next */}
              {state !== 'collapsed' && <span>{item.name}</span>}
            </Link>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      );
    }

    const isActive = pathname === item.url;
    return (
      <SidebarMenuItem key={item.slug}>
        <SidebarMenuButton
          asChild
          tooltip={item.name}
          className={
            state === 'collapsed'
              ? 'justify-center hover:bg-accent mx-2'
              : 'hover:bg-accent'
          }
        >
          <Link
            href={String(item.url)}
            className={isActive ? 'text-primary font-medium px-2' : 'px-2'}
            onClick={closeOnNavigate}
          >
            {item.icon && renderIcon(item.icon)}
            {state !== 'collapsed' && <span>{item.name}</span>}
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  function DropdownMenuItemRecursive({ item }: { item: Menu }) {
    const hasChildren = Array.isArray(item.menu) && item.menu.length > 0;

    const renderIcon = (icon: string) => {
      try {
        const iconName = icon
          .split('-')
          .map((part: string) => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { [iconName]: DynamicLucideIcon } = require('lucide-react');
        return DynamicLucideIcon ? (
          <DynamicLucideIcon className="h-4 w-4 text-current" />
        ) : null;
        // Same reasoning as the other `renderIcon` above: `.split/.map/.join`
        // on a guaranteed non-empty string never throws, so this only guards
        // a hypothetical failure of the dynamic require() and is otherwise
        // unreachable.
        /* v8 ignore next 3 */
      } catch {
        return null;
      }
    };

    if (hasChildren) {
      return (
        <div key={item.slug} className="relative">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex w-full items-center justify-between px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer"
                onClick={() => preserveScrollOnToggle(() => {})}
              >
                <div className="flex items-center gap-2">
                  {item.icon && renderIcon(item.icon)}
                  <span className="text-sm">{item.name}</span>
                </div>
                <ChevronRight className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start">
              {Array.isArray(item.menu) &&
                item.menu.map((subItem: Menu) => (
                  <DropdownMenuItemRecursive
                    key={subItem.slug}
                    item={subItem}
                  />
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      );
    }

    const isActive = pathname === item.url;
    return (
      <DropdownMenuItem key={item.slug} asChild>
        <Link
          href={String(item.url)}
          className={`flex items-center gap-2 cursor-pointer ${isActive ? 'text-primary font-medium' : ''}`}
          onClick={closeOnNavigate}
        >
          {item.icon && renderIcon(item.icon)}
          <span>{item.name}</span>
        </Link>
      </DropdownMenuItem>
    );
  }

  function MenuLoadingSkeleton() {
    return (
      <SidebarMenu>
        {Array.from({ length: 8 }).map((_, index) => (
          <SidebarMenuItem key={`menu-skeleton-${index}`}>
            <SidebarMenuButton
              className={state === 'collapsed' ? 'justify-center mx-2' : ''}
              disabled
            >
              {state === 'collapsed' ? (
                <Skeleton className="h-4 w-4 rounded-sm" />
              ) : (
                <div className="flex w-full items-center gap-2 px-2">
                  <Skeleton className="h-4 w-4 rounded-sm" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    );
  }

  return (
    <SidebarGroup className="p-0">
      {isLoadingMenus ? (
        <MenuLoadingSkeleton />
      ) : (
        <SidebarMenu>
          {menus?.map((item) => (
            <MenuItemRecursive key={item.slug} item={item} />
          ))}
        </SidebarMenu>
      )}
    </SidebarGroup>
  );
}
