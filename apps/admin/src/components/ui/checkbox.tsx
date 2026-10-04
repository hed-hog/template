'use client';

import * as CheckboxPrimitive from '@radix-ui/react-checkbox';
import { CheckIcon } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        'peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive size-4 shrink-0 rounded-lg border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="grid place-content-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
}

/**
 * Mesmo visual do `Checkbox`, sem o primitive do Radix: para linha de lista em
 * que o clique já é tratado pelo item (cmdk) e a caixa só mostra o estado.
 *
 * O `Checkbox.Root` do Radix (1.1.x) guarda o próprio botão em estado por um ref
 * callback recriado a cada render; no React 19 isso vira loop de atualização
 * (React #185) quando muitas linhas re-renderizam juntas, como numa lista de
 * seleção múltipla.
 */
function CheckboxMark({
  checked,
  className,
}: {
  checked: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      data-slot="checkbox"
      data-state={checked ? 'checked' : 'unchecked'}
      className={cn(
        'border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary grid size-4 shrink-0 place-content-center rounded-lg border shadow-xs',
        className
      )}
    >
      {checked ? <CheckIcon className="size-3.5" /> : null}
    </span>
  );
}

export { Checkbox, CheckboxMark };
