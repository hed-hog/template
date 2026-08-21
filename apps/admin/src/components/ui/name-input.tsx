import * as React from 'react';

import { formatPersonName } from '@/lib/format-person-name';

import { Input } from './input';

/**
 * Espelha `setNativeValue` de `input-money.tsx`: atualiza o valor pelo setter nativo do
 * DOM e dispara um `input` real, para que o `onChange` do chamador (RHF ou não) receba o
 * valor formatado como se o usuário tivesse digitado — em vez de substituir o `onChange`
 * recebido, que quebraria o rastreamento de `field` do react-hook-form.
 */
function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;

  setter?.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

type NameInputProps = React.ComponentProps<'input'> & {
  /**
   * Pessoa jurídica não é normalizada: "HCODE TECNOLOGIA LTDA" viraria
   * "Hcode Tecnologia Ltda", degradando sigla e razão social corretas. Repassar o mesmo
   * `type === 'company'` do formulário aqui evita que o campo mostre, antes de salvar,
   * um formato que o backend não vai gravar (packages/api-prisma/src/format-person-name.ts
   * já faz a mesma distinção pelo lado do servidor).
   */
  isCompany?: boolean;
};

/**
 * Só formata no blur, nunca durante a digitação — diferente de `InputMoney`, que
 * remascara a cada tecla. Aqui o objetivo é so mostrar, antes de salvar, o mesmo
 * resultado que o backend já garante.
 */
const NameInput = React.forwardRef<HTMLInputElement, NameInputProps>(
  ({ isCompany, onBlur, ...props }, ref) => {
    const handleBlur = React.useCallback(
      (event: React.FocusEvent<HTMLInputElement>) => {
        if (!isCompany) {
          const formatted = formatPersonName(event.target.value);

          if (formatted !== event.target.value) {
            setNativeValue(event.currentTarget, formatted);
          }
        }

        onBlur?.(event);
      },
      [isCompany, onBlur]
    );

    return <Input ref={ref} onBlur={handleBlur} {...props} />;
  }
);

NameInput.displayName = 'NameInput';

export { NameInput };
