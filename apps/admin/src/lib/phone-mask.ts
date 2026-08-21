/**
 * Máscara de telefone brasileiro aplicada durante a digitação:
 * `(DD) DDDDD-DDDD`, até 11 dígitos, sem DDI. Precisa tolerar estados
 * intermediários (poucos dígitos ainda) — não confundir com `formatPhone`
 * (`./format-phone.ts`), que formata um valor já completo pra exibição e
 * lida com `+55`/E.164.
 *
 * Duplicada localmente em alguns formulários mais antigos (CRM pessoa/conta,
 * comércio, chamado); centralizada aqui pra quem for escrever um campo de
 * telefone novo não precisar reinventar.
 */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function applyPhoneMask(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);

  if (digits.length <= 2) {
    return digits.length ? `(${digits}` : '';
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
