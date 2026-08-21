/**
 * Verificação de credenciais de e-mail sem enviar mensagem.
 *
 * Vive aqui porque `nodemailer` e `@aws-sdk/client-ses` são dependências deste pacote,
 * não do core — que é quem expõe o botão "Testar conexão" dos Perfis de Integração.
 *
 * Import dinâmico como no resto do MailService: mantém o custo fora do boot.
 */

export type MailVerifyResult = {
  ok: boolean;
  /** Evidência legível do sucesso. Nunca contém credencial. */
  info?: string;
  /** Motivo legível da falha. Nunca contém credencial. */
  error?: string;
};

export type SmtpVerifyConfig = {
  host: string;
  port: number;
  secure?: boolean;
  username?: string;
  password?: string;
  rejectUnauthorized?: boolean;
  /** Teto de tempo para o handshake inteiro (default 8s). */
  timeoutMs?: number;
};

/**
 * Abre uma conexão SMTP real: TCP, TLS, EHLO e AUTH — o mesmo caminho de um envio,
 * sem a mensagem.
 *
 * O nodemailer ignora AbortSignal, então o teto de tempo vem dos três timeouts do
 * transporte; o chamador ainda deve manter o seu próprio guarda.
 */
export async function verifySmtpConnection(
  config: SmtpVerifyConfig,
): Promise<MailVerifyResult> {
  const nodemailer = await import('nodemailer');
  const timeout = config.timeoutMs ?? 8_000;

  const transportConfig: Record<string, unknown> = {
    host: config.host,
    port: config.port,
    secure: Boolean(config.secure),
    connectionTimeout: timeout,
    greetingTimeout: Math.min(timeout, 5_000),
    socketTimeout: timeout,
    tls: { rejectUnauthorized: config.rejectUnauthorized !== false },
  };

  // Servidor de relay interno costuma não pedir autenticação; forçar `auth` com
  // usuário vazio faria o handshake falhar por motivo errado.
  if (config.username && config.password) {
    transportConfig.auth = { user: config.username, pass: config.password };
  }

  const transporter = nodemailer.createTransport(transportConfig as any);
  try {
    await transporter.verify();
    return {
      ok: true,
      info: `${config.host}:${config.port}${config.username ? ` as ${config.username}` : ''}`,
    };
  } catch (error) {
    return { ok: false, error: describeSmtpError(error) };
  } finally {
    // Sem isso o socket fica aberto até o servidor derrubar por inatividade.
    try {
      transporter.close();
    } catch {
      /* nada a fazer: o teste já terminou */
    }
  }
}

export type SesVerifyConfig = {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  signal?: AbortSignal;
};

/**
 * Confirma credencial AWS **e** permissão de SES na região consultando a cota de envio
 * — chamada de leitura, sem custo e sem efeito colateral.
 */
export async function verifySesCredentials(
  config: SesVerifyConfig,
): Promise<MailVerifyResult> {
  const { SESClient, GetSendQuotaCommand } = await import('@aws-sdk/client-ses');

  const client = new SESClient({
    region: config.region,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  try {
    const quota = await client.send(new GetSendQuotaCommand({}), {
      ...(config.signal ? { abortSignal: config.signal } : {}),
    });
    const max = Number(quota.Max24HourSend ?? 0);
    return {
      ok: true,
      info: max
        ? `SES ${config.region} — up to ${max.toLocaleString('en-US')} emails/24h`
        : `SES ${config.region}`,
    };
  } catch (error) {
    return { ok: false, error: describeSesError(error) };
  } finally {
    client.destroy();
  }
}

export type ImapVerifyConfig = {
  host: string;
  port: number;
  /** `true` = IMAPS direto (993); `false` = 143 com STARTTLS. */
  secure?: boolean;
  username: string;
  password: string;
  /** Pasta cuja existencia se quer confirmar (default INBOX). */
  folder?: string;
  rejectUnauthorized?: boolean;
  timeoutMs?: number;
};

/**
 * Abre uma conexao IMAP real e confirma que a pasta existe e pode ser aberta.
 *
 * Autenticar so prova que a credencial vale; abrir a pasta e o que separa "a
 * senha esta certa" de "a caixa que voce digitou nao existe" — que e o erro que
 * de fato acontece quando alguem escreve `Inbox/Suporte` em vez de
 * `INBOX.Suporte`.
 */
export async function verifyImapConnection(
  config: ImapVerifyConfig,
): Promise<MailVerifyResult> {
  const { ImapFlow } = await import('imapflow');
  const timeout = config.timeoutMs ?? 10_000;
  const folder = config.folder?.trim() || 'INBOX';

  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure !== false,
    auth: { user: config.username, pass: config.password },
    // O imapflow loga cada comando IMAP em nivel debug por padrao, e isso inclui
    // a linha do LOGIN. Silenciar e o que impede a senha de cair no log.
    logger: false,
    tls: { rejectUnauthorized: config.rejectUnauthorized !== false },
    socketTimeout: timeout,
    greetingTimeout: Math.min(timeout, 5_000),
    connectionTimeout: timeout,
  });

  try {
    await client.connect();
    const mailbox = await client.mailboxOpen(folder, { readOnly: true });

    return {
      ok: true,
      info: `${config.host}:${config.port} — ${folder} (${mailbox.exists} message(s))`,
    };
  } catch (error) {
    return { ok: false, error: describeImapError(error, folder, config.host) };
  } finally {
    try {
      await client.logout();
    } catch {
      /* nada a fazer: o teste ja terminou */
    }
  }
}

