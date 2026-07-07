'use client';

import * as React from 'react';

import { openMcpFloatingChat } from '@/components/mcp-floating-chat';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
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
import { Bot } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter();
  const { getSettingValue } = useApp();
  const { state, isMobile, setOpenMobile } = useSidebar();
  const t = useTranslations('core.McpFloatingChat');
  const systemName = getSettingValue('system-name') || 'HedHog';
  const systemSlogan = getSettingValue('system-slogan') || 'Admin Panel';
  const systemLogo =
    getSettingValue('image-url') || getSettingValue('icon-url') || '/logo.svg';
  const isMcpEnabled = getSettingValue('mcp-enabled') !== false;

  const menuWidth = getSettingValue('menu-width')
    ? `${getSettingValue('menu-width')}rem`
    : undefined;

  const handleOpenMcpChat = React.useCallback(() => {
    // The only element that invokes this handler (the MCP button below) is
    // itself rendered inside an `{isMcpEnabled && (...)}` block, so this
    // callback can never actually run while `isMcpEnabled` is false.
    /* v8 ignore next */
    if (!isMcpEnabled) return;
    openMcpFloatingChat();
    if (isMobile) {
      setOpenMobile(false);
    }
  }, [isMcpEnabled, isMobile, setOpenMobile]);

  const mobileMcpLabel = t('openChat').replace(/\s*\([^)]*\)\s*$/, '');

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
        {isMcpEnabled && (
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                className={`cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground${state !== 'collapsed' ? ' px-3' : ' justify-center'}`}
                onClick={handleOpenMcpChat}
              >
                <Bot className="size-4" />
                {state !== 'collapsed' && <span>{mobileMcpLabel}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        )}
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
