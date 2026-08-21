/**
 * Reduz uma tag de idioma ao code de 2-3 letras usado na tabela `locale`.
 *
 * A tabela guarda `code` como `char(2)` (`en`, `pt`, `es`), entao qualquer tag
 * regional que chegue crua ate o banco nao encontra registro. Era o que
 * silenciava os e-mails do commerce, que chamavam o envio com `'pt-BR'`:
 * `locale.findUnique({ where: { code: 'pt-BR' } })` nao acha nada, o envio
 * lanca e o `catch` do MailService engole.
 *
 * Aceita o header `Accept-Language` inteiro (`pt-BR,pt;q=0.9,en;q=0.8`), a tag
 * isolada (`pt-BR`, `pt_BR`) ou o code puro (`PT`).
 *
 * ATENCAO: existem outros `normalizeLocale` privados no monorepo com semantica
 * DIFERENTE e incompativel - `certificate.service.ts` preserva a regiao e
 * `dashboard.service.ts` expande para a tag completa com default `pt-BR`. Este
 * aqui so faz a reducao ao code da tabela `locale`; nao e substituto deles.
 */
export function normalizeLocaleCode(locale?: string | null): string | null {
  const first = String(locale ?? '')
    .split(',')[0]   // "pt-BR,en;q=0.9" -> "pt-BR"
    .split(';')[0]   // "pt;q=0.9"       -> "pt"
    .trim()
    .toLowerCase();

  // `_` aparece em locale vindo de plataforma nativa (`pt_BR` no Android).
  const code = first.split(/[-_]/)[0].trim();

  return /^[a-z]{2,3}$/.test(code) ? code : null;
}
