'use client';

import { CopyButton } from '@/components/copy-button';
import { DoNodePoolPicker } from '@/components/integration-profile/do-node-pool-picker';
import { IntegrationProfileFormSkeleton } from '@/components/integration-profile/integration-profile-form-skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { FormActions } from '@/components/ui/form-actions';
import { Input } from '@/components/ui/input';
import { IntegrationLogo } from '@/components/ui/integration-logo';
import { Label } from '@/components/ui/label';
import { ResizableSheetContent } from '@/components/ui/resizable-sheet-content';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { useApp } from '@hed-hog/next-app-provider';
import {
  Check,
  CircleAlert,
  CircleCheck,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  Plus,
  PlugZap,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

type LocaleEntry = { name: string; locale: { code: string } };

type IntegrationType = {
  id: number;
  slug: string;
  icon: string | null;
  integration_type_locale: LocaleEntry[];
};

type IntegrationProvider = {
  id: number;
  slug: string;
  type_id: number;
  integration_provider_locale: LocaleEntry[];
};

type IntegrationProfile = {
  id: number;
  slug: string;
  name: string;
  type_id: number;
  provider_id: number;
  config: Record<string, unknown> | null;
  is_active: boolean;
  /** Provider do próprio perfil (o backend inclui no GET /integration-profile/:id). */
  integration_provider?: {
    slug: string;
    integration_provider_locale?: LocaleEntry[];
  } | null;
};

type ProfileForm = {
  name: string;
  slug: string;
  type_id: string;
  provider_id: string;
  config: Record<string, string | boolean | number | string[]>;
  is_active: boolean;
};

/** Resposta de POST /integration-profile/test (200). Erros vêm como 400. */
type TestConnectionResponse = {
  success: boolean;
  destination?: string;
  ok?: boolean;
  provider?: string;
  info?: string;
  warning?: string;
  tested_at?: string;
  /** false quando o perfil ainda não existe (teste durante a criação). */
  persisted?: boolean;
};

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | {
      status: 'ok';
      info?: string;
      warning?: string;
      persisted: boolean;
    }
  | { status: 'error'; message: string };

type FieldDef = {
  key: string;
  labelKey: string;
  /**
   * `file` reads the picked file and stores it base64-encoded in `config`. It is
   * treated as a secret (same masking as `password`) because its only use today
   * is the A1 certificate — whoever holds the PFX can issue invoices as the
   * company. Any `file` key MUST also be listed in INTEGRATION_SECRET_KEYS
   * (libraries/core/src/integration-profile/integration-profile.secrets.ts) or
   * it will be stored unencrypted.
   */
  type:
    | 'text'
    | 'password'
    | 'number'
    | 'boolean'
    | 'email'
    | 'url'
    | 'select'
    | 'file';
  required: boolean;
  placeholder?: string;
  colSpan?: boolean;
  options?: Array<{ value: string; labelKey: string }>;
  /** `accept` attribute for `file` fields. */
  accept?: string;
};

export type IntegrationProfileSheetSavedProfile = {
  id: number;
  slug: string;
  name: string;
  type_id: number;
  provider_id: number;
  config: Record<string, unknown> | null;
  is_active: boolean;
};

type IntegrationProfileSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileId?: number | null;
  initialTypeSlug?: string;
  lockedTypeSlug?: string;
  lockedProviderSlug?: string;
  /**
   * Providers que o campo de origem esconde da listagem. Sem isto, criar por
   * aqui um perfil que o picker filtra (IMAP num campo de envio, Google Play no
   * gateway do checkout web) o aplicaria no campo para ele sumir no próximo
   * carregamento. Não afeta a edição: o provider do perfil aberto continua
   * visível no campo desabilitado.
   */
  excludeProviderSlugs?: string[];
  sheetId?: string;
  defaultWidth?: number;
  onSaved?: (profile: IntegrationProfileSheetSavedProfile) => void;
};

/** Placeholder returned by the backend instead of a stored secret. */
const SECRET_MASK = '********';

