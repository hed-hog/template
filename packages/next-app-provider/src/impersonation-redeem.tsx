'use client';

import axios from 'axios';
import { useEffect, useRef, useState } from 'react';
import { useApp } from './app-provider';
import {
  clearImpersonation,
  ImpersonationParticipant,
  parseCodeFromHash,
} from './impersonation';

/**
 * Tela de resgate da simulacao de acesso. Cada app monta uma rota fina
 * (`/simulacao`) que so renderiza este componente — de proposito FORA de
 * qualquer guarda de papel, porque quem chega aqui ainda nao tem sessao.
 *
 * Estilo inline: nenhum `globals.css` dos apps tem `@source` apontando para este
 * pacote, entao classe do Tailwind escrita aqui nao seria gerada.
 */

export type ImpersonationRedeemLabels = {
  loading: string;
  invalidTitle: string;
  invalidDescription: string;
  missingCode: string;
};

const DEFAULT_LABELS: ImpersonationRedeemLabels = {
  loading: 'Starting access simulation…',
  invalidTitle: 'Simulation link is no longer valid',
  invalidDescription:
    'This link works only once and expires after a minute. Ask the operator to start a new simulation.',
  missingCode: 'No simulation code found in the link.',
};

type RedeemResponse = {
  accessToken: string;
  expiresAt: string;
  sessionId: number;
  app: string;
  operator: ImpersonationParticipant;
  target: ImpersonationParticipant;
};

export function ImpersonationRedeem({
  homePath = '/',
  labels,
}: {
  homePath?: string;
  labels?: Partial<ImpersonationRedeemLabels>;
}) {
  const { startImpersonationSession, apiBaseUrl } = useApp();
  const [error, setError] = useState<string | null>(null);
  // StrictMode monta duas vezes em dev, e o codigo e de uso unico: sem esta
  // trava o segundo resgate falharia e a tela mostraria erro numa simulacao boa.
  const startedRef = useRef(false);

  const text = { ...DEFAULT_LABELS, ...(labels ?? {}) };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const code = parseCodeFromHash(window.location.hash);

    // Tira o codigo da barra de enderecos antes de qualquer outra coisa: ele nao
    // deve sobreviver no historico do navegador.
    window.history.replaceState(null, '', window.location.pathname);

    if (!code) {
      setError(text.missingCode);
      return;
    }

    // Defensivo: se esta aba herdou estado de uma simulacao anterior, ele nao
    // pode se misturar com a que esta comecando.
    clearImpersonation();

    // Axios cru, sem `Authorization` e sem `withCredentials`: o endpoint e
    // publico e mandar o cookie do operador aqui so criaria confusao.
    axios
      .post<RedeemResponse>(`${apiBaseUrl.replace(/\/+$/, '')}/impersonation/redeem`, { code })
      .then(({ data }) => {
        startImpersonationSession({
          accessToken: data.accessToken,
          expiresAt: data.expiresAt,
          operator: data.operator,
          target: data.target,
          app: data.app,
          sessionId: data.sessionId,
        });
        window.location.replace(homePath);
      })
      .catch(() => {
        setError(text.invalidDescription);
      });
    // Roda uma vez, no mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div style={{ maxWidth: '420px', textAlign: 'center' }}>
        {error ? (
          <>
            <h1 style={{ fontSize: '18px', fontWeight: 600, margin: '0 0 8px' }}>
              {text.invalidTitle}
            </h1>
            <p style={{ fontSize: '14px', opacity: 0.75, margin: 0 }}>{error}</p>
          </>
        ) : (
          <p style={{ fontSize: '14px', opacity: 0.75, margin: 0 }}>{text.loading}</p>
        )}
      </div>
    </div>
  );
}
