import type { PublicCaptchaConfig } from '@/components/captcha/public-captcha';

/** Espelha `task-intake-field-types.ts` da library operations. */
export type IntakeFieldType =
  | 'text'
  | 'textarea'
  | 'richtext'
  | 'email'
  | 'phone'
  | 'url'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'radio'
  | 'checkbox';

export type IntakeField = {
  slug: string;
  type: IntakeFieldType;
  label: string;
  placeholder: string | null;
  helpText: string | null;
  isRequired: boolean;
  options: Array<{ value: string; label: string }>;
  maxLength: number | null;
};

export type IntakeAnswer = string | boolean | string[];

export type FormConfig = {
  project: { name: string };
  captcha: PublicCaptchaConfig;
  limits: {
    maxFiles: number;
    maxImageBytes: number;
    maxVideoBytes: number;
    allowVideo: boolean;
    maxDocumentBytes?: number;
    allowDocuments?: boolean;
  };
  fields?: IntakeField[];
};

export type Attachment = {
  localId: string;
  name: string;
  mimetype: string;
  status: 'uploading' | 'done' | 'error';
  /** `blob:` da imagem, para o preview; revogado quando o anexo sai. */
  previewUrl?: string;
  token?: string;
  error?: string;
};

/** Formulario de antes dos campos configuraveis, para config sem `fields`. */
export const FALLBACK_FIELDS: IntakeField[] = [
  {
    slug: 'description',
    type: 'textarea',
    label: 'O que aconteceu?',
    placeholder: 'Conte o que você esperava, o que aconteceu e onde.',
    helpText: null,
    isRequired: true,
    options: [],
    maxLength: 5000,
  },
];

/** Teto por tipo quando o campo nao define o seu; igual ao do backend. */
const DEFAULT_MAX_LENGTH: Partial<Record<IntakeFieldType, number>> = {
  text: 500,
  textarea: 5000,
  richtext: 20000,
  email: 180,
  phone: 40,
  url: 2000,
};

export function maxLengthOf(field: IntakeField): number | null {
  return field.maxLength ?? DEFAULT_MAX_LENGTH[field.type] ?? null;
}

/** Texto visivel de um HTML do editor, para contar caracteres e ver se esta vazio. */
export function htmlToText(html: string): string {
  if (typeof document === 'undefined') {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const element = document.createElement('div');
  element.innerHTML = html;
  return (element.textContent ?? '').replace(/ /g, ' ').trim();
}

export function initialAnswer(field: IntakeField): IntakeAnswer {
  if (field.type === 'checkbox') return false;
  if (field.type === 'multiselect') return [];
  return '';
}

export function isAnswerEmpty(field: IntakeField, value: IntakeAnswer): boolean {
  if (field.type === 'checkbox') return value !== true;
  if (Array.isArray(value)) return value.length === 0;
  const text = String(value ?? '');
  return field.type === 'richtext' ? !htmlToText(text) : !text.trim();
}
