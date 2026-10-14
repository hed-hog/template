import type { MailLayout } from './mail-template';
import { MailType } from './interfaces/mail-type';

export type MailAttachment = {
  filename?: string;
  content?: Buffer;
  contentType?: string;
};

export type Mail = {
  attachments?: MailAttachment[];
  /**
   * Cabecalhos extras da mensagem (ex.: `List-Unsubscribe`). Com cabecalho ou
   * anexo, o SES sai por `SendRawEmail`: o `SendEmail` simples nao carrega nenhum
   * dos dois.
   */
  headers?: Record<string, string>;
  mail_id?: number;
  /**
   * Envia o corpo verbatim, sem layout base. Para remetentes que ja montam o
   * proprio HTML (campanhas de marketing, relatorios).
   */
  skipLayout?: boolean;
  /** Layout explicito; ignora o lookup do layout padrao no banco. */
  layout?: MailLayout;
  /** Codigo do locale usado para resolver header/footer e o atributo lang. */
  locale?: string;
  /**
   * Cor da etapa que o e-mail comunica (confirmado, recusado, enviado...),
   * aplicada na barra de destaque do layout.
   *
   * Ausente => a cor da marca (`theme-primary-light`), que e o comportamento de
   * sempre: so quem informa este campo muda de aparencia.
   */
  accentColor?: string;
  /**
   * Chave do app de origem (ex.: "class", "training").
   *
   * Nao afeta mais a marca — desde que `{{brandName}}` passou a vir sempre de
   * `system-name`, este campo so carrega a procedencia do envio.
   */
  app?: string;
} & MailType;

export type MailConfig = {
  host?: string;
  from?: string;
  accessKeyId?: string;
  secretAccessKey?: string;
};

export const MAIL_MODULE_OPTIONS = 'MAIL_MODULE_OPTIONS';