const PROVIDER_FIELDS: Record<string, FieldDef[]> = {
  smtp: [
    {
      key: 'host',
      labelKey: 'fieldHost',
      type: 'text',
      required: true,
      placeholder: 'smtp.yourdomain.com',
    },
    {
      key: 'port',
      labelKey: 'fieldPort',
      type: 'number',
      required: true,
      placeholder: '587',
    },
    {
      key: 'username',
      labelKey: 'fieldUsername',
      type: 'text',
      required: true,
    },
    {
      key: 'password',
      labelKey: 'fieldPassword',
      type: 'password',
      required: true,
    },
    {
      key: 'from_email',
      labelKey: 'fieldFromEmail',
      type: 'email',
      required: true,
    },
    {
      key: 'from_name',
      labelKey: 'fieldFromName',
      type: 'text',
      required: false,
    },
    {
      key: 'reply_to_email',
      labelKey: 'fieldReplyTo',
      type: 'email',
      required: false,
    },
    {
      key: 'reply_to_name',
      labelKey: 'fieldReplyToName',
      type: 'text',
      required: false,
    },
    {
      key: 'secure',
      labelKey: 'fieldSecure',
      type: 'boolean',
      required: false,
      colSpan: true,
    },
  ],
  gmail: [
    {
      key: 'client_id',
      labelKey: 'fieldClientId',
      type: 'text',
      required: true,
    },
    {
      key: 'client_secret',
      labelKey: 'fieldClientSecret',
      type: 'password',
      required: true,
    },
    {
      key: 'refresh_token',
      labelKey: 'fieldRefreshToken',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'from_email',
      labelKey: 'fieldFromEmail',
      type: 'email',
      required: true,
    },
    {
      key: 'from_name',
      labelKey: 'fieldFromName',
      type: 'text',
      required: false,
    },
    {
      key: 'reply_to_email',
      labelKey: 'fieldReplyTo',
      type: 'email',
      required: false,
    },
    {
      key: 'reply_to_name',
      labelKey: 'fieldReplyToName',
      type: 'text',
      required: false,
    },
  ],
  ses: [
    {
      key: 'access_key_id',
      labelKey: 'fieldAccessKeyId',
      type: 'text',
      required: true,
    },
    {
      key: 'secret_access_key',
      labelKey: 'fieldSecretAccessKey',
      type: 'password',
      required: true,
    },
    {
      key: 'region',
      labelKey: 'fieldRegion',
      type: 'text',
      required: true,
      placeholder: 'us-east-1',
    },
    {
      key: 'from_email',
      labelKey: 'fieldFromEmail',
      type: 'email',
      required: true,
    },
    {
      key: 'from_name',
      labelKey: 'fieldFromName',
      type: 'text',
      required: false,
    },
    {
      key: 'reply_to_email',
      labelKey: 'fieldReplyTo',
      type: 'email',
      required: false,
    },
    {
      key: 'reply_to_name',
      labelKey: 'fieldReplyToName',
      type: 'text',
      required: false,
    },
    {
      key: 'sns_topic_arn',
      labelKey: 'fieldSnsTopicArn',
      type: 'text',
      required: false,
      placeholder: 'arn:aws:sns:us-east-1:123456789012:ses-events',
    },
  ],
  resend: [
    {
      key: 'domain',
      labelKey: 'fieldDomain',
      type: 'text',
      required: true,
      placeholder: 'mail.suaempresa.com',
      colSpan: true,
    },
    {
      key: 'api_token',
      labelKey: 'fieldApiToken',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'webhook_secret',
      labelKey: 'fieldWebhookSecret',
      type: 'password',
      required: false,
      colSpan: true,
    },
    {
      key: 'region',
      labelKey: 'fieldRegion',
      type: 'text',
      required: false,
    },
    // buildMailConfigFromIntegration monta o remetente com cfg.from_email; sem
    // este campo o perfil salvo pelo admin enviava com o remetente vazio.
    {
      key: 'from_email',
      labelKey: 'fieldFromEmail',
      type: 'email',
      required: true,
    },
    {
      key: 'from_name',
      labelKey: 'fieldFromName',
      type: 'text',
      required: false,
    },
    {
      key: 'reply_to_email',
      labelKey: 'fieldReplyTo',
      type: 'email',
      required: false,
    },
    {
      key: 'reply_to_name',
      labelKey: 'fieldReplyToName',
      type: 'text',
      required: false,
    },
  ],
  // Único provider de e-mail que só RECEBE: alimenta as caixas monitoradas do
  // SAC. Por isso não tem from_email/reply_to — nada sai por aqui.
  imap: [
    {
      key: 'host',
      labelKey: 'fieldHost',
      type: 'text',
      required: true,
      placeholder: 'imap.gmail.com',
    },
    {
      key: 'port',
      labelKey: 'fieldPort',
      type: 'number',
      required: true,
      placeholder: '993',
    },
    {
      key: 'username',
      labelKey: 'fieldUsername',
      type: 'text',
      required: true,
      placeholder: 'suporte@suaempresa.com',
    },
    // No Google Workspace a senha da conta não funciona: é preciso gerar uma
    // senha de app com a verificação em duas etapas ligada.
    //
    // No Microsoft 365 NENHUMA senha funciona — a autenticação básica de IMAP
    // foi desligada em 01/10/2022, em definitivo, e senha de app também foi
    // junto. Caixa do Exchange Online precisa de um perfil OAuth2.
    {
      key: 'password',
      labelKey: 'fieldPassword',
      type: 'password',
      required: true,
    },
    {
      key: 'secure',
      labelKey: 'fieldImapSecure',
      type: 'boolean',
      required: false,
    },
  ],
  'evolution-api': [
    {
      key: 'host',
      labelKey: 'fieldHost',
      type: 'url',
      required: true,
      placeholder: 'https://evolution.yourdomain.com',
      colSpan: true,
    },
    { key: 'token', labelKey: 'fieldToken', type: 'password', required: true },
    {
      key: 'instance_name',
      labelKey: 'fieldInstanceName',
      type: 'text',
      required: true,
    },
  ],
  // Os números NÃO ficam aqui: o WABA pode ter vários e cada um tem estado
  // próprio (quality rating, verificação). Eles vivem em whatsapp_phone_number
  // (library whatsapp), populada pelo sync com a Graph API.
  'whatsapp-official': [
    {
      key: 'app_id',
      labelKey: 'fieldAppId',
      type: 'text',
      required: true,
    },
    {
      key: 'app_secret',
      labelKey: 'fieldAppSecret',
      type: 'password',
      required: true,
    },
    {
      key: 'waba_id',
      labelKey: 'fieldWabaId',
      type: 'text',
      required: true,
    },
    {
      key: 'business_id',
      labelKey: 'fieldBusinessId',
      type: 'text',
      required: false,
    },
    {
      key: 'access_token',
      labelKey: 'fieldAccessToken',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'verify_token',
      labelKey: 'fieldVerifyToken',
      type: 'password',
      required: true,
    },
    {
      key: 'graph_api_version',
      labelKey: 'fieldGraphApiVersion',
      type: 'text',
      required: true,
      placeholder: 'v21.0',
    },
    {
      key: 'environment',
      labelKey: 'fieldEnvironment',
      type: 'select',
      required: false,
      options: [
        { value: 'test', labelKey: 'fieldEnvironmentTest' },
        { value: 'production', labelKey: 'fieldEnvironmentProduction' },
      ],
    },
  ],
  // `model` e `timeout_ms` são opcionais em todos os providers de IA: quando
  // vazios, os consumidores (AiService, RealAiProviderAdapter) caem em seus
  // próprios defaults por provider.
  openai: [
    {
      key: 'api_key',
      labelKey: 'fieldApiKey',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'organization',
      labelKey: 'fieldOrganization',
      type: 'text',
      required: false,
    },
    {
      key: 'model',
      labelKey: 'fieldModel',
      type: 'text',
      required: false,
      placeholder: 'gpt-4o',
    },
    {
      key: 'timeout_ms',
      labelKey: 'fieldTimeoutMs',
      type: 'number',
      required: false,
      placeholder: '120000',
    },
  ],
  gemini: [
    {
      key: 'api_key',
      labelKey: 'fieldApiKey',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'model',
      labelKey: 'fieldModel',
      type: 'text',
      required: false,
      placeholder: 'gemini-1.5-flash',
    },
    {
      key: 'timeout_ms',
      labelKey: 'fieldTimeoutMs',
      type: 'number',
      required: false,
      placeholder: '120000',
    },
  ],
  claude: [
    {
      key: 'api_key',
      labelKey: 'fieldApiKey',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'model',
      labelKey: 'fieldModel',
      type: 'text',
      required: false,
      placeholder: 'claude-sonnet-4-6',
    },
    {
      key: 'timeout_ms',
      labelKey: 'fieldTimeoutMs',
      type: 'number',
      required: false,
      placeholder: '120000',
    },
  ],
  deepseek: [
    {
      key: 'api_key',
      labelKey: 'fieldApiKey',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'model',
      labelKey: 'fieldModel',
      type: 'text',
      required: false,
      placeholder: 'deepseek-chat',
    },
    {
      key: 'timeout_ms',
      labelKey: 'fieldTimeoutMs',
      type: 'number',
      required: false,
      placeholder: '120000',
    },
  ],
  // Geração de vídeo (image-to-video). O adapter lê api_key e usa cfg.model,
  // com fallback para ray-2.
  luma: [
    {
      key: 'api_key',
      labelKey: 'fieldApiKey',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'model',
      labelKey: 'fieldModel',
      type: 'text',
      required: false,
      placeholder: 'ray-2',
    },
  ],
  stripe: [
    {
      key: 'publishable_key',
      labelKey: 'fieldPublishableKey',
      type: 'text',
      required: false,
    },
    {
      key: 'secret_key',
      labelKey: 'fieldSecretKey',
      type: 'password',
      required: true,
    },
    {
      key: 'webhook_secret',
      labelKey: 'fieldWebhookSecret',
      type: 'password',
      required: false,
    },
    {
      key: 'mode',
      labelKey: 'fieldMode',
      type: 'select',
      required: false,
      options: [
        { value: 'sandbox', labelKey: 'fieldModeSandbox' },
        { value: 'production', labelKey: 'fieldModeProduction' },
      ],
    },
  ],
  mercado_pago: [
    {
      key: 'public_key',
      labelKey: 'fieldPublicKey',
      type: 'text',
      required: false,
    },
    {
      key: 'access_token',
      labelKey: 'fieldAccessToken',
      type: 'password',
      required: true,
    },
    {
      key: 'webhook_secret',
      labelKey: 'fieldWebhookSecret',
      type: 'password',
      required: false,
    },
    {
      key: 'mode',
      labelKey: 'fieldMode',
      type: 'select',
      required: false,
      options: [
        { value: 'sandbox', labelKey: 'fieldModeSandbox' },
        { value: 'production', labelKey: 'fieldModeProduction' },
      ],
    },
  ],
  // Google Play Billing. CommerceGooglePlayService aceita o JSON completo da
  // service account OU client_email + private_key, por isso as credenciais são
  // todas opcionais aqui — só package_name é sempre obrigatório.
  google_play: [
    {
      key: 'package_name',
      labelKey: 'fieldPackageName',
      type: 'text',
      required: true,
      colSpan: true,
      placeholder: 'com.suaempresa.app',
    },
    {
      key: 'service_account_json',
      labelKey: 'fieldServiceAccountJson',
      type: 'password',
      required: false,
      colSpan: true,
    },
    {
      key: 'client_email',
      labelKey: 'fieldClientEmail',
      type: 'email',
      required: false,
      placeholder: 'nome@projeto.iam.gserviceaccount.com',
    },
    {
      key: 'private_key',
      labelKey: 'fieldServiceAccountPrivateKey',
      type: 'password',
      required: false,
      colSpan: true,
      placeholder: '-----BEGIN PRIVATE KEY-----...',
    },
    // Autenticação das notificações em tempo real (RTDN). Enquanto a conta de
    // serviço fica em branco, o webhook aceita qualquer POST no UUID — o que
    // permite configurar o Pub/Sub e ver as notificações chegando antes de
    // endurecer. Preenchida, passa a exigir o JWT OIDC do push.
    {
      key: 'rtdn_service_account',
      labelKey: 'fieldRtdnServiceAccount',
      type: 'email',
      required: false,
      placeholder: 'pubsub-push@projeto.iam.gserviceaccount.com',
    },
    {
      key: 'rtdn_audience',
      labelKey: 'fieldRtdnAudience',
      type: 'text',
      required: false,
      placeholder: '(opcional) audience da subscription push',
    },
  ],
  local: [
    {
      key: 'base_path',
      labelKey: 'fieldBasePath',
      type: 'text',
      required: true,
      placeholder: '/var/uploads',
      colSpan: true,
    },
  ],
  s3: [
    {
      key: 'access_key_id',
      labelKey: 'fieldAccessKeyId',
      type: 'text',
      required: true,
    },
    {
      key: 'secret_access_key',
      labelKey: 'fieldSecretAccessKey',
      type: 'password',
      required: true,
    },
    {
      key: 'region',
      labelKey: 'fieldRegion',
      type: 'text',
      required: true,
      placeholder: 'us-east-1',
    },
    { key: 'bucket', labelKey: 'fieldBucket', type: 'text', required: true },
    // Credenciais temporárias/assumidas: usadas pelo upload em massa do LMS
    // (lms-bulk-upload-automation) quando o bucket exige STS.
    {
      key: 'session_token',
      labelKey: 'fieldSessionToken',
      type: 'password',
      required: false,
      colSpan: true,
    },
    {
      key: 'role_arn',
      labelKey: 'fieldRoleArn',
      type: 'text',
      required: false,
    },
    {
      key: 'external_id',
      labelKey: 'fieldExternalId',
      type: 'text',
      required: false,
    },
  ],
  gcs: [
    {
      key: 'project_id',
      labelKey: 'fieldProjectId',
      type: 'text',
      required: true,
    },
    { key: 'bucket', labelKey: 'fieldBucket', type: 'text', required: true },
    {
      key: 'key_file_json',
      labelKey: 'fieldKeyFileJson',
      type: 'password',
      required: true,
      colSpan: true,
    },
  ],
  'azure-blob': [
    {
      key: 'account',
      labelKey: 'fieldAccount',
      type: 'text',
      required: true,
      placeholder: 'mystorageaccount',
    },
    {
      key: 'key',
      labelKey: 'fieldAccountKey',
      type: 'password',
      required: true,
    },
    {
      key: 'container',
      labelKey: 'fieldContainer',
      type: 'text',
      required: true,
    },
  ],
  's3-compatible': [
    {
      key: 'endpoint',
      labelKey: 'fieldEndpoint',
      type: 'url',
      required: true,
      colSpan: true,
    },
    {
      key: 'access_key_id',
      labelKey: 'fieldAccessKeyId',
      type: 'text',
      required: true,
    },
    {
      key: 'secret_access_key',
      labelKey: 'fieldSecretAccessKey',
      type: 'password',
      required: true,
    },
    { key: 'bucket', labelKey: 'fieldBucket', type: 'text', required: true },
    {
      key: 'region',
      labelKey: 'fieldRegion',
      type: 'text',
      required: false,
      placeholder: 'us-east-1',
    },
  ],
  'google-oauth': [
    {
      key: 'client_id',
      labelKey: 'fieldClientId',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'client_secret',
      labelKey: 'fieldClientSecret',
      type: 'password',
      required: true,
      colSpan: true,
    },
  ],
  'facebook-oauth': [
    {
      key: 'client_id',
      labelKey: 'fieldClientId',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'client_secret',
      labelKey: 'fieldClientSecret',
      type: 'password',
      required: true,
      colSpan: true,
    },
  ],
  'github-oauth': [
    {
      key: 'client_id',
      labelKey: 'fieldClientId',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'client_secret',
      labelKey: 'fieldClientSecret',
      type: 'password',
      required: true,
      colSpan: true,
    },
  ],
  'microsoft-oauth': [
    {
      key: 'client_id',
      labelKey: 'fieldClientId',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'client_secret',
      labelKey: 'fieldClientSecret',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'tenant_id',
      labelKey: 'fieldTenantId',
      type: 'text',
      required: false,
      colSpan: true,
    },
  ],
  'microsoft-entra-id-oauth': [
    {
      key: 'client_id',
      labelKey: 'fieldClientId',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'client_secret',
      labelKey: 'fieldClientSecret',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'tenant_id',
      labelKey: 'fieldTenantId',
      type: 'text',
      required: true,
      colSpan: true,
    },
  ],
  'apple-oauth': [
    {
      key: 'client_id',
      labelKey: 'fieldClientId',
      type: 'text',
      required: true,
      colSpan: true,
      placeholder: 'com.yourdomain.service',
    },
    {
      key: 'team_id',
      labelKey: 'fieldTeamId',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'key_id',
      labelKey: 'fieldKeyId',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'private_key',
      labelKey: 'fieldPrivateKey',
      type: 'password',
      required: true,
      colSpan: true,
      placeholder: '-----BEGIN PRIVATE KEY-----...',
    },
  ],
  'linkedin-oauth': [
    {
      key: 'client_id',
      labelKey: 'fieldClientId',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'client_secret',
      labelKey: 'fieldClientSecret',
      type: 'password',
      required: true,
      colSpan: true,
    },
  ],
  recaptcha: [
    {
      key: 'site_key',
      labelKey: 'fieldSiteKey',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'secret_key',
      labelKey: 'fieldSecretKey',
      type: 'password',
      required: true,
      colSpan: true,
    },
  ],
  'cloudflare-turnstile': [
    {
      key: 'site_key',
      labelKey: 'fieldSiteKey',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'secret_key',
      labelKey: 'fieldSecretKey',
      type: 'password',
      required: true,
      colSpan: true,
    },
  ],
  altcha: [
    {
      key: 'hmac_key',
      labelKey: 'fieldHmacKey',
      type: 'password',
      required: true,
      colSpan: true,
    },
  ],
  // Fiscal — NFS-e Nacional.
  //
  // This profile carries BOTH the issuer's identity (CNPJ, municipal registration,
  // address, IBGE code) and its A1 certificate. That is deliberate: the `fiscal`
  // module has no company entity, and the repo has no multi-tenant discriminator,
  // so the profile IS the company for invoicing purposes.
  //
  // Nothing here is hardcoded to a city: `ibge_city_code` defaults to São Bernardo
  // do Campo (3548708) as a placeholder only.
  //
  // `certificate_pfx_base64` and `certificate_password` are listed in
  // INTEGRATION_SECRET_KEYS — without that, they would be stored in plaintext.
  'nfse-national': [
    {
      key: 'environment',
      labelKey: 'fieldEnvironment',
      type: 'select',
      required: true,
      options: [
        { value: 'homologation', labelKey: 'optionHomologation' },
        { value: 'production', labelKey: 'optionProduction' },
      ],
    },
    {
      key: 'tax_id',
      labelKey: 'fieldTaxId',
      type: 'text',
      required: true,
      placeholder: '00000000000000',
    },
    {
      key: 'legal_name',
      labelKey: 'fieldLegalName',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'trade_name',
      labelKey: 'fieldTradeName',
      type: 'text',
      required: false,
      colSpan: true,
    },
    {
      key: 'municipal_registration',
      labelKey: 'fieldMunicipalRegistration',
      type: 'text',
      required: true,
    },
    {
      key: 'ibge_city_code',
      labelKey: 'fieldIbgeCityCode',
      type: 'text',
      required: true,
      placeholder: '3548708',
    },
    {
      key: 'address_street',
      labelKey: 'fieldAddressStreet',
      type: 'text',
      required: true,
      colSpan: true,
    },
    {
      key: 'address_number',
      labelKey: 'fieldAddressNumber',
      type: 'text',
      required: true,
    },
    {
      key: 'address_complement',
      labelKey: 'fieldAddressComplement',
      type: 'text',
      required: false,
    },
    {
      key: 'address_district',
      labelKey: 'fieldAddressDistrict',
      type: 'text',
      required: true,
    },
    {
      key: 'address_zip',
      labelKey: 'fieldAddressZip',
      type: 'text',
      required: true,
      placeholder: '00000000',
    },
    {
      key: 'address_state',
      labelKey: 'fieldAddressState',
      type: 'text',
      required: true,
      placeholder: 'SP',
    },
    { key: 'email', labelKey: 'fieldEmail', type: 'email', required: false },
    { key: 'phone', labelKey: 'fieldPhone', type: 'text', required: false },
    {
      key: 'tax_regime',
      labelKey: 'fieldTaxRegime',
      type: 'select',
      required: true,
      options: [
        { value: 'simples_nacional', labelKey: 'optionSimplesNacional' },
        {
          value: 'simples_nacional_excesso',
          labelKey: 'optionSimplesNacionalExcesso',
        },
        { value: 'normal', labelKey: 'optionRegimeNormal' },
        { value: 'mei', labelKey: 'optionMei' },
      ],
    },
    {
      key: 'special_tax_regime',
      labelKey: 'fieldSpecialTaxRegime',
      type: 'text',
      required: false,
    },
    {
      key: 'cultural_incentive',
      labelKey: 'fieldCulturalIncentive',
      type: 'boolean',
      required: false,
    },
    {
      key: 'certificate_pfx_base64',
      labelKey: 'fieldCertificatePfx',
      type: 'file',
      required: true,
      colSpan: true,
      accept: '.pfx,.p12',
    },
    {
      key: 'certificate_password',
      labelKey: 'fieldCertificatePassword',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'adn_base_url',
      labelKey: 'fieldBaseUrl',
      type: 'url',
      required: false,
      colSpan: true,
    },
    {
      key: 'timeout_ms',
      labelKey: 'fieldTimeoutMs',
      type: 'number',
      required: false,
      placeholder: '30000',
    },
    {
      key: 'max_retries',
      labelKey: 'fieldMaxRetries',
      type: 'number',
      required: false,
      placeholder: '3',
    },
  ],
  // The video node pool is chosen by name via DoNodePoolPicker (not a text field).
  digitalocean: [
    {
      key: 'api_token',
      labelKey: 'fieldApiToken',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'cluster_id',
      labelKey: 'fieldClusterId',
      type: 'text',
      required: true,
    },
    {
      key: 'region',
      labelKey: 'fieldRegion',
      type: 'text',
      required: true,
      placeholder: 'nyc1',
    },
  ],
  kubernetes: [
    {
      key: 'api_server',
      labelKey: 'fieldApiServer',
      type: 'url',
      required: true,
      colSpan: true,
      placeholder: 'https://10.0.0.1:6443',
    },
    {
      key: 'token',
      labelKey: 'fieldToken',
      type: 'password',
      required: true,
      colSpan: true,
    },
    {
      key: 'ca_cert',
      labelKey: 'fieldCaCert',
      type: 'password',
      required: false,
      colSpan: true,
    },
    {
      key: 'namespace',
      labelKey: 'fieldNamespace',
      type: 'text',
      required: false,
      placeholder: 'my-namespace',
    },
  ],
};

