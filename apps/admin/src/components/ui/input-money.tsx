import * as React from 'react';

import { cn } from '@/lib/utils';

function formatNumberToMoney(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatStringToMoney(value: string) {
  const trimmedValue = value.trim();

  if (trimmedValue === '') {
    return '';
  }

  if (/[,.]/.test(trimmedValue)) {
    const normalizedValue = trimmedValue.replace(/\./g, '').replace(',', '.');
    const parsedValue = Number(normalizedValue);

    if (!Number.isNaN(parsedValue)) {
      return formatNumberToMoney(parsedValue);
    }
  }

  const onlyDigits = trimmedValue.replace(/\D/g, '');

  if (onlyDigits === '') {
    return '';
  }

  const parsedDigits = Number(onlyDigits);

  /* v8 ignore next 3 -- unreachable: onlyDigits is pre-filtered to digit characters only, so Number() never returns NaN here */
  if (Number.isNaN(parsedDigits)) {
    return '';
  }

  return formatNumberToMoney(parsedDigits / 100);
}

function maskInputValue(value: string) {
  const onlyDigits = value.replace(/\D/g, '');

  if (onlyDigits === '') {
    return '';
  }

  const parsedDigits = Number(onlyDigits);

  /* v8 ignore next 3 -- unreachable: onlyDigits is pre-filtered to digit characters only, so Number() never returns NaN here */
  if (Number.isNaN(parsedDigits)) {
    return '';
  }

  return formatNumberToMoney(parsedDigits / 100);
}

function formatValueToMoney(
  value: string | number | readonly string[] | undefined
) {
  if (typeof value === 'number') {
    if (Number.isNaN(value)) {
      return '';
    }

    return formatNumberToMoney(value);
  }

  if (typeof value === 'string') {
    return formatStringToMoney(value);
  }

  return '';
}

function parseMoneyToNumber(value: string) {
  const normalizedValue = value.replace(/\./g, '').replace(',', '.');
  const parsedValue = Number(normalizedValue);

  /* v8 ignore next 3 -- unreachable: this is only ever called with maskedValue, which is always a valid formatted money string, so Number() never returns NaN here */
  if (Number.isNaN(parsedValue)) {
    return null;
  }

  return parsedValue;
}

// The digit sequence is the "calculator-style" source of truth.
// "1.234,56" -> "123456" ; "" -> ""
function digitsFromMoney(formatted: string) {
  return formatted.replace(/\D/g, '');
}

function moveCaretToEnd(el: HTMLInputElement) {
  const end = el.value.length;

  try {
    el.setSelectionRange(end, end);
  } catch {
    // some browsers throw if the element isn't focused/visible
  }
}

// Updates the input's value bypassing React's internal tracker,
// so the dispatched "input" event makes the real onChange run normally.
function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;

  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

type InputMoneyProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'inputMode'
> & {
  onValueChange?: (value: number | null) => void;
};

const InputMoney = React.forwardRef<HTMLInputElement, InputMoneyProps>(
  (
    {
      className,
      onChange,
      onValueChange,
      onBeforeInput,
      onFocus,
      onPointerUp,
      value,
      defaultValue,
      ...props
    },
    forwardedRef
  ) => {
    const isControlled = value !== undefined;

    const [internalValue, setInternalValue] = React.useState(() =>
      formatValueToMoney(defaultValue)
    );

    const formattedValue = React.useMemo(
      () => (isControlled ? formatValueToMoney(value) : internalValue),
      [internalValue, isControlled, value]
    );

    const formattedDefaultValue = React.useMemo(() => {
      if (defaultValue === undefined) {
        return undefined;
      }

      return formatValueToMoney(defaultValue);
    }, [defaultValue]);

    const innerRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;

        if (typeof forwardedRef === 'function') {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );

    const handleChange = React.useCallback(
      (event: React.ChangeEvent<HTMLInputElement>) => {
        const maskedValue = maskInputValue(event.target.value);

        event.target.value = maskedValue;
        moveCaretToEnd(event.target);

        if (!isControlled) {
          setInternalValue(maskedValue);
        }

        onChange?.(event);
        onValueChange?.(
          maskedValue === '' ? null : parseMoneyToNumber(maskedValue)
        );
      },
      [isControlled, onChange, onValueChange]
    );

    const handleBeforeInput = React.useCallback(
      (event: React.InputEvent<HTMLInputElement>) => {
        onBeforeInput?.(event);

        if (event.defaultPrevented) {
          return;
        }

        const el = event.currentTarget;
        const { nativeEvent } = event;
        const { inputType } = nativeEvent;

        const currentDigits = digitsFromMoney(el.value);
        const hasFullSelection =
          el.selectionStart === 0 &&
          el.selectionEnd === el.value.length &&
          el.value.length > 0;

        let nextDigits: string;

        switch (inputType) {
          case 'insertText':
          case 'insertCompositionText': {
            const incoming = (nativeEvent.data ?? '').replace(/\D/g, '');

            if (incoming === '') {
              // blocks non-numeric characters (comma, period, letters)
              event.preventDefault();
              return;
            }

            nextDigits = (hasFullSelection ? '' : currentDigits) + incoming;
            break;
          }
          case 'deleteContentBackward':
          case 'deleteContentForward': {
            nextDigits = hasFullSelection ? '' : currentDigits.slice(0, -1);
            break;
          }
          default:
            // paste, cut, undo/redo, drop and others: let handleChange
            // (fallback) re-mask the whole value, preserving current behavior
            return;
        }

        event.preventDefault();
        setNativeValue(el, maskInputValue(nextDigits));
      },
      [onBeforeInput]
    );

    const handleFocus = React.useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        onFocus?.(event);

        // after focus settles (covers autoFocus and manual focus)
        requestAnimationFrame(() => {
          if (innerRef.current) {
            moveCaretToEnd(innerRef.current);
          }
        });
      },
      [onFocus]
    );

    const handlePointerUp = React.useCallback(
      (event: React.PointerEvent<HTMLInputElement>) => {
        onPointerUp?.(event);

        const el = event.currentTarget;

        // simple click (no selection) goes to the end; drag-to-select is preserved
        if (el.selectionStart === el.selectionEnd) {
          moveCaretToEnd(el);
        }
      },
      [onPointerUp]
    );

    // Safe post-render step in controlled mode: keeps the caret at the end when
    // the formatted value changes while the field is focused. useEffect (rather
    // than useLayoutEffect) avoids an SSR warning in Next without an isomorphic helper.
    React.useEffect(() => {
      const el = innerRef.current;

      if (!el || document.activeElement !== el) {
        return;
      }

      moveCaretToEnd(el);
    }, [formattedValue]);

    return (
      <input
        ref={setRefs}
        type="text"
        inputMode="decimal"
        data-slot="input"
        className={cn(
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          className
        )}
        onBeforeInput={handleBeforeInput}
        onChange={handleChange}
        onFocus={handleFocus}
        onPointerUp={handlePointerUp}
        value={formattedValue}
        defaultValue={isControlled ? undefined : formattedDefaultValue}
        {...props}
      />
    );
  }
);

InputMoney.displayName = 'InputMoney';

export { InputMoney };
