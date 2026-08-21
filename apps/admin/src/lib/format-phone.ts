/**
 * Formatador de telefone para exibição.
 *
 * Nunca altera o dado gravado: devolve o valor cru sempre que não reconhece o
 * formato, então é seguro aplicar em qualquer campo vindo da API.
 *
 * Não confundir com os `applyPhoneMask` de `crm/person/_components/`,
 * `crm/accounts/_components/` e `commerce/_components/`: aqueles mascaram
 * durante a digitação e precisam aceitar estados intermediários.
 */
export function formatPhone(value?: string | null): string {
  if (!value) return '';

  const raw = String(value).trim();
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;

  // Outro DDI explícito (+1, +351, ...) sai sem máscara nacional brasileira.
  // Sem esta guarda, `+14155550123` (11 dígitos) viraria `(14) 15555-0123`.
  if (raw.startsWith('+') && !digits.startsWith('55')) return raw;

  // E.164 brasileiro: +5511999999999 / 5511999999999 / 551133334444.
  const isBr =
    digits.startsWith('55') && (digits.length === 12 || digits.length === 13);
  const national = isBr ? digits.slice(2) : digits;
  const prefix = isBr ? '+55 ' : '';

  // DDD válido vai de 11 a 99. Sem esta guarda, um 0800 (11 dígitos) virava
  // "(08) 00123-4567", e qualquer número não telefônico com 10 ou 11 dígitos
  // ganhava uma máscara inventada.
  if (Number(national.slice(0, 2)) < 11) return raw;

  if (national.length === 11) {
    return `${prefix}(${national.slice(0, 2)}) ${national.slice(2, 7)}-${national.slice(7)}`;
  }

  if (national.length === 10) {
    return `${prefix}(${national.slice(0, 2)}) ${national.slice(2, 6)}-${national.slice(6)}`;
  }

  return raw;
}
