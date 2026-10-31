'use client';

import { MediaUploadField } from '@/components/media-upload/media-upload-field';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useApp } from '@hed-hog/next-app-provider';
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState, useSyncExternalStore } from 'react';

type Decision = 'approve' | 'reject';

type PageState =
  | { status: 'ready' }
  | { status: 'rejecting' }
  | { status: 'submitting' }
  | { status: 'success'; decision: Decision }
  | { status: 'error'; message: string }
  | { status: 'invalid' };

/** Legacy mode: anonymous link that POSTs straight to the core webhook (`cb`). */
function CallbackApproval({ cb }: { cb: string | null }) {
  const searchParams = useSearchParams();
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

const noopSubscribe = () => () => {};

/**
 * Texto puro com as URLs viradas em link — os detalhes vêm de um workflow, não de HTML.
 * `break-all` no link: uma URL com token (a prévia do site) não tem onde quebrar e
 * empurrava a página para os lados.
 */
function linkify(text: string) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noopener noreferrer"
        className="break-all text-primary underline"
      >
        {part}
      </a>
    ) : (
      part
    ),
  );
}

type LinkApproval = {
  id: number;
  title: string | null;
  description: string | null;
  image: string | null;
  /** Detalhes que ficam só nesta página (`payload.details` do nó); a mensagem leva o resumo. */
  details?: string | null;
  /** O nó aceita uma foto de referência junto da reprovação. */
  allowReferenceImage?: boolean;
  status: 'pending' | 'approved' | 'rejected' | 'expired' | 'cancelled';
  response: { reason?: string; retry?: boolean; reference_file_id?: number } | null;
  responder: { id: number; name: string } | null;
};

/**
 * Login mode (`token`): the answer goes through `agent/approval-links/:token`
 * with the Hub session, so the flow knows who approved or rejected.
 */
