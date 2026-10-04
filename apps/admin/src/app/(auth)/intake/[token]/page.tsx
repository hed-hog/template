'use client';

import {
  PublicCaptcha,
  PublicCaptchaHandle,
  captchaIsUsable,
} from '@/components/captcha/public-captcha';
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
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useParams } from 'next/navigation';
import * as React from 'react';
import { IntakeAttachments } from './_components/intake-attachments';
import { IntakeField } from './_components/intake-field';
import {
  Attachment,
  FALLBACK_FIELDS,
  FormConfig,
  IntakeAnswer,
  initialAnswer,
  isAnswerEmpty,
} from './_components/intake-types';
import {
  renamePasted,
  usePasteAttachments,
} from './_components/use-paste-attachments';

/**
 * Formulario publico de abertura de tarefa de um projeto do Operations.
 *
 * Mora em `(auth)`, cujo layout e um passthrough puro: nada de shell
 * autenticado, nada de `@hed-hog/next-app-provider`. O `fetch` e cru e sem
 * token, como no descadastro de campanha e no compartilhamento de segredo.
 *
 * Os campos vem da configuracao do projeto (`operations_intake_field`); nome e
 * e-mail sao fixos, porque identificam o solicitante.
 *
 * O que e enviado aqui NAO vira tarefa: entra numa fila de aprovacao do projeto.
 */

// API base — igual ao default do app-provider.
const API_BASE =
  typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL?.trim()
    ? process.env.NEXT_PUBLIC_API_BASE_URL.trim().replace(/\/$/, '')
    : '/api';

type PageState =
  | { status: 'loading' }
  | { status: 'invalid'; message: string }
  | { status: 'ready'; config: FormConfig }
  | { status: 'sent'; protocol: string | null };

const ACCEPT_IMAGES = 'image/png,image/jpeg,image/gif,image/webp,image/bmp';
const ACCEPT_VIDEOS = 'video/mp4,video/quicktime,video/webm';
// Extensao junto do mime: Office moderno chega com `type` vazio em parte dos
// navegadores, e so a extensao o deixa aparecer no seletor.
const ACCEPT_DOCUMENTS = [
  'application/pdf',
  '.pdf',
  '.docx',
  '.xlsx',
  '.pptx',
  '.txt',
  '.csv',
  '.zip',
].join(',');

type FileKind = 'image' | 'video' | 'document';

function kindOf(file: File): FileKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  return 'document';
}

function formatMb(bytes: number): string {
  return `${Math.round(bytes / 1024 / 1024)} MB`;
}

/** Le o arquivo como base64 puro, sem o prefixo `data:`. */
function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read failed'));
    reader.onload = () => {
      const result = String(reader.result ?? '');
      resolve(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  });
}

