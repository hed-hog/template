'use client';

import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { cn } from '@/lib/utils';
import { Bug, LifeBuoy, Lightbulb, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  PROPOSE_IMPROVEMENT_EVENT,
  REPORT_BUG_EVENT,
  SCREENSHOT_IGNORE_ATTR,
  SUPPORT_CAPTURING_EVENT,
  SUPPORT_PAGE,
  useSupportStatus,
} from './support-client';
import type { SupportFlow } from './support-sheets';

/**
 * "Reportar erro", "Propor melhoria" e o atalho para Suporte e Melhorias, no
 * rodapé da barra lateral. Os dois primeiros só disparam o evento: print e
 * sheet ficam no `SupportSheets` do layout, que sobrevive à barra mobile fechar.
 * Os dois dividem uma linha meio a meio; com a barra recolhida, empilham e mostram
 * só o ícone, como os itens do `NavMain`.
 *
 * O bloco inteiro some quando não há suporte: em projeto sem a Fábrica de
 * Software (a consulta de status falha) e com o suporte indisponível (token
 * ausente ou inválido nas settings do grupo `factory`, ou suporte suspenso
 * pela Hcode).
 */
export function SupportSidebarActions() {
  const t = useTranslations('core.Support');
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSupportStatus();
  const { isMobile, setOpenMobile, state } = useSidebar();
  const collapsed = state === 'collapsed' && !isMobile;
  const [capturing, setCapturing] = useState<SupportFlow | null>(null);

  useEffect(() => {
    const handler = (event: Event) =>
      setCapturing((event as CustomEvent<SupportFlow | null>).detail);
    window.addEventListener(SUPPORT_CAPTURING_EVENT, handler);
    return () => window.removeEventListener(SUPPORT_CAPTURING_EVENT, handler);
  }, []);

  if (!status?.available) return null;

  const item = (flow: SupportFlow, label: string, Icon: typeof Bug) => (
    <SidebarMenuButton
      className={cn(
        'min-w-0 flex-1 cursor-pointer group-data-[collapsible=icon]:flex-none',
        collapsed && 'justify-center'
      )}
      tooltip={label}
      onClick={() =>
        window.dispatchEvent(
          new CustomEvent(flow === 'bug' ? REPORT_BUG_EVENT : PROPOSE_IMPROVEMENT_EVENT)
        )
      }
    >
      {capturing === flow ? <Loader2 className="animate-spin" /> : <Icon />}
      {!collapsed && (
        <span className="truncate">{capturing === flow ? t('capturing') : label}</span>
      )}
    </SidebarMenuButton>
  );

  return (
    <SidebarMenu {...{ [SCREENSHOT_IGNORE_ATTR]: '' }}>
      <SidebarMenuItem className="flex gap-1 group-data-[collapsible=icon]:flex-col">
        {item('bug', t('reportBug'), Bug)}
        {item('improvement', t('proposeImprovement'), Lightbulb)}
      </SidebarMenuItem>
      <SidebarMenuItem>
        <SidebarMenuButton
          className={cn('cursor-pointer', collapsed && 'justify-center')}
          isActive={pathname?.startsWith(SUPPORT_PAGE)}
          tooltip={t('supportPage')}
          onClick={() => {
            router.push(SUPPORT_PAGE);
            if (isMobile) setOpenMobile(false);
          }}
        >
          <LifeBuoy />
          {!collapsed && <span>{t('supportPage')}</span>}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
