'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { parseBrowser, parseOS } from '@/lib/session';
import { cn } from '@/lib/utils';
import { useApp } from '@hed-hog/next-app-provider';
import { IconChevronDown, IconShieldLock } from '@tabler/icons-react';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';

const emptyForbiddenError = {
  show: false,
  message: '',
  url: '',
  method: '',
  statusCode: undefined,
} as const;

export function ForbiddenDialog() {
  const t = useTranslations('core.ForbiddenDialog');
  const { forbiddenError, setForbiddenError, user, userEmail } = useApp();
  const pathname = usePathname();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Read directly (guarded for SSR): every UA-dependent field lives inside the
  // Radix portal content, which only mounts once the dialog opens on the client.
  const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const browser = userAgent ? parseBrowser(userAgent) : '—';
  const os = userAgent ? parseOS(userAgent) : '—';
  const userName = user?.name
    ? user.id
      ? `${user.name} (#${user.id})`
      : user.name
    : '—';
  const email = userEmail || '—';

  const hasTechnicalDetails = Boolean(
    forbiddenError.method || forbiddenError.url || forbiddenError.statusCode
  );

  const close = () => {
    setCopied(false);
    setDetailsOpen(false);
    setForbiddenError({ ...emptyForbiddenError });
  };

  const buildCopyText = () => {
    const lines: string[] = [forbiddenError.message || t('defaultMessage'), ''];
    if (forbiddenError.statusCode) {
      lines.push(`${t('statusCode')}: ${forbiddenError.statusCode}`);
    }
    if (forbiddenError.method) {
      lines.push(`${t('method')}: ${forbiddenError.method}`);
    }
    if (forbiddenError.url) {
      lines.push(`${t('url')}: ${forbiddenError.url}`);
    }
    lines.push(`${t('currentPath')}: ${pathname}`);
    lines.push(`${t('user')}: ${userName}`);
    lines.push(`${t('email')}: ${email}`);
    lines.push(`${t('browser')}: ${browser}`);
    lines.push(`${t('os')}: ${os}`);
    lines.push(`${t('datetime')}: ${new Date().toLocaleString()}`);
    return lines.join('\n');
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(buildCopyText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(t('copySuccess'));
  };

  return (
    <AlertDialog
      open={forbiddenError.show}
      onOpenChange={(open) => {
        if (!open) {
          close();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="flex items-center gap-2">
            <IconShieldLock className="size-5 text-destructive" />
            <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          </div>
          <AlertDialogDescription>
            {forbiddenError.message || t('defaultMessage')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-md border bg-muted/30 p-4 text-sm">
          {hasTechnicalDetails ? (
            <>
              {forbiddenError.statusCode ? (
                <p className="font-medium text-foreground">
                  {t('statusCode')}: {forbiddenError.statusCode}
                </p>
              ) : null}
              {forbiddenError.method ? (
                <p className="mt-2 break-all text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {t('method')}:
                  </span>{' '}
                  {forbiddenError.method}
                </p>
              ) : null}
              {forbiddenError.url ? (
                <p className="mt-2 break-all text-muted-foreground">
                  <span className="font-medium text-foreground">{t('url')}:</span>{' '}
                  {forbiddenError.url}
                </p>
              ) : null}
            </>
          ) : null}
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-2 font-medium text-foreground',
                  hasTechnicalDetails && 'mt-3 border-t pt-3'
                )}
              >
                {t('technicalDetails')}
                <IconChevronDown
                  className={cn(
                    'size-4 shrink-0 transition-transform',
                    detailsOpen && 'rotate-180'
                  )}
                />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 space-y-2">
              <p className="break-all text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t('currentPath')}:
                </span>{' '}
                {pathname}
              </p>
              <p className="break-all text-muted-foreground">
                <span className="font-medium text-foreground">{t('user')}:</span>{' '}
                {userName}
              </p>
              <p className="break-all text-muted-foreground">
                <span className="font-medium text-foreground">{t('email')}:</span>{' '}
                {email}
              </p>
              <p className="break-all text-muted-foreground">
                <span className="font-medium text-foreground">
                  {t('browser')}:
                </span>{' '}
                {browser}
              </p>
              <p className="break-all text-muted-foreground">
                <span className="font-medium text-foreground">{t('os')}:</span>{' '}
                {os}
              </p>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <AlertDialogFooter>
          <Button type="button" variant="outline" onClick={handleCopy}>
            {copied ? (
              <Check className="size-4 text-green-500" />
            ) : (
              <Copy className="size-4" />
            )}
            {copied ? t('copied') : t('copy')}
          </Button>
          <AlertDialogAction onClick={close}>{t('understood')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
