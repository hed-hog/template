'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { Spinner } from '@/components/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default:
          'bg-primary cursor-pointer text-primary-foreground hover:bg-primary/90',
        destructive:
          'bg-destructive cursor-pointer text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60',
        outline:
          'border cursor-pointer bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50',
        secondary:
          'bg-secondary cursor-pointer text-secondary-foreground hover:bg-secondary/80',
        ghost:
          'hover:bg-accent cursor-pointer hover:text-accent-foreground dark:hover:bg-accent/50',
        link: 'text-primary cursor-pointer underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-9 px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-10 rounded-md px-6 has-[>svg]:px-4',
        icon: 'size-9',
        'icon-sm': 'size-8',
        'icon-lg': 'size-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
    /**
     * Força o estado de carregando. Vence a detecção automática.
     * Use em submit de formulário, onde a assincronia não passa pelo onClick.
     */
    loading?: boolean;
    /** Texto que substitui o label enquanto carrega (ex.: "Salvando..."). */
    loadingLabel?: React.ReactNode;
    /**
     * Obrigatório em botões só-com-ícone (size `icon`, `icon-sm`, `icon-lg`).
     * Quando for string, também vira o `aria-label` do botão.
     */
    tooltip?: React.ReactNode;
    tooltipSide?: React.ComponentProps<typeof TooltipContent>['side'];
  };

function isThenable(value: unknown): value is Promise<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

function isIconSize(size: ButtonProps['size']) {
  return typeof size === 'string' && size.startsWith('icon');
}

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading,
  loadingLabel,
  tooltip,
  tooltipSide,
  children,
  disabled,
  onClick,
  ...props
}: ButtonProps) {
  const [autoPending, setAutoPending] = React.useState(false);
  const mountedRef = React.useRef(true);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const iconOnly = isIconSize(size);
  const ariaLabel =
    props['aria-label'] ?? (typeof tooltip === 'string' ? tooltip : undefined);

  // Com asChild o filho é único e não dá para injetar o spinner sem quebrar o Slot.
  const supportsPending = !asChild;
  const pending = supportsPending && (loading ?? autoPending);
  const isDisabled = Boolean(disabled) || pending;

  React.useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    if (asChild && loading !== undefined) {
      console.warn(
        '[Button] `loading` é ignorado junto com `asChild`: o Slot exige um filho único. Renderize o spinner dentro do filho.'
      );
    }
    if (iconOnly && !tooltip && !ariaLabel && !props.title) {
      console.warn(
        '[Button] Botão só-com-ícone sem rótulo. Passe `tooltip` (padrão do admin) ou, no mínimo, `aria-label`.'
      );
    }
  }, [asChild, loading, iconOnly, tooltip, ariaLabel, props.title]);

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (pending) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    const result = onClick?.(event) as unknown;

    if (!supportsPending || !isThenable(result)) {
      return;
    }

    setAutoPending(true);
    const settle = () => {
      if (mountedRef.current) {
        setAutoPending(false);
      }
    };
    // O rethrow preserva o comportamento original da Promise do chamador.
    result.then(settle, (error: unknown) => {
      settle();
      throw error;
    });
  };

  // aria-hidden: o Spinner traz `role="status"` e `aria-label="Loading"`, que
  // entrariam no nome acessível do botão ("Loading Salvar"). O estado já é
  // anunciado pelo `aria-busy` abaixo.
  const spinner = (
    <Spinner
      data-slot="button-spinner"
      aria-hidden
      role={undefined}
      aria-label={undefined}
    />
  );

  const content = pending ? (
    iconOnly ? (
      spinner
    ) : (
      <>
        {spinner}
        {loadingLabel ?? children}
      </>
    )
  ) : (
    children
  );

  const Comp = asChild ? Slot : 'button';

  const button = (
    <Comp
      data-slot="button"
      data-loading={pending ? '' : undefined}
      aria-busy={pending || undefined}
      aria-label={ariaLabel}
      className={cn(
        buttonVariants({ variant, size, className }),
        // O spinner ocupa o lugar do ícone original, então a largura não pula.
        pending && !iconOnly && '[&>svg:not([data-slot=button-spinner])]:hidden'
      )}
      disabled={isDisabled}
      onClick={handleClick}
      {...props}
    >
      {content}
    </Comp>
  );

  if (!tooltip) {
    return button;
  }

  // O TooltipProvider local mantém o botão autossuficiente: o Radix lança
  // "`Tooltip` must be used within `TooltipProvider`" fora do provider do layout.
  // Botão desabilitado não recebe eventos de ponteiro (`disabled:pointer-events-none`),
  // então o tooltip não abre nesse estado — durante o loading o próprio spinner é o feedback.
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { Button, buttonVariants };
export type { ButtonProps };
