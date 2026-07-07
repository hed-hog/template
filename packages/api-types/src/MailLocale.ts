import { Locale } from './Locale';
import { Mail } from './Mail';

export type MailLocale = {
  id?: number;
  locale_id: number;
  mail_id: number;
  subject: string;
  body: string;
  created_at?: string;
  updated_at?: string;
  locale?: Locale;
  mail?: Mail;
}