export default function PublicTaskIntakePage() {
  const params = useParams();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;

  const [state, setState] = React.useState<PageState>({ status: 'loading' });
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [answers, setAnswers] = React.useState<Record<string, IntakeAnswer>>(
    {},
  );
  const [website, setWebsite] = React.useState('');
  const [attachments, setAttachments] = React.useState<Attachment[]>([]);
  const [captchaToken, setCaptchaToken] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const captchaRef = React.useRef<PublicCaptchaHandle>(null);
  // Espelho do estado para `handleFiles`: colagens seguidas chegam antes do
  // re-render, e contar pelo estado deixaria passar do limite de anexos.
  const attachmentsRef = React.useRef<Attachment[]>([]);

  const updateAttachments = React.useCallback(
    (update: (current: Attachment[]) => Attachment[]) => {
      attachmentsRef.current = update(attachmentsRef.current);
      setAttachments(attachmentsRef.current);
    },
    [],
  );

  // Os `blob:` dos previews vivem ate a pagina sair.
  React.useEffect(
    () => () => {
      attachmentsRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
      });
    },
    [],
  );

  React.useEffect(() => {
    if (!token) {
      setState({ status: 'invalid', message: 'Link invalido.' });
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `${API_BASE}/operations/public/intake/${encodeURIComponent(token)}`,
        );
        if (!response.ok) {
          if (!cancelled) {
            setState({
              status: 'invalid',
              message:
                'Este link não está mais disponível. Fale com quem o enviou.',
            });
          }
          return;
        }
        const config = (await response.json()) as FormConfig;
        if (!cancelled) {
          const fields = config.fields?.length
            ? config.fields
            : FALLBACK_FIELDS;
          setAnswers(
            Object.fromEntries(
              fields.map((field) => [field.slug, initialAnswer(field)]),
            ),
          );
          setState({ status: 'ready', config: { ...config, fields } });
        }
      } catch {
        if (!cancelled) {
          setState({
            status: 'invalid',
            message: 'Não foi possível carregar o formulário. Tente novamente.',
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token]);

  const config = state.status === 'ready' ? state.config : null;
  const limits = config?.limits;
  const fields = config?.fields ?? FALLBACK_FIELDS;

  const accept = React.useMemo(() => {
    if (!limits) return ACCEPT_IMAGES;
    return [
      ACCEPT_IMAGES,
      limits.allowVideo ? ACCEPT_VIDEOS : null,
      limits.allowDocuments ? ACCEPT_DOCUMENTS : null,
    ]
      .filter(Boolean)
      .join(',');
  }, [limits]);

  const uploaded = attachments.filter((item) => item.status === 'done');
  const uploading = attachments.some((item) => item.status === 'uploading');

  const removeAttachment = React.useCallback(
    (localId: string) => {
      updateAttachments((current) => {
        const target = current.find((item) => item.localId === localId);
        if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
        return current.filter((item) => item.localId !== localId);
      });
    },
    [updateAttachments],
  );

  async function uploadOne(localId: string, file: File) {
    try {
      const content = await toBase64(file);
      const response = await fetch(
        `${API_BASE}/operations/public/intake/${encodeURIComponent(
          token!,
        )}/uploads`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimetype: file.type,
            content_base64: content,
          }),
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message ?? 'Falha no envio do anexo');
      }

      updateAttachments((current) =>
        current.map((item) =>
          item.localId === localId
            ? { ...item, status: 'done', token: payload.token }
            : item,
        ),
      );
    } catch (uploadError) {
      updateAttachments((current) =>
        current.map((item) =>
          item.localId === localId
            ? {
                ...item,
                status: 'error',
                error:
                  uploadError instanceof Error
                    ? uploadError.message
                    : 'Falha no envio',
              }
            : item,
        ),
      );
    }
  }

  async function handleFiles(files: File[]) {
    if (!files.length || !token || !limits) return;

    const room = limits.maxFiles - attachmentsRef.current.length;
    if (room <= 0) {
      setError(`Máximo de ${limits.maxFiles} anexos.`);
      return;
    }

    const chosen = files.slice(0, room);
    setError(
      files.length > room ? `Máximo de ${limits.maxFiles} anexos.` : null,
    );

    for (const file of chosen) {
      const localId = `${file.name}-${file.size}-${Date.now()}-${Math.random()}`;
      const kind = kindOf(file);
      const base: Attachment = {
        localId,
        name: file.name,
        mimetype: file.type,
        previewUrl: kind === 'image' ? URL.createObjectURL(file) : undefined,
        status: 'uploading',
      };

      const accepted =
        kind === 'image' ||
        (kind === 'video' && limits.allowVideo) ||
        (kind === 'document' && limits.allowDocuments);
      if (!accepted) {
        updateAttachments((current) => [
          ...current,
          { ...base, status: 'error', error: 'Tipo não aceito' },
        ]);
        continue;
      }

      const maxBytes =
        kind === 'video'
          ? limits.maxVideoBytes
          : kind === 'document'
            ? (limits.maxDocumentBytes ?? 0)
            : limits.maxImageBytes;

      // Confere o tamanho antes de ler o arquivo: base64 de um video grande
      // custa memoria no navegador antes mesmo de sair daqui.
      if (file.size > maxBytes) {
        updateAttachments((current) => [
          ...current,
          { ...base, status: 'error', error: `Acima de ${formatMb(maxBytes)}` },
        ]);
        continue;
      }

      updateAttachments((current) => [...current, base]);
      await uploadOne(localId, file);
    }
  }

  const handlePastedFiles = (files: File[]) => {
    void handleFiles(renamePasted(files));
  };
  usePasteAttachments(state.status === 'ready', handlePastedFiles);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!token || !config) return;

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(
        `${API_BASE}/operations/public/intake/${encodeURIComponent(
          token,
        )}/submissions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email,
            answers,
            website,
            upload_tokens: uploaded.map((item) => item.token),
            ...(captchaToken ? { captcha_token: captchaToken } : {}),
          }),
        },
      );

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          payload?.message ??
            'Não foi possível enviar. Confira os campos e tente de novo.',
        );
      }

      setState({ status: 'sent', protocol: payload?.protocol ?? null });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível enviar.',
      );
      // Todo token de captcha e de uso unico: sem o reset, a segunda tentativa
      // reenviaria um token ja gasto e tomaria a mesma recusa.
      captchaRef.current?.reset();
      setCaptchaToken('');
    } finally {
      setSubmitting(false);
    }
  }

  if (state.status === 'loading') {
    return (
      <Shell>
        <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando...
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
            <CardDescription>{state.message}</CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  if (state.status === 'sent') {
    return (
      <Shell>
        <Card>
          <CardHeader className="items-center text-center">
            <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            <CardTitle className="mt-2">Recebemos sua solicitação</CardTitle>
            <CardDescription>
              {state.protocol
                ? `Guarde o protocolo ${state.protocol} para acompanhar com a equipe.`
                : 'A equipe vai avaliar e dar retorno.'}
            </CardDescription>
          </CardHeader>
        </Card>
      </Shell>
    );
  }

  const captchaRequired = Boolean(config?.captcha.enabled);
  const captchaBroken = captchaRequired && !captchaIsUsable(config!.captcha);
  const missingRequired = fields.some(
    (field) =>
      field.isRequired &&
      isAnswerEmpty(field, answers[field.slug] ?? initialAnswer(field)),
  );
  const canSubmit =
    name.trim().length > 0 &&
    email.trim().length > 0 &&
    !missingRequired &&
    !uploading &&
    !captchaBroken &&
    (!captchaRequired || captchaToken.length > 0);

  return (
    <Shell>
      <Card>
        <CardHeader>
          <CardTitle>{config!.project.name}</CardTitle>
          <CardDescription>
            Descreva o problema ou o pedido. Se ajudar, anexe arquivos — dá
            para colar um print direto em qualquer campo.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="intake-name">
                  Seu nome<span className="text-destructive"> *</span>
                </Label>
                <Input
                  id="intake-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={180}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="intake-email">
                  Seu e-mail<span className="text-destructive"> *</span>
                </Label>
                <Input
                  id="intake-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={180}
                  required
                />
              </div>
            </div>

            {fields.map((field) => (
              <IntakeField
                key={field.slug}
                field={field}
                value={answers[field.slug] ?? initialAnswer(field)}
                onChange={(value) =>
                  setAnswers((current) => ({ ...current, [field.slug]: value }))
                }
                onPasteFiles={handlePastedFiles}
              />
            ))}

            <IntakeAttachments
              attachments={attachments}
              accept={accept}
              maxFiles={limits?.maxFiles ?? 0}
              hint={attachmentHint(limits)}
              onFiles={(files) => void handleFiles(files)}
              onRemove={removeAttachment}
            />

            {/* Honeypot: invisivel para humanos, irresistivel para bot. */}
            <div className="hidden" aria-hidden="true">
              <label htmlFor="intake-website">Não preencha este campo</label>
              <input
                id="intake-website"
                name="website"
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
              />
            </div>

            {captchaRequired && !captchaBroken && (
              <PublicCaptcha
                ref={captchaRef}
                config={config!.captcha}
                onToken={setCaptchaToken}
              />
            )}

            {captchaBroken && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                A verificação de segurança deste formulário está mal
                configurada. Avise quem enviou o link.
              </p>
            )}

            {error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              loading={submitting}
              loadingLabel="Enviando..."
              disabled={!canSubmit}
            >
              Enviar solicitação
            </Button>
          </form>
        </CardContent>
      </Card>
    </Shell>
  );
}

function attachmentHint(limits: FormConfig['limits'] | undefined): string {
  if (!limits) return '';
  const parts = [`imagem até ${formatMb(limits.maxImageBytes)}`];
  if (limits.allowVideo) {
    parts.push(`vídeo até ${formatMb(limits.maxVideoBytes)}`);
  }
  if (limits.allowDocuments && limits.maxDocumentBytes) {
    parts.push(
      `documento (PDF, Office, txt, csv, zip) até ${formatMb(limits.maxDocumentBytes)}`,
    );
  }
  return `Até ${limits.maxFiles} arquivos: ${parts.join(', ')}. Para anexar um print, cole com Ctrl+V.`;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-start justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}
