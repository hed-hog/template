/**
 * Cópia local de `packages/api-prisma/src/format-person-name.ts` (`formatPersonName`).
 * O backend já garante esse formato ao salvar, via query extension do PrismaService;
 * esta cópia só antecipa o mesmo resultado no campo, ao sair dele, antes de salvar. O
 * pacote `@hed-hog/api-prisma` não é importável aqui — arrastaria `@prisma/client` e
 * `@nestjs/common` pro bundle do browser.
 *
 * As duas implementações precisam concordar. Ao mudar uma, mudar a outra e os testes
 * dos dois lados (aqui e em `packages/api-prisma/src/format-person-name.spec.ts`).
 *
 * Recaixa deliberadamente conservadora: só reescreve o que está inteiramente em
 * maiúsculo ou inteiramente em minúsculo. Caixa mista já foi escrita por alguém que
 * sabia o que queria — "McDonald", "D'Ávila", "Usuário removido" — e fica intacta.
 */

const CONNECTIVES = new Set([
  'da',
  'das',
  'de',
  'del',
  'della',
  'di',
  'do',
  'dos',
  'du',
  'e',
  'van',
  'von',
  'y',
]);

const ROMAN_NUMERAL = /^(?:ii|iii|iv|vi|vii|viii|ix|xi|xii)$/;

const LETTER = /\p{L}/u;

/**
 * Qualquer não-alfanumérico abre nome próprio de novo: "ana-maria", "sant'ana", "j.p.".
 */
const ALPHANUMERIC_RUN = /[\p{L}\p{N}]+/gu;

function capitalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(ALPHANUMERIC_RUN, (run) => run.replace(LETTER, (l) => l.toUpperCase()));
}

function formatWord(word: string, isFirst: boolean): string {
  const lowered = word.toLowerCase();

  if (!isFirst && CONNECTIVES.has(lowered)) return lowered;
  if (ROMAN_NUMERAL.test(lowered)) return lowered.toUpperCase();

  return capitalizeWord(word);
}

/**
 * Devolve o nome com espaços normalizados e, quando aplicável, em Title Case pt-BR.
 * Nomes que já têm caixa mista voltam apenas com os espaços ajustados.
 */
export function formatPersonName(value: unknown): string {
  const collapsed = String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ');

  if (collapsed === '') return collapsed;

  // Fallbacks do backend gravam e-mail no campo nome; recaixar transformaria
  // "joao@example.com" em "Joao@example.com", pior que o problema original.
  if (collapsed.includes('@')) return collapsed;
  if (!LETTER.test(collapsed)) return collapsed;

  const isAllUpper = collapsed === collapsed.toUpperCase();
  const isAllLower = collapsed === collapsed.toLowerCase();
  if (!isAllUpper && !isAllLower) return collapsed;

  return collapsed
    .split(' ')
    .map((word, index) => formatWord(word, index === 0))
    .join(' ');
}
