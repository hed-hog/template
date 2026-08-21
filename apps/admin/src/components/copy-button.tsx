'use client';

import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Check, Copy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

interface CopyButtonProps {
  value: string;
  className?: string;
  /** Mensagem exibida no toast/tooltip/aria. Default: crm.ContactPage.copiedToClipboard. */
  copiedMessage?: string;
  /** Ao copiar, exibe toast de sucesso. Default: true. */
  showToast?: boolean;
  /** Efeito colateral do clique (auditoria, telemetria). Não bloqueia a cópia. */
  onCopy?: () => void;
}

export function CopyButton({
  value,
  className,
  copiedMessage,
  showToast = true,
  onCopy,
}: CopyButtonProps) {
  const t = useTranslations('crm.ContactPage');
  const [copied, setCopied] = useState(false);
  const copiedText = copiedMessage ?? t('copiedToClipboard');

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    if (showToast) toast.success(copiedText);
    onCopy?.();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={className ?? 'h-6 w-6'}
          onClick={handleCopy}
          aria-label={copiedText}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{copiedText}</p>
      </TooltipContent>
    </Tooltip>
  );
}