function TokenApproval({ token }: { token: string }) {
  const t = useTranslations('agent.ApprovalPage');
  const router = useRouter();
  const { accessToken, request, setUrlAfterLogin, getErrorMessage } = useApp();
  // false on the server and in the hydration pass: the session token lives in
  // localStorage, so nothing is decided before the client takes over.
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const [approval, setApproval] = useState<LinkApproval | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [retry, setRetry] = useState(true);
  const [referenceFileId, setReferenceFileId] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const goToLogin = useCallback(() => {
    setUrlAfterLogin(`/approval?token=${encodeURIComponent(token)}`);
    router.replace('/login');
  }, [router, setUrlAfterLogin, token]);

  useEffect(() => {
    // The token comes from localStorage: only decide after hydration.
    if (!mounted) return;
    if (!accessToken) {
      goToLogin();
      return;
    }
    request<LinkApproval>({
      url: `/agent/approval-links/${encodeURIComponent(token)}`,
      showErrors: false,
    })
      .then((res) => setApproval(res.data))
      .catch((err) => {
        if (err?.response?.status === 401) goToLogin();
        else setLoadError(err?.response?.status === 404 ? t('notFound') : getErrorMessage(err));
      });
  }, [mounted, accessToken, token, request, goToLogin, getErrorMessage, t]);

  const submit = async (decision: Decision) => {
    setSubmitError(null);
    try {
      const res = await request<LinkApproval>({
        url: `/agent/approval-links/${encodeURIComponent(token)}`,
        method: 'POST',
        data: {
          decision,
          note: note.trim() || undefined,
          retry: decision === 'reject' ? retry : undefined,
          reference_file_id:
            decision === 'reject' && referenceFileId ? referenceFileId : undefined,
        },
        showErrors: false,
      });
      setApproval(res.data);
      setRejecting(false);
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    }
  };

  const answered = approval && approval.status !== 'pending';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/30 p-4">
      <div className="mb-6 flex flex-col items-center gap-1 text-center">
        <ShieldCheck className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{t('kicker')}</p>
      </div>

      <Card className="w-full max-w-xl shadow-sm">
        {!approval && !loadError && (
          <CardHeader className="items-center text-center">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
            <CardDescription className="mt-4">{t('loading')}</CardDescription>
          </CardHeader>
        )}

        {loadError && (
          <CardHeader className="items-center text-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
            <CardTitle className="mt-4 text-lg">{t('invalidTitle')}</CardTitle>
            <CardDescription>{loadError}</CardDescription>
          </CardHeader>
        )}

        {approval && (
          <>
            <CardHeader>
              <CardTitle className="text-lg">
                {approval.title || t('defaultTitle')}
              </CardTitle>
              {approval.description && (
                <CardDescription className="whitespace-pre-wrap wrap-break-word">
                  {linkify(approval.description)}
                </CardDescription>
              )}
            </CardHeader>

            {approval.image && (
              <CardContent>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={approval.image}
                  alt={approval.title ?? ''}
                  className="w-full rounded-md border object-cover"
                />
              </CardContent>
            )}

            {approval.details && (
              <CardContent>
                <div className="whitespace-pre-wrap wrap-break-word rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                  {linkify(approval.details)}
                </div>
              </CardContent>
            )}

            {answered && (
              <CardContent>
                <div className="flex items-start gap-3 rounded-md border p-3 text-sm">
                  {approval.status === 'approved' ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                  )}
                  <div className="space-y-1">
                    <p className="font-medium">
                      {approval.status === 'approved'
                        ? t('approvedBy', { name: approval.responder?.name ?? '—' })
                        : approval.status === 'rejected'
                          ? t('rejectedBy', { name: approval.responder?.name ?? '—' })
                          : t('expired')}
                    </p>
                    {approval.response?.reason && (
                      <p className="text-muted-foreground">{approval.response.reason}</p>
                    )}
                    {approval.status === 'rejected' && (
                      <p className="text-muted-foreground">
                        {approval.response?.retry ? t('willRetry') : t('closed')}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            )}

            {!answered && !rejecting && (
              <CardFooter className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="w-full bg-green-600 text-white hover:bg-green-700 sm:flex-1"
                  onClick={() => submit('approve')}
                >
                  <ThumbsUp className="mr-2 h-4 w-4" />
                  {t('approve')}
                </Button>
                <Button
                  className="w-full sm:flex-1"
                  variant="outline"
                  onClick={() => setRejecting(true)}
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  {t('reject')}
                </Button>
              </CardFooter>
            )}

            {!answered && rejecting && (
              <>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="approval-reason">{t('reasonLabel')}</Label>
                    <Textarea
                      id="approval-reason"
                      placeholder={t('reasonPlaceholder')}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      rows={4}
                    />
                  </div>
                  {approval.allowReferenceImage && (
                    <MediaUploadField
                      kind="image"
                      fileId={referenceFileId}
                      onChange={setReferenceFileId}
                      label={t('referenceLabel')}
                      description={t('referenceHelp')}
                      destination="agent/approval-references"
                      uploadUrl={`/agent/approval-links/${encodeURIComponent(token)}/reference`}
                      labels={{
                        empty: t('referenceEmpty'),
                        upload: t('referenceUpload'),
                        replace: t('referenceReplace'),
                        remove: t('referenceRemove'),
                        download: t('referenceDownload'),
                        zoom: t('referenceZoom'),
                        uploading: t('referenceUploading'),
                        uploadError: t('referenceError'),
                        downloadError: t('referenceError'),
                      }}
                    />
                  )}
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="approval-retry"
                      checked={retry}
                      onCheckedChange={(v) => setRetry(v === true)}
                    />
                    <Label htmlFor="approval-retry" className="cursor-pointer leading-snug">
                      {t('retryLabel')}
                    </Label>
                  </div>
                </CardContent>
                <CardFooter className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    className="w-full sm:flex-1"
                    variant="destructive"
                    disabled={!note.trim()}
                    onClick={() => submit('reject')}
                  >
                    {t('confirmReject')}
                  </Button>
                  <Button
                    className="w-full sm:flex-1"
                    variant="ghost"
                    onClick={() => setRejecting(false)}
                  >
                    {t('back')}
                  </Button>
                </CardFooter>
              </>
            )}

            {submitError && (
              <CardContent>
                <p className="text-sm text-red-600">{submitError}</p>
              </CardContent>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

function ApprovalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  if (token) return <TokenApproval token={token} />;
  return <CallbackApproval cb={searchParams.get('cb')} />;
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
