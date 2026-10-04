'use client';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import { useParams } from 'next/navigation';
import * as React from 'react';

/**
 * Pagina publica em que o cliente ve a proposta e aceita ou recusa.
 *
 * Mora em `(auth)`, cujo layout e um passthrough: sem shell autenticado e sem
 * `@hed-hog/next-app-provider`, como o formulario publico do intake. O `fetch` e
 * cru e sem token de sessao — o que autoriza e o token do link.
 *
 * O conteudo da proposta chega como TEXTO (o backend converte o HTML do editor):
 * nenhuma marcacao escrita no admin e injetada aqui.
 */

const API_BASE =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    ? process.env.NEXT_PUBLIC_API_BASE_URL.trim().replace(/\/$/, '')
    : '/api';

type PublicItem = {
  name: string;
  description: string | null;
  quantity: number;
  unit_amount_cents: number;
  total_amount_cents: number;
  recurrence: string | null;
};

type PublicProposal = {
  code: string | null;
  title: string | null;
  status: 'open' | 'accepted' | 'declined' | 'expired' | 'unavailable';
  customer_name: string | null;
  valid_until: string | null;
  currency_code: string;
  summary: string | null;
  content_text: string | null;
  items: PublicItem[];
  subtotal_amount_cents: number;
  discount_amount_cents: number;
  tax_amount_cents: number;
  total_amount_cents: number;
  payment_method: string | null;
  payment_notes: string | null;
  /** Vencimento relativo: o contrato ainda nao foi assinado. */
  payment_installments: Array<{
    installment_number: number;
    days_after_signature: number;
    amount_cents: number;
  }>;
  decided_at: string | null;
  decided_by_name: string | null;
  lost_reasons: Array<{ id: number; name: string }>;
};

type LoadState =
  | { status: 'loading' }
  | { status: 'invalid' }
  | { status: 'ready'; proposal: PublicProposal };

type Mode = 'view' | 'accept' | 'decline';

const RECURRENCE_LABEL: Record<string, string> = {
  monthly: 'mensal',
  quarterly: 'trimestral',
  yearly: 'anual',
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  pix: 'PIX',
  boleto: 'Boleto',
  bank_transfer: 'Transferência bancária',
  card: 'Cartão',
  direct_debit: 'Débito automático',
  cash: 'Dinheiro',
  check: 'Cheque',
  other: 'Outro',
};

function money(cents: number, currency: string) {
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency || 'BRL' }).format(
      Number(cents || 0) / 100,
    );
  } catch {
    return `${currency} ${(Number(cents || 0) / 100).toFixed(2)}`;
  }
}

function dateLabel(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-BR');
}

// As mensagens do backend sao em ingles e escritas para quem opera o admin; o
// cliente recebe um texto proprio, escolhido pelo tipo do erro.
async function readError(response: Response, fallback: string) {
  if (response.status === 429) {
    return 'Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.';
  }
  if (response.status === 404) {
    return 'Este link de proposta não existe mais.';
  }
  try {
    const body = await response.json();
    const message = String(Array.isArray(body?.message) ? body.message.join(' ') : (body?.message ?? ''));
    if (/expired/i.test(message)) {
      return 'O prazo desta proposta terminou. Fale com quem a enviou.';
    }
    if (/no longer awaiting/i.test(message)) {
      return 'Esta proposta já recebeu uma resposta. Recarregue a página.';
    }
    if (/email/i.test(message)) {
      return 'Confira o e-mail informado.';
    }
  } catch {
    // corpo sem JSON: fica o texto generico
  }
  return fallback;
}

/**
 * Resumo, descricao do item e observacoes do pagamento chegam da API ja
 * sanitizados (`proposalRichTextToHtml`, whitelist do sanitize-html), inclusive
 * o texto puro de proposta antiga, convertido em paragrafos.
 */
