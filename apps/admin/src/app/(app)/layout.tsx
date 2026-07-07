import { AppSidebar } from '@/components/app-sidebar';
import { MaintenanceAlertBanner } from '@/components/maintenance/maintenance-alert-banner';
import { McpFloatingChat } from '@/components/mcp-floating-chat';
import { GuardPage } from '@/components/page/guard-page';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { cookies } from 'next/headers';
import { ReactNode } from 'react';

type LayoutProps = {
  children: ReactNode;
};

export default async function Layout({ children }: LayoutProps) {
  const cookieStore = await cookies();
  const sidebarState = cookieStore.get('sidebar_state')?.value;
  const defaultOpen = sidebarState !== 'false';

  return (
    <GuardPage>
      <SidebarProvider defaultOpen={defaultOpen}>
        <AppSidebar />
        <SidebarInset>
          <MaintenanceAlertBanner />
          {children}
        </SidebarInset>
        <McpFloatingChat />
      </SidebarProvider>
    </GuardPage>
  );
}
