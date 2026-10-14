'use client';

import { useSidebar } from '@/components/ui/sidebar';
import { useEffect, useRef, useState } from 'react';
import { ProposeImprovementSheet } from './propose-improvement-sheet';
import { ReportBugSheet, SupportContext } from './report-bug-sheet';
import {
  PROPOSE_IMPROVEMENT_EVENT,
  REPORT_BUG_EVENT,
  SUPPORT_CAPTURING_EVENT,
  captureScreen,
  currentScreenContext,
  useSupportStatus,
} from './support-client';

export type SupportFlow = 'bug' | 'improvement';

/** Duração da animação de saída do sheet (`data-[state=closed]:duration-300`). */
const MOBILE_SIDEBAR_CLOSE_MS = 300;

/**
 * Print e sheets do "Reportar erro" e do "Propor melhoria", montados no layout
 * e não dentro da barra lateral: no mobile a barra é um sheet que desmonta ao
 * fechar, e levaria junto o formulário que acabou de abrir.
 *
 * Abre pelos eventos `REPORT_BUG_EVENT` e `PROPOSE_IMPROVEMENT_EVENT` (rodapé da
 * barra e tela de Suporte). O print é tirado ANTES de o sheet abrir — senão ele
 * sairia na imagem por cima da tela que o usuário quer mostrar —, e no mobile
 * depois de a barra terminar de fechar, pelo mesmo motivo.
 */
export function SupportSheets() {
  const { status } = useSupportStatus();
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const [open, setOpen] = useState<SupportFlow | null>(null);
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [context, setContext] = useState<SupportContext>({});
  // Muda a cada abertura e remonta o sheet: formulário limpo, chave nova.
  const [session, setSession] = useState(0);
  const capturing = useRef(false);
  const available = status?.available !== false;

  const announce = (flow: SupportFlow | null) =>
    window.dispatchEvent(new CustomEvent(SUPPORT_CAPTURING_EVENT, { detail: flow }));

  const start = async (flow: SupportFlow) => {
    if (!status || capturing.current || !available) return;
    capturing.current = true;
    announce(flow);
    if (isMobile && openMobile) {
      setOpenMobile(false);
      await new Promise((resolve) => setTimeout(resolve, MOBILE_SIDEBAR_CLOSE_MS));
    }
    setContext(currentScreenContext());
    setScreenshot(await captureScreen());
    capturing.current = false;
    announce(null);
    setSession((value) => value + 1);
    setOpen(flow);
  };

  const startRef = useRef(start);
  useEffect(() => {
    startRef.current = start;
  });
  useEffect(() => {
    const onBug = () => startRef.current('bug');
    const onImprovement = () => startRef.current('improvement');
    window.addEventListener(REPORT_BUG_EVENT, onBug);
    window.addEventListener(PROPOSE_IMPROVEMENT_EVENT, onImprovement);
    return () => {
      window.removeEventListener(REPORT_BUG_EVENT, onBug);
      window.removeEventListener(PROPOSE_IMPROVEMENT_EVENT, onImprovement);
    };
  }, []);

  if (!status) return null;

  return (
    <>
      <ReportBugSheet
        key={`bug-${session}`}
        open={open === 'bug'}
        onOpenChange={(value) => setOpen(value ? 'bug' : null)}
        initialScreenshot={screenshot}
        context={context}
      />
      <ProposeImprovementSheet
        key={`improvement-${session}`}
        open={open === 'improvement'}
        onOpenChange={(value) => setOpen(value ? 'improvement' : null)}
        initialScreenshot={screenshot}
        context={context}
      />
    </>
  );
}