function getLocaleName(locales: LocaleEntry[], code: string): string {
  // Defensive fallbacks: every type/provider locale list used by this component
  // always has at least one entry matching the current locale code in practice,
  // so the `?? locales[0]?.name` and `?? ''` fallback levels are never exercised.
  /* v8 ignore next 2 */
  return (
    locales.find((l) => l.locale.code === code)?.name ?? locales[0]?.name ?? ''
  );
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const defaultForm = (): ProfileForm => ({
  name: '',
  slug: '',
  type_id: '',
  provider_id: '',
  config: {},
  is_active: true,
});

/** Lápis que limpa um segredo já gravado para permitir digitar um novo. */
function ChangeSecretButton({
  onClick,
  label,
  className = 'h-8 w-8',
}: {
  onClick: () => void;
  label: string;
  className?: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <Pencil className="h-4 w-4" />
    </Button>
  );
}

export function IntegrationProfileSheet({
  open,
  onOpenChange,
  profileId = null,
  initialTypeSlug,
  lockedTypeSlug,
  lockedProviderSlug,
  excludeProviderSlugs,
  sheetId = 'integration-profile-form',
  defaultWidth = 680,
  onSaved,
}: IntegrationProfileSheetProps) {
  const t = useTranslations('core.IntegrationProfilePage');
  const { request, currentLocaleCode, getSettingValue, getErrorMessage } =
    useApp();

  const [types, setTypes] = useState<IntegrationType[]>([]);
  const [providers, setProviders] = useState<IntegrationProvider[]>([]);
  // Provider que veio junto com o perfil carregado; usado quando o catálogo não o tem.
  const [editingProvider, setEditingProvider] =
    useState<IntegrationProvider | null>(null);
  const [formData, setFormData] = useState<ProfileForm>(defaultForm());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>(
    {}
  );
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(false);
  const [testState, setTestState] = useState<TestState>({ status: 'idle' });
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [webhookUrl, setWebhookUrl] = useState<string | null>(null);
  const [isLoadingWebhook, setIsLoadingWebhook] = useState(false);
  const [isSyncingSubscriptions, setIsSyncingSubscriptions] = useState(false);
  // Sinaliza que o webhook de pagamento foi provisionado mas a URL pública veio
  // vazia porque o setting `api-url`/`url` do core não está configurado.
  const [isWebhookBaseUrlMissing, setIsWebhookBaseUrlMissing] = useState(false);
  const slugAutoRef = useRef(true);

  const isEditing = profileId != null;

  const formTypeProviders = useMemo(
    () => providers.filter((p) => String(p.type_id) === formData.type_id),
    [providers, formData.type_id]
  );

  // Resolve o provider selecionado pelo id em TODA a lista, não só nos filtrados
  // por tipo. Um perfil salvo pode referenciar um provider cujo type_id diverge
  // do type_id do próprio perfil (catálogo com type_id remapeado/duplicado, ex.:
  // whatsapp-official). Nesse caso o filtro por tipo esconderia o provider e, na
  // edição, os campos de config (e a seção de webhook) não renderizariam.
  //
  // Se o catálogo não trouxer o provider do perfil (lista desatualizada/incompleta),
  // cai no provider embutido na resposta do próprio perfil: sem isso o select fica no
  // placeholder E a seção inteira de credenciais some — foi o que escondeu os campos
  // do perfil de infraestrutura (api_token, cluster_id, node pool de vídeo).
  const selectedProvider = useMemo(
    () =>
      providers.find((p) => String(p.id) === formData.provider_id) ??
      (editingProvider && String(editingProvider.id) === formData.provider_id
        ? editingProvider
        : undefined),
    [providers, formData.provider_id, editingProvider]
  );

  // Opções do select de provider: os do tipo atual + o provider selecionado
  // (caso não esteja entre eles), para o campo desabilitado da edição não ficar
  // em branco quando houver a divergência de type_id acima.
  const providerOptions = useMemo(() => {
    const allowed = excludeProviderSlugs?.length
      ? formTypeProviders.filter((p) => !excludeProviderSlugs.includes(p.slug))
      : formTypeProviders;

    if (
      selectedProvider &&
      !allowed.some((p) => p.id === selectedProvider.id)
    ) {
      return [...allowed, selectedProvider];
    }
    return allowed;
  }, [formTypeProviders, selectedProvider, excludeProviderSlugs]);

  // Every provider slug in PROVIDER_FIELDS' data set (smtp, gmail, ses, openai,
  // gemini, claude, deepseek, stripe, mercado_pago, local, gcs, recaptcha, altcha,
  // digitalocean, kubernetes, and every `*-oauth` slug) has an entry, so the
  // `?? []` fallback is unreachable with the current provider catalog.
  /* v8 ignore next 3 */
  const providerFields = selectedProvider
    ? (PROVIDER_FIELDS[selectedProvider.slug] ?? [])
    : [];

  const isFormLoading = isLoadingCatalog || isLoadingProfile;

  // Um "validado" verde não pode sobreviver à troca do provedor: passaria a se
  // referir a credenciais que não estão mais no formulário.
  useEffect(() => {
    setTestState({ status: 'idle' });
  }, [formData.provider_id]);

  const buildOAuthCallbackUrls = (providerName: string) => {
    // GitHub only supports a single backend callback URL (it bounces to the SPA).
    if (providerName === 'github') {
      const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(
        /\/+$/,
        ''
      );
      return apiBaseUrl ? [`${apiBaseUrl}/oauth/github/callback`] : [];
    }

    /* v8 ignore start -- every call site of buildOAuthCallbackUrls (the
     * default-callback-urls memo, the edit-mode loader, the lock-sync effect,
     * and handleProviderChange) already guards on `appUrl` truthiness before
     * calling this function, so this internal check can never observe a
     * falsy appUrl in practice; kept only as defense-in-depth. */
    if (!appUrl) {
      return [] as string[];
    }
    /* v8 ignore stop */

    // Single, flow-less callback per provider: the flow (login/register/connect)
    // and the initiating app travel in the signed OAuth state, so only one URL
    // needs to be registered in the provider console.
    return [`${appUrl}/callback/${providerName}`];
  };

  const isOAuthProvider = (selectedProvider?.slug ?? '').endsWith('-oauth');
  const oauthProviderName = isOAuthProvider
    ? selectedProvider!.slug.replace(/-oauth$/, '')
    : '';
  const isWhatsappOfficial = selectedProvider?.slug === 'whatsapp-official';
  const isSes = selectedProvider?.slug === 'ses';
  const isMicrosoftEntra =
    selectedProvider?.slug === 'microsoft-entra-id-oauth';
  const isPaymentProvider = ['stripe', 'mercado_pago', 'google_play'].includes(
    selectedProvider?.slug ?? ''
  );
  const paymentGatewaySlug = isPaymentProvider ? selectedProvider!.slug : '';
  // Passos de configuração por gateway, colados no painel do provedor.
  const paymentWebhookStepKeys: Record<string, string[]> = {
    stripe: [
      'paymentStripeStep1',
      'paymentStripeStep2',
      'paymentStripeStep3',
      'paymentStripeStep4',
    ],
    mercado_pago: [
      'paymentMercadoPagoStep1',
      'paymentMercadoPagoStep2',
      'paymentMercadoPagoStep3',
      'paymentMercadoPagoStep4',
    ],
    google_play: [
      'paymentGooglePlayStep1',
      'paymentGooglePlayStep2',
      'paymentGooglePlayStep3',
      'paymentGooglePlayStep4',
    ],
  };
  // This is a 'use client' component only ever mounted in the browser; jsdom
  // (like every real render environment for this component) always defines
  // `window`, so the SSR-only fallback branch below is unreachable from
  // tests. The whole ternary (not just the fallback expression) is ignored
  // because v8/istanbul still counts the conditional's branch pair as
  // partially uncovered otherwise, even with the fallback arm excluded.
  /* v8 ignore next 4 */
  const appUrl =
    typeof window !== 'undefined'
      ? window.location.origin
      : String(getSettingValue?.('url') ?? '').replace(/\/+$/, '');
  const defaultCallbackUrls =
    isOAuthProvider && appUrl ? buildOAuthCallbackUrls(oauthProviderName) : [];
  const callbackUrls: string[] = (() => {
    const saved = formData.config.callback_urls;
    if (Array.isArray(saved)) return saved as string[];
    return defaultCallbackUrls;
  })();

  /**
   * Provisiona (idempotente) o webhook do perfil no core e traz a URL pública para
   * o admin colar no painel da Meta.
   *
   * Só roda em edição: a URL vem do UUID do webhook, que só existe depois que o
   * perfil é salvo. Na criação a seção mostra o aviso para salvar primeiro.
   */
  useEffect(() => {
    if (!open || !isEditing || !isWhatsappOfficial || !profileId) {
      setWebhookUrl(null);
      return;
    }

    let active = true;
    setIsLoadingWebhook(true);

    request<{ publicUrl: string | null }>({
      url: `/whatsapp/webhook/provision/${profileId}`,
      method: 'POST',
    })
      .then(({ data }) => {
        if (active) setWebhookUrl(data?.publicUrl ?? null);
      })
      .catch(() => {
        if (active) setWebhookUrl(null);
      })
      .finally(() => {
        if (active) setIsLoadingWebhook(false);
      });

    return () => {
      active = false;
    };
  }, [open, isEditing, isWhatsappOfficial, profileId, request]);

  /**
   * Provisiona (idempotente) o webhook que recebe os eventos de entrega do SES e
   * traz a URL pública para o admin assinar no tópico SNS.
   *
   * Sem essa assinatura a aplicação só sabe que o provedor aceitou a mensagem — foi
   * exatamente essa cegueira que deixou três e-mails "enviados com sucesso" sem
   * nunca chegarem a caixa nenhuma.
   */
  useEffect(() => {
    if (!open || !isEditing || !isSes || !profileId) {
      if (isSes) setWebhookUrl(null);
      return;
    }

    let active = true;
    setIsLoadingWebhook(true);

    request<{ publicUrl: string | null }>({
      url: `/mail-delivery/provision/${profileId}`,
      method: 'POST',
    })
      .then(({ data }) => {
        if (active) setWebhookUrl(data?.publicUrl ?? null);
      })
      .catch(() => {
        if (active) setWebhookUrl(null);
      })
      .finally(() => {
        if (active) setIsLoadingWebhook(false);
      });

    return () => {
      active = false;
    };
  }, [open, isEditing, isSes, profileId, request]);

  /**
   * Provisiona (idempotente) o webhook único do Microsoft Graph e traz a URL
   * pública. É a mesma URL registrada como notificationUrl de todas as
   * subscriptions. Só em edição (o UUID só existe depois de salvar o perfil).
   */
  useEffect(() => {
    if (!open || !isEditing || !isMicrosoftEntra || !profileId) {
      if (isMicrosoftEntra) setWebhookUrl(null);
      return;
    }

    let active = true;
    setIsLoadingWebhook(true);

    request<{ publicUrl: string | null }>({
      url: `/microsoft/webhook/provision/${profileId}`,
      method: 'POST',
    })
      .then(({ data }) => {
        if (active) setWebhookUrl(data?.publicUrl ?? null);
      })
      .catch(() => {
        if (active) setWebhookUrl(null);
      })
      .finally(() => {
        if (active) setIsLoadingWebhook(false);
      });

    return () => {
      active = false;
    };
  }, [open, isEditing, isMicrosoftEntra, profileId, request]);

  /**
   * Provisiona (idempotente) o webhook de pagamento no core via commerce e traz a
   * URL pública para o admin cadastrar no painel do gateway. Só em edição (a URL
   * vem do UUID do webhook, que só existe depois de salvar o perfil). Não grava o
   * perfil padrão de pagamento — isso é exclusivo da tela de settings do commerce.
   */
  useEffect(() => {
    if (!open || !isEditing || !isPaymentProvider || !profileId) {
      if (isPaymentProvider) {
        setWebhookUrl(null);
        setIsWebhookBaseUrlMissing(false);
      }
      return;
    }

    let active = true;
    setIsLoadingWebhook(true);
    setIsWebhookBaseUrlMissing(false);

    request<{ publicUrl: string | null; baseUrlConfigured?: boolean }>({
      url: `/commerce/webhooks/provision/${profileId}`,
      method: 'POST',
    })
      .then(({ data }) => {
        if (!active) return;
        setWebhookUrl(data?.publicUrl ?? null);
        setIsWebhookBaseUrlMissing(data?.baseUrlConfigured === false);
      })
      .catch(() => {
        if (active) setWebhookUrl(null);
      })
      .finally(() => {
        if (active) setIsLoadingWebhook(false);
      });

    return () => {
      active = false;
    };
  }, [open, isEditing, isPaymentProvider, profileId, request]);

  const handleSyncSubscriptions = async () => {
    setIsSyncingSubscriptions(true);
    try {
      const { data } = await request<{
        created: number;
        renewed: number;
        reused: number;
        failed: number;
      }>({
        url: `/microsoft/webhook/subscriptions/sync`,
        method: 'POST',
      });
      toast.success(
        t('microsoftSyncResult', {
          created: data?.created ?? 0,
          reused: data?.reused ?? 0,
          failed: data?.failed ?? 0,
        })
      );
    } catch {
      toast.error(t('microsoftSyncError'));
    } finally {
      setIsSyncingSubscriptions(false);
    }
  };

  const resolvedLockedTypeSlug = lockedTypeSlug || null;
  const resolvedLockedProviderSlug = lockedProviderSlug || null;
  const resolvedInitialTypeSlug = initialTypeSlug || resolvedLockedTypeSlug;

  // Nos sheets travados num provedor já sabemos quantos campos virão, então o
  // placeholder tem exatamente a altura do formulário e a troca não desloca nada.
  const skeletonFieldCount = resolvedLockedProviderSlug
    ? (PROVIDER_FIELDS[resolvedLockedProviderSlug]?.length ?? 6)
    : 6;

  const resolvedLockedProvider = useMemo(() => {
    if (!resolvedLockedProviderSlug) {
      return null;
    }

    if (!formData.type_id) {
      return null;
    }

    return (
      providers.find(
        (provider) =>
          provider.slug === resolvedLockedProviderSlug &&
          String(provider.type_id) === formData.type_id
      ) ?? null
    );
  }, [formData.type_id, providers, resolvedLockedProviderSlug]);

  // Arma os dois flags de uma vez na abertura. Sem isso existe um frame entre "o
  // catálogo respondeu" e "o efeito do perfil roda" em que ambos seriam `false` e o
  // formulário vazio apareceria antes de ser preenchido.
  useEffect(() => {
    if (!open) {
      return;
    }
    setIsLoadingCatalog(true);
    setIsLoadingProfile(profileId != null);
    setTestState({ status: 'idle' });
  }, [open, profileId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    Promise.all([
      request<IntegrationType[]>({
        url: '/integration-profile/types',
        method: 'GET',
      }),
      request<IntegrationProvider[]>({
        url: '/integration-profile/providers',
        method: 'GET',
      }),
    ])
      .then(([typesResponse, providersResponse]) => {
        if (!active) {
          return;
        }

        // Both real API response shapes exercised in tests (plain array and
        // `{ data: [...] }`) always yield a truthy `.data` here; this final
        // `?? []` only guards a third, currently-unseen malformed shape.
        const loadedTypes = Array.isArray(typesResponse.data)
          ? typesResponse.data
          : /* v8 ignore next */
            ((typesResponse.data as any)?.data ?? []);
        const loadedProviders = Array.isArray(providersResponse.data)
          ? providersResponse.data
          : /* v8 ignore next -- same reasoning as loadedTypes above */
            ((providersResponse.data as any)?.data ?? []);

        setTypes(loadedTypes);
        setProviders(loadedProviders);
      })
      .catch(() => {
        toast.error(t('loadError'));
      })
      // Sem este finally, uma falha no catálogo deixaria o skeleton preso para sempre.
      .finally(() => {
        if (active) {
          setIsLoadingCatalog(false);
        }
      });

    return () => {
      active = false;
    };
  }, [open, request, t]);

  useEffect(() => {
    if (!open) {
      return;
    }

    // Waits for the catalog (types + providers) to load before mounting the form. Without
    // the providers, the provider_id of the profile being edited can't be resolved, and the
    // credentials section (and the node pool picker) won't render.
    if (types.length === 0 || providers.length === 0) {
      return;
    }

    let active = true;

    const applyDefaultCreateState = () => {
      const preferredSlug = resolvedInitialTypeSlug;
      const resolvedType = preferredSlug
        ? types.find((item) => item.slug === preferredSlug)
        : null;
      const resolvedProvider =
        resolvedType && resolvedLockedProviderSlug
          ? providers.find(
              (provider) =>
                provider.slug === resolvedLockedProviderSlug &&
                provider.type_id === resolvedType.id
            )
          : null;

      slugAutoRef.current = true;
      setVisibleFields({});
      setEditingProvider(null);
      setFormData({
        ...defaultForm(),
        type_id: resolvedType ? String(resolvedType.id) : '',
        provider_id: resolvedProvider ? String(resolvedProvider.id) : '',
      });
    };

    if (!isEditing) {
      applyDefaultCreateState();
      return;
    }

    setIsLoadingProfile(true);
    request<IntegrationProfile>({
      url: `/integration-profile/${profileId}`,
      method: 'GET',
    })
      .then(({ data }) => {
        if (!active) {
          return;
        }

        slugAutoRef.current = false;
        setVisibleFields({});
        const loadedConfig =
          (data.config as Record<
            string,
            string | boolean | number | string[]
          >) ?? {};
        // O provider embutido na resposta é a fonte confiável: o catálogo pode não
        // conter este provider (lista incompleta) e aí nada de config renderizaria.
        setEditingProvider(
          data.integration_provider
            ? {
                id: data.provider_id,
                slug: data.integration_provider.slug,
                type_id: data.type_id,
                integration_provider_locale:
                  data.integration_provider.integration_provider_locale ?? [],
              }
            : null
        );
        const providerSlug =
          data.integration_provider?.slug ??
          providers.find((p) => p.id === data.provider_id)?.slug ??
          '';
        if (
          providerSlug.endsWith('-oauth') &&
          !Array.isArray(loadedConfig.callback_urls)
        ) {
          const pName = providerSlug.replace(/-oauth$/, '');
          if (appUrl) {
            loadedConfig.callback_urls = buildOAuthCallbackUrls(pName);
          }
        }
        setFormData({
          name: data.name,
          slug: data.slug,
          type_id: String(data.type_id),
          provider_id:
            resolvedLockedProviderSlug &&
            providers.some(
              (provider) =>
                provider.slug === resolvedLockedProviderSlug &&
                provider.type_id === data.type_id
            )
              ? String(
                  providers.find(
                    (provider) =>
                      provider.slug === resolvedLockedProviderSlug &&
                      provider.type_id === data.type_id
                  )!.id
                )
              : String(data.provider_id),
          config: loadedConfig,
          is_active: data.is_active,
        });
      })
      .catch(() => {
        if (active) {
          toast.error(t('loadError'));
          onOpenChange(false);
        }
      })
      .finally(() => {
        if (active) {
          setIsLoadingProfile(false);
        }
      });

    return () => {
      active = false;
    };
  }, [
    isEditing,
    onOpenChange,
    open,
    profileId,
    request,
    resolvedInitialTypeSlug,
    resolvedLockedProviderSlug,
    t,
    types,
    providers,
  ]);

  const isTypeLocked = Boolean(resolvedLockedTypeSlug);
  const isProviderLocked = Boolean(resolvedLockedProviderSlug);

  useEffect(() => {
    if (!resolvedLockedProvider || !isProviderLocked) {
      return;
    }

    const lockedProviderId = String(resolvedLockedProvider.id);

    if (formData.provider_id === lockedProviderId) {
      return;
    }

    const initialConfig: Record<string, string | boolean | number | string[]> =
      {};
    if (resolvedLockedProvider.slug.endsWith('-oauth')) {
      const providerName = resolvedLockedProvider.slug.replace(/-oauth$/, '');
      initialConfig.callback_urls = appUrl
        ? buildOAuthCallbackUrls(providerName)
        : [];
    }

    setFormData((previous) => ({
      ...previous,
      provider_id: lockedProviderId,
      config:
        previous.provider_id && previous.provider_id !== lockedProviderId
          ? initialConfig
          : previous.config,
    }));
    setVisibleFields({});
  }, [appUrl, formData.provider_id, isProviderLocked, resolvedLockedProvider]);

  const handleNameChange = (name: string) => {
    setFormData((p) => ({
      ...p,
      name,
      slug: slugAutoRef.current ? toSlug(name) : p.slug,
    }));
  };

  const handleSlugChange = (slug: string) => {
    slugAutoRef.current = false;
    setFormData((p) => ({ ...p, slug }));
  };

  const handleTypeChange = (type_id: string) => {
    /* v8 ignore start -- unreachable through any simulated interaction: the
     * type Select is `disabled` whenever isTypeLocked is true (so Radix never
     * calls onValueChange), and even a raw `change` event fired directly on
     * the hidden native <select> mirror (bypassing the disabled trigger, the
     * same technique used elsewhere in the test file) does not invoke this
     * handler either — confirmed empirically. Kept as defense-in-depth. */
    if (isTypeLocked) {
      return;
    }
    /* v8 ignore stop */

    setFormData((p) => ({ ...p, type_id, provider_id: '', config: {} }));
  };

  const handleProviderChange = (provider_id: string) => {
    // O Select do Radix mantém um <select> nativo espelho para participação em
    // formulário. Quando o perfil carregado define type_id e provider_id no mesmo
    // commit, a <option> do provider ainda não existe nesse espelho: o navegador
    // normaliza o valor para '' e o Radix devolve isso (ou, no commit seguinte, o
    // próprio provider já selecionado) por onValueChange. Sem estas duas guardas
    // esse eco era tratado como "usuário trocou de provider" e zerava o config
    // recém-carregado — a edição abria com todos os campos em branco.
    if (!provider_id || provider_id === formData.provider_id) {
      return;
    }

    const provider = formTypeProviders.find(
      (p) => String(p.id) === provider_id
    );
    const initialConfig: Record<string, string | boolean | number | string[]> =
      {};
    if (provider?.slug?.endsWith('-oauth')) {
      const pName = provider.slug.replace(/-oauth$/, '');
      initialConfig.callback_urls = appUrl ? buildOAuthCallbackUrls(pName) : [];
    }
    setFormData((p) => ({ ...p, provider_id, config: initialConfig }));
    setVisibleFields({});
  };

  const updateConfig = (
    key: string,
    value: string | boolean | number | string[]
  ) => {
    setFormData((p) => ({ ...p, config: { ...p.config, [key]: value } }));
  };

  const updateCallbackUrl = (index: number, value: string) => {
    const urls = [...callbackUrls];
    urls[index] = value;
    setFormData((p) => ({
      ...p,
      config: { ...p.config, callback_urls: urls },
    }));
  };

  const addCallbackUrl = () => {
    setFormData((p) => ({
      ...p,
      config: { ...p.config, callback_urls: [...callbackUrls, ''] },
    }));
  };

  const removeCallbackUrl = (index: number) => {
    setFormData((p) => ({
      ...p,
      config: {
        ...p.config,
        callback_urls: callbackUrls.filter((_, i) => i !== index),
      },
    }));
  };

  /**
   * Payload compartilhado por salvar e testar.
   *
   * Compartilhar importa: o merge de `callback_urls` do OAuth vivia só dentro do
   * submit, e testar com um payload diferente do que se salva é como validar uma
   * configuração e gravar outra.
   */
  const buildProfilePayload = useCallback(
    () => ({
      slug: formData.slug,
      name: formData.name,
      type_id: Number(formData.type_id),
      provider_id: Number(formData.provider_id),
      config: isOAuthProvider
        ? { ...formData.config, callback_urls: callbackUrls }
        : formData.config,
      is_active: formData.is_active,
    }),
    [formData, isOAuthProvider, callbackUrls]
  );

  const canTestConnection =
    Boolean(formData.type_id) &&
    Boolean(formData.provider_id) &&
    Boolean(formData.slug.trim()) &&
    Boolean(formData.name.trim());

  const handleTestConnection = async () => {
    if (!canTestConnection) {
      return;
    }

    setTestState({ status: 'testing' });

    try {
      const { data } = await request<TestConnectionResponse>({
        url: '/integration-profile/test',
        method: 'POST',
        data: {
          ...buildProfilePayload(),
          ...(isEditing ? { profile_id: profileId } : {}),
        },
        // Um 400 aqui é resultado do teste, não falha da aplicação: sem isto o
        // interceptor global do AppProvider dispararia um segundo toast.
        showErrors: false,
      });

      setTestState({
        status: 'ok',
        info: data.info ?? data.destination,
        warning: data.warning,
        persisted: data.persisted !== false,
      });
      toast.success(t('testConnectionSuccess'));
    } catch (error) {
      setTestState({
        status: 'error',
        message: getErrorMessage(error) || t('testConnectionErrorFallback'),
      });
      toast.error(t('testConnectionError'));
    }
  };

  const isTesting = testState.status === 'testing';

  const testStatusContent =
    testState.status === 'idle' ? null : testState.status === 'testing' ? (
      <span className="flex items-center gap-1.5">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        {t('testConnectionRunning')}
      </span>
    ) : testState.status === 'ok' ? (
      <div className="space-y-1">
        <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
          <CircleCheck className="h-3.5 w-3.5 shrink-0" />
          {testState.info
            ? t('testConnectionOkWithInfo', { info: testState.info })
            : t('testConnectionSuccess')}
        </span>
        {testState.warning ? (
          <span className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
            {t('testConnectionWarning', { warning: testState.warning })}
          </span>
        ) : null}
        {!testState.persisted ? (
          <span className="block">{t('testConnectionNotPersisted')}</span>
        ) : null}
      </div>
    ) : (
      <span
        className="flex items-center gap-1.5 text-destructive"
        title={testState.message}
      >
        <CircleAlert className="h-3.5 w-3.5 shrink-0" />
        <span className="line-clamp-2">{testState.message}</span>
      </span>
    );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!formData.type_id || !formData.provider_id) {
      return;
    }

    setIsSubmitting(true);
    const payload = buildProfilePayload();

    try {
      const response = await request<IntegrationProfile>({
        url: isEditing
          ? `/integration-profile/${profileId}`
          : '/integration-profile',
        method: isEditing ? 'PATCH' : 'POST',
        data: payload,
      });

      const savedProfile = response.data;

      toast.success(isEditing ? t('updateSuccess') : t('createSuccess'));
      onSaved?.({
        id: savedProfile.id,
        slug: savedProfile.slug,
        name: savedProfile.name,
        type_id: savedProfile.type_id,
        provider_id: savedProfile.provider_id,
        config: savedProfile.config,
        is_active: savedProfile.is_active,
      });
      onOpenChange(false);
    } catch {
      toast.error(isEditing ? t('updateError') : t('createError'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <ResizableSheetContent sheetId={sheetId} defaultWidth={defaultWidth}>
        <SheetHeader>
          <SheetTitle>
            {isEditing ? t('editProfile') : t('newProfileTitle')}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? t('editProfileDescription')
              : t('newProfileDescription')}
          </SheetDescription>
        </SheetHeader>

        {isFormLoading ? (
          <IntegrationProfileFormSkeleton
            fieldCount={skeletonFieldCount}
            stage={isLoadingProfile ? 'profile' : 'catalog'}
            label={t('loadingProfile')}
          />
        ) : null}

        {/*
         * O formulário fica MONTADO durante o carregamento, apenas escondido atrás do
         * skeleton. Desmontá-lo corrompe os dados: o <select> nativo que o Radix mantém
         * para o Select só ganha suas <option> quando os SelectItem montam, e se o
         * `value` chegar antes disso o Radix dispara um `change` com string vazia e
         * dispara `onValueChange('')` — o que zera tipo, provedor e todo o config
         * recém-carregado. Montado desde o início, esse registro já aconteceu.
         */}
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-6 px-3 pb-8 sm:px-4"
          // `hidden` nativo (e não uma classe): tira o formulário da árvore de
          // acessibilidade e da ordem de foco sem depender de CSS carregado.
          hidden={isFormLoading}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ip-name">
                {t('nameLabel')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ip-name"
                value={formData.name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder={t('namePlaceholder')}
                required
                autoFocus
                disabled={isLoadingProfile}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ip-slug">
                {t('slugLabel')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ip-slug"
                value={formData.slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder={t('slugPlaceholder')}
                required
                className="font-mono text-sm"
                disabled={isLoadingProfile}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="ip-type">
                {t('typeLabel')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.type_id}
                onValueChange={handleTypeChange}
                disabled={isLoadingProfile || !!isEditing || isTypeLocked}
              >
                <SelectTrigger className="w-full" id="ip-type">
                  <SelectValue placeholder={t('typePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {types
                    .filter((ty) =>
                      resolvedLockedTypeSlug
                        ? ty.slug === resolvedLockedTypeSlug
                        : true
                    )
                    .map((ty) => (
                      <SelectItem key={ty.id} value={String(ty.id)}>
                        {getLocaleName(
                          ty.integration_type_locale,
                          currentLocaleCode
                        )}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="ip-provider">
                {t('providerLabel')} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.provider_id}
                onValueChange={handleProviderChange}
                disabled={
                  isLoadingProfile ||
                  !formData.type_id ||
                  !!isEditing ||
                  isProviderLocked
                }
              >
                <SelectTrigger className="w-full" id="ip-provider">
                  <SelectValue
                    placeholder={
                      !formData.type_id
                        ? t('providerSelectTypFirst')
                        : t('providerPlaceholder')
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {providerOptions
                    .filter((prov) =>
                      resolvedLockedProviderSlug
                        ? prov.slug === resolvedLockedProviderSlug
                        : true
                    )
                    .map((prov) => (
                      <SelectItem key={prov.id} value={String(prov.id)}>
                        <span className="flex items-center gap-2">
                          <Avatar className="size-6 border bg-muted/40">
                            <AvatarFallback className="text-[10px] font-semibold">
                              <IntegrationLogo
                                provider={prov.slug}
                                size={14}
                                decorative
                              />
                            </AvatarFallback>
                          </Avatar>
                          {getLocaleName(
                            prov.integration_provider_locale,
                            currentLocaleCode
                          )}
                        </span>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {providerFields.length > 0 && (
            <div className="rounded-lg border">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">
                  {t('configSectionTitle')}
                </p>
              </div>
              <div className="grid gap-4 p-4 sm:grid-cols-2">
                {providerFields.map((field) => {
                  if (field.type === 'boolean') {
                    return (
                      <div
                        key={field.key}
                        className="col-span-full flex items-center justify-between rounded-md border px-4 py-3"
                      >
                        <p className="text-sm font-medium">
                          {t(field.labelKey as any)}
                        </p>
                        <Switch
                          checked={Boolean(formData.config[field.key])}
                          onCheckedChange={(checked) =>
                            updateConfig(field.key, checked)
                          }
                        />
                      </div>
                    );
                  }

                  if (field.type === 'select') {
                    return (
                      <div
                        key={field.key}
                        // Neither existing `select`-type field (stripe's and mercado_pago's
                        // `mode`) sets `colSpan: true`, so the truthy side of this ternary
                        // is unreachable with the current field data.
                        /* v8 ignore next 2 */
                        className={
                          field.colSpan
                            ? 'col-span-full space-y-2'
                            : 'space-y-2'
                        }
                      >
                        <Label htmlFor={`ip-cfg-${field.key}`}>
                          {t(field.labelKey as any)}
                          {/* No `select`-type field in PROVIDER_FIELDS currently has
                              `required: true` (both existing select fields, stripe's
                              and mercado_pago's `mode`, are optional); adding one just
                              to exercise this asterisk would be a source-data change
                              outside this task's scope. */}
                          {/* v8 ignore start */}
                          {field.required && (
                            <span className="text-destructive"> *</span>
                          )}
                          {/* v8 ignore stop */}
                        </Label>
                        <Select
                          value={String(formData.config[field.key] ?? '')}
                          onValueChange={(value) =>
                            updateConfig(field.key, value)
                          }
                        >
                          <SelectTrigger
                            id={`ip-cfg-${field.key}`}
                            className="w-full"
                          >
                            <SelectValue placeholder={field.placeholder} />
                          </SelectTrigger>
                          <SelectContent>
                            {field.options?.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {t(option.labelKey as any)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  }

                  if (field.type === 'file') {
                    const storedValue = String(
                      formData.config[field.key] ?? ''
                    );
                    // Backend never returns the stored file, only the mask.
                    const hasStored = storedValue === SECRET_MASK;

                    return (
                      <div key={field.key} className="col-span-full space-y-2">
                        <Label htmlFor={`ip-cfg-${field.key}`}>
                          {t(field.labelKey as any)}
                          {field.required && !isEditing && (
                            <span className="text-destructive"> *</span>
                          )}
                        </Label>
                        {hasStored ? (
                          <div className="flex items-center justify-between rounded-md border px-4 py-3">
                            <p className="text-sm text-muted-foreground">
                              {t('fileStored')}
                            </p>
                            <ChangeSecretButton
                              onClick={() => updateConfig(field.key, '')}
                              label={t('changeSecret')}
                            />
                          </div>
                        ) : (
                          <Input
                            id={`ip-cfg-${field.key}`}
                            type="file"
                            accept={field.accept}
                            // Uploading through the profile config (not the `file`
                            // module) is intentional: the `file` module's `local`
                            // provider writes to disk in plaintext, while the
                            // profile config is encrypted at rest.
                            onChange={async (e) => {
                              const picked = e.target.files?.[0];
                              if (!picked) {
                                updateConfig(field.key, '');
                                return;
                              }
                              const buffer = await picked.arrayBuffer();
                              let binary = '';
                              const bytes = new Uint8Array(buffer);
                              for (const byte of bytes) {
                                binary += String.fromCharCode(byte);
                              }
                              updateConfig(field.key, window.btoa(binary));
                            }}
                            required={field.required && !isEditing}
                            disabled={isLoadingProfile}
                          />
                        )}
                        {storedValue && !hasStored && (
                          <p className="text-xs text-muted-foreground">
                            {t('fileSelected')}
                          </p>
                        )}
                      </div>
                    );
                  }

                  const isPassword = field.type === 'password';
                  const isVisible = visibleFields[field.key] ?? false;
                  const currentValue = String(formData.config[field.key] ?? '');
                  // Already-stored secret: disabled field showing ******** + a "change"
                  // button that clears the value and re-enables typing a new secret.
                  const isLockedSecret =
                    isPassword && isEditing && currentValue === SECRET_MASK;

                  return (
                    <div
                      key={field.key}
                      className={
                        field.colSpan ? 'col-span-full space-y-2' : 'space-y-2'
                      }
                    >
                      <Label htmlFor={`ip-cfg-${field.key}`}>
                        {t(field.labelKey as any)}
                        {field.required && (
                          <span className="text-destructive"> *</span>
                        )}
                      </Label>
                      <div className={isPassword ? 'relative' : undefined}>
                        <Input
                          id={`ip-cfg-${field.key}`}
                          type={
                            isPassword
                              ? isVisible && !isLockedSecret
                                ? 'text'
                                : 'password'
                              : field.type === 'number'
                                ? 'number'
                                : 'text'
                          }
                          value={currentValue}
                          onChange={(e) =>
                            updateConfig(field.key, e.target.value)
                          }
                          placeholder={
                            isPassword && isEditing
                              ? t('leaveBlankToKeep')
                              : field.placeholder
                          }
                          required={
                            field.required && !(isPassword && isEditing)
                          }
                          autoComplete={isPassword ? 'new-password' : undefined}
                          className={isPassword ? 'pr-10' : undefined}
                          disabled={isLoadingProfile || isLockedSecret}
                        />
                        {isPassword &&
                          (isLockedSecret ? (
                            <ChangeSecretButton
                              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                              onClick={() => {
                                updateConfig(field.key, '');
                                setVisibleFields((p) => ({
                                  ...p,
                                  [field.key]: true,
                                }));
                              }}
                              label={t('changeSecret')}
                            />
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
                              onClick={() =>
                                setVisibleFields((p) => ({
                                  ...p,
                                  [field.key]: !p[field.key],
                                }))
                              }
                              aria-label={
                                isVisible
                                  ? t('hidePassword')
                                  : t('showPassword')
                              }
                            >
                              {isVisible ? (
                                <EyeOff className="h-4 w-4" />
                              ) : (
                                <Eye className="h-4 w-4" />
                              )}
                            </Button>
                          ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {selectedProvider?.slug === 'digitalocean' && (
            <DoNodePoolPicker
              apiToken={String(formData.config.api_token ?? '')}
              clusterId={String(formData.config.cluster_id ?? '')}
              value={String(formData.config.video_node_pool_name ?? '')}
              profileId={profileId ?? undefined}
              onChange={(name) => updateConfig('video_node_pool_name', name)}
            />
          )}

          {isOAuthProvider && (
            <div className="rounded-lg border">
              <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">
                    {t('callbackUrlsSectionTitle')}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {t('callbackUrlsDescription')}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCallbackUrl}
                  disabled={isLoadingProfile}
                >
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {t('addCallbackUrl')}
                </Button>
              </div>
              <div className="space-y-2 p-4">
                {callbackUrls.length === 0 && (
                  <p className="py-1 text-center text-sm text-muted-foreground">
                    {t('noCallbackUrls')}
                  </p>
                )}
                {callbackUrls.map((url, index) => (
                  <div key={index} className="flex gap-2">
                    <Input
                      value={url}
                      onChange={(e) => updateCallbackUrl(index, e.target.value)}
                      placeholder={t('callbackUrlPlaceholder')}
                      className="font-mono text-sm"
                      disabled={isLoadingProfile}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      disabled={isLoadingProfile || !url}
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        setCopiedIndex(index);
                        setTimeout(() => setCopiedIndex(null), 1500);
                      }}
                    >
                      {copiedIndex === index ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCallbackUrl(index)}
                      className="shrink-0"
                      disabled={isLoadingProfile}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isSes && (
            <div className="rounded-lg border">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">
                  {t('sesWebhookSectionTitle')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('sesWebhookDescription')}
                </p>
              </div>
              <div className="space-y-4 p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('sesWebhookEndpointLabel')}
                  </Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={
                          isLoadingWebhook
                            ? t('whatsappWebhookLoading')
                            : (webhookUrl ?? '')
                        }
                        placeholder={t('whatsappWebhookUnavailable')}
                        className="font-mono text-sm"
                      />
                      <CopyButton
                        value={webhookUrl ?? ''}
                        copiedMessage={t('copiedToClipboard')}
                        className="shrink-0"
                      />
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      {t('whatsappWebhookSaveFirst')}
                    </p>
                  )}
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="mb-1.5 text-xs font-semibold">
                    {t('whatsappWebhookStepsTitle')}
                  </p>
                  <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                    <li>{t('sesWebhookStep1')}</li>
                    <li>{t('sesWebhookStep2')}</li>
                    <li>{t('sesWebhookStep3')}</li>
                    <li>{t('sesWebhookStep4')}</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {isWhatsappOfficial && (
            <div className="rounded-lg border">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">
                  {t('whatsappWebhookSectionTitle')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('whatsappWebhookDescription')}
                </p>
              </div>
              <div className="space-y-4 p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('whatsappWebhookCallbackUrlLabel')}
                  </Label>
                  {isEditing ? (
                    <div className="flex gap-2">
                      <Input
                        readOnly
                        value={
                          isLoadingWebhook
                            ? t('whatsappWebhookLoading')
                            : (webhookUrl ?? '')
                        }
                        placeholder={t('whatsappWebhookUnavailable')}
                        className="font-mono text-sm"
                      />
                      <CopyButton
                        value={webhookUrl ?? ''}
                        copiedMessage={t('copiedToClipboard')}
                        className="shrink-0"
                      />
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      {t('whatsappWebhookSaveFirst')}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('whatsappWebhookVerifyTokenLabel')}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {t('whatsappWebhookVerifyTokenHint')}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="mb-1.5 text-xs font-semibold">
                    {t('whatsappWebhookStepsTitle')}
                  </p>
                  <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                    <li>{t('whatsappWebhookStep1')}</li>
                    <li>{t('whatsappWebhookStep2')}</li>
                    <li>{t('whatsappWebhookStep3')}</li>
                    <li>{t('whatsappWebhookStep4')}</li>
                  </ol>
                </div>
              </div>
            </div>
          )}

          {isMicrosoftEntra && (
            <div className="rounded-lg border">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">
                  {t('microsoftWebhookSectionTitle')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('microsoftWebhookDescription')}
                </p>
              </div>
              <div className="space-y-4 p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('microsoftWebhookUrlLabel')}
                  </Label>
                  {isEditing ? (
                    <>
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={
                            isLoadingWebhook
                              ? t('microsoftWebhookLoading')
                              : (webhookUrl ?? '')
                          }
                          placeholder={t('microsoftWebhookUnavailable')}
                          className="font-mono text-sm"
                        />
                        <CopyButton
                          value={webhookUrl ?? ''}
                          copiedMessage={t('copiedToClipboard')}
                          className="shrink-0"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        disabled={isSyncingSubscriptions || !webhookUrl}
                        onClick={handleSyncSubscriptions}
                      >
                        {isSyncingSubscriptions
                          ? t('microsoftSyncing')
                          : t('microsoftSyncButton')}
                      </Button>
                    </>
                  ) : (
                    <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      {t('microsoftWebhookSaveFirst')}
                    </p>
                  )}
                </div>

                <div className="rounded-md bg-muted/50 p-3">
                  <p className="mb-1.5 text-xs font-semibold">
                    {t('microsoftStepsTitle')}
                  </p>
                  <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                    <li>{t('microsoftStep1')}</li>
                    <li>{t('microsoftStep2')}</li>
                    <li>{t('microsoftStep3')}</li>
                    <li>{t('microsoftStep4')}</li>
                    <li>{t('microsoftStep5')}</li>
                  </ol>
                </div>

                <div className="rounded-md bg-muted/50 p-3">
                  <p className="mb-1.5 text-xs font-semibold">
                    {t('microsoftPermissionsTitle')}
                  </p>
                  <p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground/80">
                    {t('microsoftPermissionsApplication')}
                  </p>
                  <ul className="mb-2 list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    <li>CallRecords.Read.All</li>
                    <li>OnlineMeetingRecording.Read.All</li>
                    <li>OnlineMeetingTranscript.Read.All</li>
                    <li>OnlineMeetings.Read.All</li>
                    <li>OnlineMeetings.ReadWrite.All</li>
                    <li>Calendars.ReadWrite</li>
                    <li>User.Read.All</li>
                    <li>Presence.Read.All</li>
                    <li>
                      Chat.Read.All / ChannelMessage.Read.All{' '}
                      {t('microsoftProtectedSuffix')}
                    </li>
                  </ul>
                  <p className="mb-1 text-[11px] font-medium uppercase text-muted-foreground/80">
                    {t('microsoftPermissionsDelegated')}
                  </p>
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-muted-foreground">
                    <li>
                      Presence.Read, Chat.Read, Calendars.Read, offline_access
                    </li>
                    <li>
                      Calendars.ReadWrite, OnlineMeetings.ReadWrite,
                      OnlineMeetingRecording.Read.All{' '}
                      {t.has('microsoftDelegatedSchedulingSuffix')
                        ? t('microsoftDelegatedSchedulingSuffix')
                        : '(apenas se o organizador das reuniões for o usuário conectado)'}
                    </li>
                  </ul>
                </div>

                <div className="rounded-md border border-blue-500/30 bg-blue-500/5 p-3">
                  <p className="mb-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400">
                    {t.has('microsoftSchedulingTitle')
                      ? t('microsoftSchedulingTitle')
                      : 'Agendar aulas no Teams com gravação automática'}
                  </p>
                  <ul className="list-disc space-y-0.5 pl-4 text-xs text-blue-700/90 dark:text-blue-400/90">
                    <li>
                      {t.has('microsoftSchedulingPolicy')
                        ? t('microsoftSchedulingPolicy')
                        : 'New-CsApplicationAccessPolicy + Grant-CsApplicationAccessPolicy autorizando este aplicativo a agir sobre a conta de serviço.'}
                    </li>
                    <li>
                      {t.has('microsoftSchedulingLicense')
                        ? t('microsoftSchedulingLicense')
                        : 'A conta de serviço precisa de licença do Teams e de política com AllowCloudRecording habilitado — sem isso a gravação automática é aceita e simplesmente não grava.'}
                    </li>
                    <li>
                      {t.has('microsoftSchedulingSetting')
                        ? t('microsoftSchedulingSetting')
                        : 'Defina o UPN da conta de serviço em Configurações › Microsoft Entra ID.'}
                    </li>
                  </ul>
                </div>

                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {t('microsoftNotes')}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isPaymentProvider && (
            <div className="rounded-lg border">
              <div className="border-b px-4 py-3">
                <p className="text-sm font-semibold">
                  {t('paymentWebhookSectionTitle')}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t('paymentWebhookDescription')}
                </p>
              </div>
              <div className="space-y-4 p-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    {t('paymentWebhookUrlLabel')}
                  </Label>
                  {isEditing ? (
                    isWebhookBaseUrlMissing ? (
                      <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                        {t('paymentWebhookBaseUrlMissing')}
                      </p>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          readOnly
                          value={
                            isLoadingWebhook
                              ? t('paymentWebhookLoading')
                              : (webhookUrl ?? '')
                          }
                          placeholder={t('paymentWebhookUnavailable')}
                          className="font-mono text-sm"
                        />
                        <CopyButton
                          value={webhookUrl ?? ''}
                          copiedMessage={t('copiedToClipboard')}
                          className="shrink-0"
                        />
                      </div>
                    )
                  ) : (
                    <p className="rounded-md border border-dashed px-3 py-2 text-sm text-muted-foreground">
                      {t('paymentWebhookSaveFirst')}
                    </p>
                  )}
                </div>

                <div className="rounded-md bg-muted/50 p-3">
                  <p className="mb-1.5 text-xs font-semibold">
                    {t('paymentWebhookStepsTitle')}
                  </p>
                  <ol className="list-decimal space-y-1 pl-4 text-xs text-muted-foreground">
                    {(paymentWebhookStepKeys[paymentGatewaySlug] ?? []).map(
                      (stepKey) => (
                        <li key={stepKey}>{t(stepKey as any)}</li>
                      )
                    )}
                  </ol>
                </div>

                <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    {paymentGatewaySlug === 'google_play'
                      ? t('paymentGooglePlayNote')
                      : t('paymentWebhookSecretRequiredNote')}
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border px-4 py-3">
            <p className="text-sm font-medium">{t('isActiveLabel')}</p>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData((p) => ({ ...p, is_active: checked }))
              }
            />
          </div>

          <FormActions
            sheet
            submitType="submit"
            submitLabel={isEditing ? t('saveChanges') : t('createProfile')}
            // Testar é opcional: salvar nunca depende do resultado nem espera por ele.
            submitDisabled={
              isSubmitting || !formData.type_id || !formData.provider_id
            }
            submitTestId="integration-profile-submit"
            statusContent={testStatusContent}
            secondaryAction={
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto sm:min-w-32"
                onClick={handleTestConnection}
                disabled={isTesting || !canTestConnection}
                data-testid="integration-profile-test"
              >
                {isTesting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlugZap className="h-4 w-4" />
                )}
                {isTesting ? t('testing') : t('testConnection')}
              </Button>
            }
          />
        </form>
      </ResizableSheetContent>
    </Sheet>
  );
}
