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
import { Textarea } from '@/components/ui/textarea';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

type Decision = 'approve' | 'reject';

type PageState =
  | { status: 'ready' }
  | { status: 'rejecting' }
  | { status: 'submitting' }
  | { status: 'success'; decision: Decision }
  | { status: 'error'; message: string }
  | { status: 'invalid' };

function ApprovalContent() {
  const searchParams = useSearchParams();
  const cb = searchParams.get('cb');
  const title = searchParams.get('title')?.trim() || 'Solicitacao de aprovacao';

  const [state, setState] = useState<PageState>(
    cb ? { status: 'ready' } : { status: 'invalid' },
  );
  const [note, setNote] = useState('');

  const submit = async (decision: Decision) => {
    if (!cb) return;
    setState({ status: 'submitting' });
    try {
      const res = await fetch(cb, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          note: decision === 'reject' ? note.trim() || undefined : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          body?.message || 'Nao foi possivel registrar sua resposta.',
        );
      }
      setState({ status: 'success', decision });
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Ocorreu um erro inesperado. Tente novamente.';
      setState({ status: 'error', message: msg });
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-8 flex flex-col items-center gap-1 text-center">
        <ShieldCheck className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">Aprovacao de geracao</p>
      </div>

      <Card className="w-full max-w-md shadow-sm">
        {(state.status === 'ready' || state.status === 'rejecting') && (
          <>
            <CardHeader className="items-center text-center">
              <ShieldCheck className="h-10 w-10 text-sky-500" />
              <CardTitle className="mt-4 text-lg">{title}</CardTitle>
              <CardDescription>
                Revise o conteudo enviado e escolha uma opcao abaixo.
              </CardDescription>
            </CardHeader>

            {state.status === 'ready' && (
              <CardFooter className="flex flex-col gap-2">
                <Button
                  className="w-full bg-green-600 text-white hover:bg-green-700"
                  onClick={() => submit('approve')}
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  Aprovar
                </Button>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => setState({ status: 'rejecting' })}
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  Rejeitar
                </Button>
              </CardFooter>
            )}

            {state.status === 'rejecting' && (
              <>
                <CardContent className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Se quiser, explique o que ajustar (opcional). Sua resposta
                    sera usada para refinar a geracao.
                  </p>
                  <Textarea
                    placeholder="Ex.: deixe o personagem mais escuro, sem o farol ao fundo..."
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    rows={4}
                  />
                </CardContent>
                <CardFooter className="flex flex-col gap-2">
                  <Button
                    className="w-full"
                    variant="destructive"
                    onClick={() => submit('reject')}
                  >
                    Confirmar rejeicao
                  </Button>
                  <Button
                    className="w-full"
                    variant="ghost"
                    onClick={() => setState({ status: 'ready' })}
                  >
                    Voltar
                  </Button>
                </CardFooter>
              </>
            )}
          </>
        )}

        {state.status === 'submitting' && (
          <CardHeader className="items-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-sky-500" />
            <CardTitle className="mt-4 text-lg">Registrando...</CardTitle>
            <CardDescription>Enviando sua resposta.</CardDescription>
          </CardHeader>
        )}

        {state.status === 'success' && (
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
            <CardTitle className="mt-4 text-lg">
              {state.decision === 'approve'
                ? 'Aprovado!'
                : 'Rejeitado — obrigado!'}
            </CardTitle>
            <CardDescription>
              {state.decision === 'approve'
                ? 'A geracao vai continuar. Pode fechar esta pagina.'
                : 'Seu feedback foi registrado e sera usado para ajustar a proxima versao. Pode fechar esta pagina.'}
            </CardDescription>
          </CardHeader>
        )}

        {state.status === 'error' && (
          <>
            <CardHeader className="items-center text-center">
              <AlertTriangle className="h-10 w-10 text-amber-500" />
              <CardTitle className="mt-4 text-lg">Nao foi possivel responder</CardTitle>
              <CardDescription>{state.message}</CardDescription>
            </CardHeader>
            <CardFooter>
              <Button
                className="w-full"
                variant="outline"
                onClick={() => setState({ status: 'ready' })}
              >
                Tentar novamente
              </Button>
            </CardFooter>
          </>
        )}

        {state.status === 'invalid' && (
          <CardHeader className="items-center text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <CardTitle className="mt-4 text-lg">Link invalido</CardTitle>
            <CardDescription>
              Este link de aprovacao esta incompleto ou expirou. Solicite um novo
              envio.
            </CardDescription>
          </CardHeader>
        )}
      </Card>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        Esta pagina e protegida contra uso automatizado.
      </p>
    </div>
  );
}

export default function ApprovalPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ApprovalContent />
    </Suspense>
  );
}
