import type { MailLayout } from './mail-template';
import { MailType } from './interfaces/mail-type';

export type MailAttachment = {
  filename?: string;
  content?: Buffer;
  contentType?: string;
};

export type Mail = {
  attachments?: MailAttachment[];
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
