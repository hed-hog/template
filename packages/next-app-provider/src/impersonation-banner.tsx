'use client';

import { useEffect, useState } from 'react';
import { useApp } from './app-provider';
import { formatRemaining, remainingMs } from './impersonation';

/**
 * Faixa fixa no topo enquanto a aba esta simulando o acesso de alguem.
 *
 * Existe para que ninguem confunda a tela com a propria sessao: sem ela, o
 * operador enxerga os dados de outra pessoa sem nenhum sinal disso — e um
 * screenshot dessa tela vira evidencia enganosa.
 *
 * Estilo inline pela mesma razao da tela de resgate: Tailwind nao e gerado para
 * classes escritas dentro deste pacote.
 */

export type ImpersonationBannerLabels = {
  viewingAs: string;
  operator: string;
  expiresIn: string;
  stop: string;
  stopping: string;
};

const DEFAULT_LABELS: ImpersonationBannerLabels = {
  viewingAs: 'SIMULATED ACCESS — you are seeing the system as',
  operator: 'Operator',
  expiresIn: 'expires in',
  stop: 'End simulation',
  stopping: 'Ending…',
};

export const IMPERSONATION_BANNER_HEIGHT = 40;

export function ImpersonationBanner({
  labels,
}: {
  labels?: Partial<ImpersonationBannerLabels>;
}) {
  const { impersonation, stopImpersonation } = useApp();
  const [remaining, setRemaining] = useState(() => remainingMs(impersonation));
  const [stopping, setStopping] = useState(false);

  useEffect(() => {
    if (!impersonation) return;

    setRemaining(remainingMs(impersonation));
    const interval = window.setInterval(
      () => setRemaining(remainingMs(impersonation)),
      1000,
    );

    return () => window.clearInterval(interval);
  }, [impersonation]);

  // A faixa e `fixed`, entao sem isto ela cobriria o topo do app. Empurrar o
  // `body` resolve nos tres apps sem cada um precisar saber da altura dela.
  useEffect(() => {
    if (!impersonation) return;

    const previous = document.body.style.paddingTop;
    document.body.style.paddingTop = `${IMPERSONATION_BANNER_HEIGHT}px`;

    return () => {
      document.body.style.paddingTop = previous;
    };
  }, [impersonation]);

  if (!impersonation) {
    return null;
  }

  const text = { ...DEFAULT_LABELS, ...(labels ?? {}) };

  const handleStop = async () => {
    setStopping(true);
    try {
      await stopImpersonation();
    } finally {
      setStopping(false);
    }
  };

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 2147483000,
        height: `${IMPERSONATION_BANNER_HEIGHT}px`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        padding: '0 16px',
        background: '#b45309',
        color: '#fff',
        fontFamily: 'system-ui, sans-serif',
        fontSize: '13px',
        lineHeight: 1.2,
        boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
      }}
    >
      <span aria-hidden style={{ fontSize: '15px' }}>
        ⚠
      </span>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        <strong>{text.viewingAs}</strong> {impersonation.target?.name || `#${impersonation.target?.id}`}
        {' · '}
        {text.operator}: {impersonation.operator?.name || `#${impersonation.operator?.id}`}
        {' · '}
        {text.expiresIn} {formatRemaining(remaining)}
      </span>
      <button
        type="button"
        onClick={handleStop}
        disabled={stopping}
        style={{
          flexShrink: 0,
          cursor: stopping ? 'default' : 'pointer',
          border: '1px solid rgba(255,255,255,0.6)',
          borderRadius: '6px',
          background: 'transparent',
          color: '#fff',
          padding: '4px 10px',
          fontSize: '12px',
          fontWeight: 600,
        }}
      >
        {stopping ? text.stopping : text.stop}
      </button>
    </div>
  );
}
