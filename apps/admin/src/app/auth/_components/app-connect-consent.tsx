'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useApp } from '@hed-hog/next-app-provider';
import { ArrowLeftRight, Check, type LucideIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

function initialsOf(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word.charAt(0).toUpperCase())
      .join('') || '?'
  );
}

function LogoTile({
  name,
  logoUrl,
  icon: Icon,
}: {
  name: string;
  logoUrl?: string | null;
  icon?: LucideIcon;
}) {
  // Logo quebrado (URL antiga, CORS) cai no ícone/iniciais em vez de mostrar a
  // imagem partida no centro da tela de consent.
  const [failed, setFailed] = useState(false);
  const showImage = !!logoUrl && !failed;

  return (
    <div className="flex w-24 flex-col items-center gap-2">
      <div className="flex size-16 items-center justify-center overflow-hidden rounded-2xl border border-border bg-card shadow-sm sm:size-[4.5rem]">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- logo vem de URL externa arbitrária
          <img
            src={logoUrl}
            alt={name}
            className="size-full object-contain p-2.5"
            onError={() => setFailed(true)}
          />
        ) : Icon ? (
          <Icon className="size-8 text-primary" strokeWidth={1.5} />
        ) : (
          <span className="text-lg font-semibold text-primary">{initialsOf(name)}</span>
        )}
      </div>
      <span className="w-full truncate text-center text-xs font-medium text-foreground">
        {name}
      </span>
    </div>
  );
}

function Connector({ connected }: { connected: boolean }) {
  return (
    <div className="relative -mt-6 flex flex-1 items-center justify-center">
      <div
        className={cn(
          'absolute inset-x-0 top-1/2 border-t-2 border-dashed',
          connected ? 'border-green-500/60' : 'border-primary/40',
        )}
      />
      {!connected && (
        <>
          <span className="absolute left-1 top-1/2 size-1.5 -translate-y-1/2 animate-pulse rounded-full bg-primary" />
          <span className="absolute right-1 top-1/2 size-1.5 -translate-y-1/2 animate-pulse rounded-full bg-primary [animation-delay:500ms]" />
        </>
      )}
      <div
        className={cn(
          'relative flex size-9 items-center justify-center rounded-full ring-4 ring-card',
          connected ? 'bg-green-500 text-white' : 'bg-primary text-primary-foreground',
        )}
      >
        {connected ? (
          <Check className="size-4" strokeWidth={2.5} />
        ) : (
          <ArrowLeftRight className="size-4" strokeWidth={2} />
        )}
      </div>
    </div>
  );
}

export type AppConnectConsentProps = {
  appName: string;
  appLogoUrl?: string | null;
  /** Usado quando não há logo — ex.: o monitor do HedHog Desktop. */
  appIcon?: LucideIcon;
  title: string;
  subtitle: string;
  connectingAsLabel: string;
  authorizeLabel: string;
  cancelLabel: string;
  successTitle: string;
  successMessage: string;
  authorized: boolean;
  loading: boolean;
  error?: string | null;
  onAuthorize: () => void | Promise<void>;
  onCancel: () => void;
  /** Conteúdo específico do fluxo, entre a conta e os botões (ex.: escopos). */
  children?: ReactNode;
};

/**
 * Tela de consent compartilhada por /auth/desktop e /auth/authorize: mostra o
 * Hub (logo das settings) ligado ao app que pede acesso, e a conta que será
 * usada — numa tela de consent, saber em qual conta se autoriza não é enfeite.
 */
export function AppConnectConsent({
  appName,
  appLogoUrl,
  appIcon,
  title,
  subtitle,
  connectingAsLabel,
  authorizeLabel,
  cancelLabel,
  successTitle,
  successMessage,
  authorized,
  loading,
  error,
  onAuthorize,
  onCancel,
  children,
}: AppConnectConsentProps) {
  const { getSettingValue, user, userEmail, userPhotoUrl, userAbbr } = useApp();
  const systemName = getSettingValue('system-name') || 'HedHog';
  const systemLogo =
    getSettingValue('image-url') || getSettingValue('icon-url') || '/logo.svg';

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-xl shadow-primary/5">
        <div className="bg-linear-to-b from-primary/10 via-primary/5 to-transparent px-6 pb-2 pt-8 sm:px-8">
          <div className="flex items-center">
            <LogoTile name={systemName} logoUrl={systemLogo} />
            <Connector connected={authorized} />
            <LogoTile name={appName} logoUrl={appLogoUrl} icon={appIcon} />
          </div>
        </div>

        <div className="flex flex-col gap-6 px-6 pb-8 pt-4 sm:px-8">
          <div className="text-center">
            <h1 className="text-xl font-semibold text-foreground">
              {authorized ? successTitle : title}
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {authorized ? successMessage : subtitle}
            </p>
          </div>

          {!authorized && (
            <>
              <div className="rounded-2xl border border-border bg-muted/40 p-3">
                <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  {connectingAsLabel}
                </p>
                <div className="flex items-center gap-3">
                  <Avatar className="size-11 rounded-xl">
                    <AvatarImage src={userPhotoUrl} alt={user?.name} />
                    <AvatarFallback className="rounded-xl">{userAbbr}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{user?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
                  </div>
                </div>
              </div>

              {children}

              {error && <p className="text-center text-xs text-destructive">{error}</p>}

              <div className="flex flex-col gap-2">
                <Button size="lg" className="w-full" onClick={onAuthorize} loading={loading}>
                  {authorizeLabel}
                </Button>
                <Button
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={onCancel}
                  disabled={loading}
                >
                  {cancelLabel}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