function describeImapError(error: unknown, folder: string, host = ''): string {
  const err = error as {
    authenticationFailed?: boolean;
    responseText?: string;
    code?: string;
    message?: string;
  };
  const message = String(err?.responseText ?? err?.message ?? 'IMAP connection failed.');

  if (err?.authenticationFailed || /auth/i.test(message)) {
    // As duas causas comuns sao opostas e a mensagem precisa separa-las:
    //
    // - Google Workspace: a senha da CONTA nao serve, mas senha de app serve.
    // - Microsoft 365: nao ha o que fazer aqui. A Microsoft desligou a
    //   autenticacao basica de IMAP em 01/10/2022, em definitivo — senha de app
    //   tambem nao funciona. Mandar o operador "gerar uma senha de app" o faz
    //   perder tempo tentando algo impossivel.
    // Detecta pelo HOST, nao pelo texto do erro: o servidor responde apenas
    // "AUTHENTICATE failed", sem dizer quem e.
    const isMicrosoft = /outlook\.office|office365|outlook\.com/i.test(host);

    return isMicrosoft
      ? `IMAP authentication failed (${message}). Microsoft 365 permanently disabled Basic authentication for IMAP: a password — including an app password — will never work here. This mailbox needs an OAuth2-based profile.`
      : `IMAP authentication failed (${message}). With Google Workspace, use an app password, not the account password. Microsoft 365 does not accept passwords for IMAP at all.`;
  }
  if (/nonexistent|does not exist|no such mailbox/i.test(message)) {
    return `The folder "${folder}" does not exist on this account.`;
  }
  if (['ETIMEDOUT', 'ECONNREFUSED', 'ENOTFOUND', 'ESOCKET'].includes(String(err?.code ?? ''))) {
    return `Could not open an IMAP connection: ${message}`;
  }
  return message;
}

function describeSmtpError(error: unknown): string {
  const err = error as { code?: string; responseCode?: number; message?: string };
  const code = String(err?.code ?? '');
  const message = String(err?.message ?? 'SMTP connection failed.');

  if (code === 'EAUTH' || err?.responseCode === 535) {
    return 'SMTP authentication failed. Check the username and password.';
  }
  if (code === 'ETIMEDOUT' || code === 'ESOCKET' || code === 'ECONNECTION') {
    return `Could not open an SMTP connection: ${message}`;
  }
  return message;
}

function describeSesError(error: unknown): string {
  const err = error as { name?: string; message?: string };
  const name = String(err?.name ?? '');

  if (name === 'InvalidClientTokenId' || name === 'UnrecognizedClientException') {
    return 'Invalid AWS access key.';
  }
  if (name === 'SignatureDoesNotMatch') {
    return 'Invalid AWS secret access key.';
  }
  if (name === 'AccessDenied' || name === 'AccessDeniedException') {
    return 'These credentials have no permission to use SES in this region.';
  }
  return String(err?.message ?? 'Could not validate the SES credentials.');
}