function RichText({ html, className }: { html: string; className?: string }) {
  return (
    <div
      className={`prose prose-sm max-w-none break-words dark:prose-invert [&_p]:my-1 ${className ?? ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export default function PublicProposalPage() {
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? '');
  const [state, setState] = React.useState<LoadState>({ status: 'loading' });
  const [mode, setMode] = React.useState<Mode>('view');
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [note, setNote] = React.useState('');
  const [reasonId, setReasonId] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const response = await fetch(`${API_BASE}/crm/public/proposal/${encodeURIComponent(token)}`);
        if (cancelled) return;
        if (!response.ok) {
          setState({ status: 'invalid' });
          return;
        }
        const proposal = (await response.json()) as PublicProposal;
        if (!cancelled) setState({ status: 'ready', proposal });
      } catch {
        if (!cancelled) setState({ status: 'invalid' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function decide(kind: 'accept' | 'decline', event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const body =
        kind === 'accept'
          ? { name: name.trim(), email: email.trim(), note: note.trim() || undefined }
          : {
              lost_reason_id: Number(reasonId),
              note: note.trim() || undefined,
              name: name.trim() || undefined,
              email: email.trim() || undefined,
            };

      const response = await fetch(
        `${API_BASE}/crm/public/proposal/${encodeURIComponent(token)}/${kind}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );

      if (!response.ok) {
        setError(await readError(response, 'Não foi possível registrar sua resposta. Tente de novo.'));
        return;
      }

      const proposal = (await response.json()) as PublicProposal;
      setState({ status: 'ready', proposal });
      setMode('view');
    } catch {
      setError('Não foi possível registrar sua resposta. Verifique a conexão e tente de novo.');
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando proposta...
        </div>
      </Shell>
    );
  }

  if (state.status === 'invalid') {
    return (
      <Shell>
        <Card>
          <CardHeader className="items-center text-center">
            <AlertTriangle className="h-10 w-10 text-muted-foreground" />
            <CardTitle className="mt-2">Link indisponível</CardTitle>
            <CardDescription>
              Este link de proposta não existe ou foi desativado. Fale com quem enviou a proposta.
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  const proposal = state.proposal;
  const currency = proposal.currency_code || 'BRL';
  const hasDiscount = proposal.discount_amount_cents > 0;
  const hasTax = proposal.tax_amount_cents > 0;

  return (
    <Shell>
      <Card>
        <CardHeader>
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Proposta comercial{proposal.code ? ` · ${proposal.code}` : ''}
          </p>
          <CardTitle className="text-xl">{proposal.title}</CardTitle>
          <CardDescription>
            {proposal.customer_name ? `Para ${proposal.customer_name}. ` : ''}
            {proposal.valid_until ? `Válida até ${dateLabel(proposal.valid_until)}.` : ''}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <DecisionBanner proposal={proposal} />

          {proposal.summary ? (
            <RichText html={proposal.summary} className="text-sm text-foreground" />
          ) : null}

          {proposal.items.length > 0 ? (
            <div className="overflow-hidden rounded-lg border">
              <div className="divide-y">
                {proposal.items.map((item, index) => (
                  <div key={index} className="flex items-start justify-between gap-4 p-3 text-sm">
                    <div className="min-w-0">
                      <p className="font-medium">{item.name}</p>
                      {item.description ? (
                        <RichText
                          html={item.description}
                          className="mt-0.5 text-xs text-muted-foreground"
                        />
                      ) : null}
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.quantity} × {money(item.unit_amount_cents, currency)}
                        {item.recurrence && RECURRENCE_LABEL[item.recurrence]
                          ? ` · ${RECURRENCE_LABEL[item.recurrence]}`
                          : ''}
                      </p>
                    </div>
                    <p className="shrink-0 font-medium tabular-nums">
                      {money(item.total_amount_cents, currency)}
                    </p>
                  </div>
                ))}
              </div>
              <div className="space-y-1 border-t bg-muted/30 p-3 text-sm">
                {hasDiscount || hasTax ? (
                  <Row label="Subtotal" value={money(proposal.subtotal_amount_cents, currency)} />
                ) : null}
                {hasDiscount ? (
                  <Row label="Desconto" value={`- ${money(proposal.discount_amount_cents, currency)}`} />
                ) : null}
                {hasTax ? <Row label="Impostos" value={money(proposal.tax_amount_cents, currency)} /> : null}
                <Row label="Total" value={money(proposal.total_amount_cents, currency)} strong />
              </div>
            </div>
          ) : null}

          {proposal.payment_method || proposal.payment_installments?.length ? (
            <div className="space-y-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">Condições de pagamento</p>
              {proposal.payment_method ? (
                <Row
                  label="Forma de pagamento"
                  value={PAYMENT_METHOD_LABEL[proposal.payment_method] ?? proposal.payment_method}
                />
              ) : null}
              {(proposal.payment_installments ?? []).map((installment, index, all) => (
                <Row
                  key={installment.installment_number ?? index}
                  label={`Parcela ${index + 1}/${all.length} · ${
                    installment.days_after_signature > 0
                      ? `${installment.days_after_signature} dias após a assinatura`
                      : 'na assinatura do contrato'
                  }`}
                  value={money(installment.amount_cents, currency)}
                />
              ))}
              {proposal.payment_notes ? (
                <RichText html={proposal.payment_notes} className="text-xs text-muted-foreground" />
              ) : null}
            </div>
          ) : null}

          {proposal.content_text ? (
            <div className="rounded-lg border bg-muted/20 p-4">
              <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
                {proposal.content_text}
              </p>
            </div>
          ) : null}

          {proposal.status === 'open' && mode === 'view' ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button variant="outline" onClick={() => setMode('decline')}>
                <XCircle />
                Recusar proposta
              </Button>
              <Button onClick={() => setMode('accept')}>
                <CheckCircle2 />
                Aceitar proposta
              </Button>
            </div>
          ) : null}

          {proposal.status === 'open' && mode === 'accept' ? (
            <form onSubmit={(event) => decide('accept', event)} className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-medium">Confirme quem está aceitando</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="proposal-name">Seu nome</Label>
                  <Input id="proposal-name" value={name} maxLength={180} required onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="proposal-email">Seu e-mail</Label>
                  <Input
                    id="proposal-email"
                    type="email"
                    value={email}
                    maxLength={180}
                    required
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-note">Observação (opcional)</Label>
                <Textarea id="proposal-note" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setMode('view')}>
                  Voltar
                </Button>
                <Button type="submit" loading={submitting} disabled={!name.trim() || !email.trim()}>
                  <CheckCircle2 />
                  Confirmar aceite
                </Button>
              </div>
            </form>
          ) : null}

          {proposal.status === 'open' && mode === 'decline' ? (
            <form onSubmit={(event) => decide('decline', event)} className="space-y-4 rounded-lg border p-4">
              <p className="text-sm font-medium">Conte por que a proposta não serviu</p>
              <div className="space-y-2">
                <Label htmlFor="proposal-reason">
                  Motivo <span className="text-destructive">*</span>
                </Label>
                {/* <select> nativo: a pagina nao carrega o provider do admin, e o
                    nativo funciona bem no celular, onde o cliente abre o link. */}
                <select
                  id="proposal-reason"
                  required
                  value={reasonId}
                  onChange={(e) => setReasonId(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs"
                >
                  <option value="">Selecione</option>
                  {proposal.lost_reasons.map((reason) => (
                    <option key={reason.id} value={reason.id}>
                      {reason.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="proposal-decline-note">Algo mais que queira dizer (opcional)</Label>
                <Textarea
                  id="proposal-decline-note"
                  rows={3}
                  maxLength={2000}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={() => setMode('view')}>
                  Voltar
                </Button>
                <Button type="submit" variant="destructive" loading={submitting} disabled={!reasonId}>
                  <XCircle />
                  Confirmar recusa
                </Button>
              </div>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </Shell>
  );
}

function DecisionBanner({ proposal }: { proposal: PublicProposal }) {
  if (proposal.status === 'accepted') {
    return (
      <Banner tone="success" icon={<CheckCircle2 className="h-5 w-5" />}>
        Proposta aceita{proposal.decided_by_name ? ` por ${proposal.decided_by_name}` : ''}
        {proposal.decided_at ? ` em ${dateLabel(proposal.decided_at)}` : ''}. Obrigado! A equipe vai
        entrar em contato para os próximos passos.
      </Banner>
    );
  }
  if (proposal.status === 'declined') {
    return (
      <Banner tone="muted" icon={<XCircle className="h-5 w-5" />}>
        Proposta recusada{proposal.decided_at ? ` em ${dateLabel(proposal.decided_at)}` : ''}. Obrigado
        pelo retorno.
      </Banner>
    );
  }
  if (proposal.status === 'expired') {
    return (
      <Banner tone="warning" icon={<Clock className="h-5 w-5" />}>
        O prazo desta proposta terminou. Fale com quem a enviou para receber uma versão atualizada.
      </Banner>
    );
  }
  if (proposal.status === 'unavailable') {
    return (
      <Banner tone="warning" icon={<AlertTriangle className="h-5 w-5" />}>
        Esta proposta não está mais disponível para decisão.
      </Banner>
    );
  }
  return null;
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: 'success' | 'warning' | 'muted';
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const classes = {
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800',
    warning: 'border-amber-500/30 bg-amber-500/10 text-amber-800',
    muted: 'border-border bg-muted/40 text-foreground',
  }[tone];
  return (
    <div className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${classes}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p>{children}</p>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? 'text-base font-semibold' : ''}`}>
      <span className={strong ? '' : 'text-muted-foreground'}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}
