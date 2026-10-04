/**
 * Máscara de data brasileira aplicada durante a digitação: `dd/mm/aaaa`, até 8
 * dígitos. Precisa tolerar estados intermediários (poucos dígitos ainda) — não
 * confundir com `formatDateOnly` (`./format-date.ts`), que formata um valor já
 * completo pra exibição e respeita a setting `date-format` do usuário.
 *
 * Mesma convenção de `./phone-mask.ts`: os dígitos são a fonte da verdade e o
 * separador só aparece atrás de dígito já digitado — uma barra à direita
 * (`01/`) travaria o Backspace no separador.
 */
const MIN_YEAR = 1900;
const MAX_YEAR = 2999;

export function onlyDateDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, 8);
}

export function applyDateMask(value: string): string {
  const digits = onlyDateDigits(value);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/**
 * Só interpreta com os 8 dígitos completos: `01/08/____` e o ano `0026` ainda
 * sendo digitado nunca viram data. A validação é por ida e volta porque o
 * `new Date` corrige em silêncio (30/02 vira 01/03), então 32/01, mês 13 e
 * 30 de fevereiro caem aqui.
 */
export function maskToDate(masked: string): Date | null {
  const digits = onlyDateDigits(masked);

  if (digits.length < 8) {
    return null;
  }

  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));

  if (month < 1 || month > 12) {
    return null;
  }

  if (year < MIN_YEAR || year > MAX_YEAR) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

/** Data pela metade: o usuário começou a digitar e ainda não terminou. */
export function isDateMaskPartial(masked: string): boolean {
  const length = onlyDateDigits(masked).length;

  return length > 0 && length < 8;
}
/** Texto completo (8 dígitos) que não vira data — o anel vermelho do campo. */
export function isDateMaskInvalid(masked: string): boolean {
  return onlyDateDigits(masked).length === 8 && maskToDate(masked) === null;
}

export function dateToMask(date: Date | null | undefined): string {
  if (!date) {
    return '';
  }

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');

  return `${day}/${month}/${date.getFullYear()}`;
}
