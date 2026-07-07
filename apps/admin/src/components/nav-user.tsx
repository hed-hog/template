'use client';

import { BadgeCheck, ChevronsUpDown, LogOut, Settings } from 'lucide-react';
import {
  NotificationBell,
  useNotifications,
} from '@/components/notification-bell';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useApp } from '@hed-hog/next-app-provider';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

export function NavUser() {
  const { isMobile, state } = useSidebar();
  const { user, userEmail, userPhotoUrl, userAbbr, logout } = useApp();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const t = useTranslations('core.NavUser');
  const notifications = useNotifications();

  const onClickLogOut = () => {
    setIsLoggingOut(true);
    logout().finally(() => setIsLoggingOut(false));
  };

  const collapsed = state === 'collapsed';

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <SidebarMenuButton
                size="lg"
                className="data-[state=open]:bg-card-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
              >
                {/* Avatar with unread dot when collapsed */}
                <div className="relative">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={userPhotoUrl} alt={user?.name} />
                    <AvatarFallback className="rounded-lg">
                      {userAbbr}
                    </AvatarFallback>
                  </Avatar>
                  {collapsed && notifications.unreadCount > 0 && (
                    <span className="bg-primary absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-sidebar" />
                  )}
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user?.name}</span>
                  <span className="truncate text-xs">{userEmail}</span>
                </div>
                <ChevronsUpDown className="ml-auto size-4" />
              </SidebarMenuButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
              side={isMobile ? 'bottom' : 'right'}
              align="end"
              sideOffset={4}
            >
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar className="h-8 w-8 rounded-lg">
                    <AvatarImage src={userPhotoUrl} alt={user?.name} />
                    <AvatarFallback className="rounded-lg">
                      {userAbbr}
                    </AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{user?.name}</span>
                    <span className="truncate text-xs">{userEmail}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem asChild>
                  <Link href="/core/account" className="cursor-pointer">
                    <BadgeCheck />
                    {t('account')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/core/preferences" className="cursor-pointer">
                    <Settings />
                    {t('preferences')}
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onClickLogOut}
                disabled={isLoggingOut}
                className="cursor-pointer"
              >
                <LogOut />
                {t('logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {!collapsed && (
            <NotificationBell state={notifications} isMobile={isMobile} />
          )}
        </div>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
