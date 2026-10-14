'use client';

import * as React from 'react';

import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { SupportSidebarActions } from '@/components/support/support-sidebar-actions';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar';
import { useApp } from '@hed-hog/next-app-provider';
import { useRouter } from 'next/navigation';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const { getSettingValue } = useApp();
  const { state } = useSidebar();
  const systemName = getSettingValue('system-name') || 'HedHog';
  const systemSlogan = getSettingValue('system-slogan') || 'Admin Panel';
  const systemLogo =
    getSettingValue('image-url') || getSettingValue('icon-url') || '/logo.svg';

  const menuWidth = getSettingValue('menu-width')
    ? `${getSettingValue('menu-width')}rem`
    : undefined;

  return (
    <Sidebar
      collapsible="icon"
      {...props}
      style={
        menuWidth
          ? { width: state !== 'collapsed' ? menuWidth : '3rem' }
          : undefined
      }
    >
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-card-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
              onClick={() => router.push('/')}
            >
              <div className="text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                <img src={systemLogo} alt={systemName} className="h-10 w-10" />
              </div>
              {state !== 'collapsed' && (
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{systemName}</span>
                  <span className="truncate text-xs">{systemSlogan}</span>
                </div>
              )}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain />
      </SidebarContent>
      <SidebarFooter>
        <SupportSidebarActions />
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
