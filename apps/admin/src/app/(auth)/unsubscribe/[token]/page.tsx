'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MailX,
  ShieldOff,
} from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// API base — consistent with app-provider.tsx default
// ---------------------------------------------------------------------------
const API_BASE =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    ? process.env.NEXT_PUBLIC_API_BASE_URL.trim().replace(/\/$/, '')
    : '/api';

type TokenInfo = {
  email: string;
  scope: string;
  alreadyUnsubscribed: boolean;
  unsubscribedAt: string | null;
};

type PageState =
  | { status: 'loading' }
  | { status: 'ready'; info: TokenInfo }
  | { status: 'confirming' }
  | { status: 'success'; email: string; alreadyUnsubscribed?: boolean }
  | { status: 'invalid'; message: string };

const SCOPE_LABELS: Record<string, string> = {
  all_campaigns: 'todas as campanhas',
  campaign: 'esta campanha',
  category: 'esta categoria de campanhas',
};

export default function UnsubscribePage() {
  const params = useParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [state, setState] = useState<PageState>({ status: 'loading' });

  // Fetch token info on mount
  useEffect(() => {
    if (!token) {
      setState({ status: 'invalid', message: 'Link de descadastro invalido.' });
      return;
    }

    fetch(`${API_BASE}/campaign/unsubscribe/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.message || 'Link invalido ou expirado.');
        }
        return res.json() as Promise<TokenInfo>;
      })
      .then((info) => {
        if (info.alreadyUnsubscribed) {
          setState({
            status: 'success',
            email: info.email,
            alreadyUnsubscribed: true,
          });
        } else {
          setState({ status: 'ready', info });
        }
      })
      .catch((err: Error) => {
        setState({ status: 'invalid', message: err.message });
      });
  }, [token]);

  // Confirm unsubscribe
  const handleConfirm = async () => {
    if (state.status !== 'ready') return;
    const { info } = state;

    setState({ status: 'confirming' });

    try {
      const res = await fetch(`${API_BASE}/campaign/unsubscribe/${token}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.message || 'Nao foi possivel confirmar o descadastro.'
        );
      }

      setState({ status: 'success', email: info.email });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro inesperado. Tente novamente.';
      setState({
        status: 'invalid',
        message: msg,
      });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 flex flex-col items-center gap-1 text-center">
        <MailX className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Gerenciamento de preferencias de email
        </p>
      </div>

      <Card className="w-full max-w-md shadow-sm">
        {state.status === 'loading' && (
          <>
            <CardHeader className="items-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
              <CardTitle className="mt-4 text-lg">
                Verificando link...
              </CardTitle>
              <CardDescription>Aguarde um momento.</CardDescription>
            </CardHeader>
          </>
        )}

        {state.status === 'ready' && (
          <>
            <CardHeader className="items-center text-center">
              <ShieldOff className="h-10 w-10 text-orange-500" />
              <CardTitle className="mt-4 text-lg">
                Descadastro de campanhas
              </CardTitle>
              <CardDescription>
                Voce esta prestes a deixar de receber campanhas por e-mail.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm">
                <p className="text-muted-foreground">Email</p>
                <p className="mt-0.5 font-mono font-medium text-foreground">
                  {state.info.email}
                </p>
              </div>
              <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm">
                <p className="text-muted-foreground">Escopo</p>
                <p className="mt-0.5 font-medium text-foreground capitalize">
                  {SCOPE_LABELS[state.info.scope] ?? state.info.scope}
                </p>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Apos confirmar, seu email sera adicionado a lista de supressao e
                voce nao recebera mais emails de{' '}
                {SCOPE_LABELS[state.info.scope] ?? 'nossas campanhas'}.
              </p>
            </CardContent>
            <CardFooter className="flex flex-col gap-2">
              <Button
                className="w-full"
                variant="destructive"
                onClick={handleConfirm}
              >
                Confirmar descadastro
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Esta acao pode ser revertida entrando em contato com o suporte.
              </p>
            </CardFooter>
          </>
        )}

        {state.status === 'confirming' && (
          <>
            <CardHeader className="items-center text-center">
              <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
              <CardTitle className="mt-4 text-lg">Processando...</CardTitle>
              <CardDescription>Registrando seu descadastro.</CardDescription>
            </CardHeader>
          </>
        )}

        {state.status === 'success' && (
          <>
            <CardHeader className="items-center text-center">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
              <CardTitle className="mt-4 text-lg">
                {state.alreadyUnsubscribed
                  ? 'Voce ja estava descadastrado'
                  : 'Descadastro confirmado!'}
              </CardTitle>
              <CardDescription>
                {state.alreadyUnsubscribed
                  ? 'Seu email ja havia sido removido anteriormente.'
                  : 'Seu descadastro foi confirmado com sucesso.'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border bg-muted/50 px-4 py-3 text-sm">
                <p className="text-muted-foreground">Email removido</p>
                <p className="mt-0.5 font-mono font-medium text-foreground">
                  {state.email}
                </p>
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Voce nao recebera mais emails de campanhas neste endereco. Se
                isso foi um erro, entre em contato com o suporte.
              </p>
            </CardContent>
          </>
        )}

        {state.status === 'invalid' && (
          <>
            <CardHeader className="items-center text-center">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
              <CardTitle className="mt-4 text-lg">Link invalido</CardTitle>
              <CardDescription>{state.message}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-center text-sm text-muted-foreground">
                O link de descadastro pode ter expirado ou ja foi utilizado. Se
                precisar de ajuda, entre em contato com o suporte.
              </p>
            </CardContent>
          </>
        )}
      </Card>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Esta pagina e protegida contra envio em massa e uso automatizado.
      </p>
    </div>
  );
}
