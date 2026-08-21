/**
 * Nome de pessoa entra no banco por cerca de trinta caminhos diferentes: o CRUD do CRM,
 * a importação de CSV, o cadastro social (o `name` cru que o Google/Microsoft devolve),
 * o provisionamento do banco legado, o checkout público, o ticket do SAC e os vários
 * `resolvePersonIdFromUser()` espalhados por LMS, vaults e legacy. Nenhum deles fazia
 * mais que `.trim()`, e o resultado é a listagem de pessoas com "APARECIDA DA SILVA"
 * ao lado de "drielle jhenyffer da silva colares santana".
 *
 * Corrigir cada chamador seria interminável e deixaria de fora os que ainda serão
 * escritos, então a regra roda como query extension no PrismaService — este arquivo é
 * a regra em si, separada para poder ser testada sem banco.
 *
 * A recaixa é deliberadamente conservadora: só reescreve o que está inteiramente em
 * maiúsculo ou inteiramente em minúsculo. Quem já tem caixa mista foi escrito por
 * alguém que sabia o que queria — "McDonald", "D'Ávila", "Usuário removido" — e
 * forçar Title Case ali destrói grafia correta para consertar grafia correta.
 */

/**
 * Ficam em minúsculo no meio do nome, nunca na primeira posição: "Dos Santos" só
 * existe quando é o começo do que foi digitado.
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

/**
 * Sufixos dinásticos, que o Title Case comum transformaria em "Iii". Numerais de uma
 * letra ficam de fora de propósito: "I" e "V" quase sempre são inicial de nome, e
 * saem iguais pelos dois caminhos.
 */
const ROMAN_NUMERAL = /^(?:ii|iii|iv|vi|vii|viii|ix|xi|xii)$/;

const LETTER = /\p{L}/u;

/**
 * Qualquer não-alfanumérico abre nome próprio de novo: "ana-maria", "sant'ana",
 * "j.p.". É a mesma fronteira do `initcap()` do Postgres, que a migration de
 * backfill usa — as duas implementações precisam concordar.
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

  // Vários fallbacks gravam e-mail no campo nome (`data.name ?? email` em
  // findOrCreateIndividualByEmail e em prepareAccountInvite). Recaixar transformaria
  // "joao@hcode.com.br" em "Joao@hcode.com.br", que é pior que o problema original.
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

/**
 * `commerce_customer` não tem coluna de tipo como `person`, mas tem `document`
 * (CPF ou CNPJ, nullable). CNPJ tem 14 dígitos; qualquer outra contagem — 11 dígitos de
 * CPF, formato inesperado, ou documento ausente — é tratada como pessoa física, porque
 * a maioria dos clientes de comércio é PF e um documento ausente não é sinal de
 * empresa. Aceita o valor com ou sem máscara ("12.345.678/0001-90" e "12345678000190").
 */
export function isLikelyCompanyDocument(document: unknown): boolean {
  if (typeof document !== 'string') return false;
  return document.replace(/\D/g, '').length === 14;
}

/**
 * Lê o campo de nome, aceitando a string direta ou o envelope `{ set: '...' }` do
 * Prisma. Parametrizado porque nem toda tabela guarda o nome em `name`
 * (`sac_ticket.requester_name`, `ceia_partner.contact_name`) — e algumas, como
 * `ceia_partner`, têm as duas colunas ao mesmo tempo (`name` é a organização,
 * `contact_name` é a pessoa), então usar sempre `'name'` normalizaria a coluna errada.
 */
function readName(data: unknown, field: string): string | null {
  if (!data || typeof data !== 'object') return null;

  const raw = (data as Record<string, unknown>)[field];
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object' && typeof (raw as any).set === 'string') {
    return (raw as any).set;
  }

  return null;
}

function writeName(data: any, field: string, name: string): any {
  return typeof data[field] === 'string'
    ? { ...data, [field]: name }
    : { ...data, [field]: { ...data[field], set: name } };
}

/**
 * O tipo declarado na própria escrita, quando existe. `person.type` é NOT NULL sem
 * default, então todo `create` traz; um `update` que só mexe no nome não traz e
 * precisa da consulta do chamador.
 */
function declaredType(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const raw = (data as Record<string, unknown>).type;
  return typeof raw === 'string' ? raw : null;
}

/** Nomes dos campos de `args` que carregam dados de escrita, por operação. */
function writeBranches(operation: string): string[] {
  switch (operation) {
    case 'create':
    case 'createMany':
    case 'createManyAndReturn':
    case 'update':
    case 'updateMany':
    case 'updateManyAndReturn':
      return ['data'];
    case 'upsert':
      return ['create', 'update'];
    default:
      return [];
  }
}

interface PendingRow {
  branch: string;
  index: number | null;
  formatted: string;
}

function rowsOf(branchValue: unknown): unknown[] {
  return Array.isArray(branchValue) ? branchValue : [branchValue];
}

/**
 * Aplica `formatPersonName` a todo nome que a operação vai gravar, devolvendo uma cópia
 * de `args`. Quando nada mudaria, devolve a **mesma referência** recebida — é assim que o
 * chamador sabe que pode seguir sem custo nenhum.
 *
 * `resolveIsIndividual` só é chamado quando há um nome que de fato mudaria e a própria
 * escrita não declara o tipo. Depois do backfill esse é um caminho raro, então uma
 * escrita comum nunca paga uma consulta extra ao banco.
 *
 * `field` é o nome da coluna a normalizar (default `'name'`, o caso de `person`/`user`).
 */
export async function applyPersonNameToArgs(
  operation: string,
  args: any,
  resolveIsIndividual: () => Promise<boolean>,
  field: string = 'name',
): Promise<any> {
  const branches = writeBranches(operation);
  if (branches.length === 0 || !args || typeof args !== 'object') return args;

  const decided: PendingRow[] = [];
  const undecided: PendingRow[] = [];

  for (const branch of branches) {
    const branchValue = args[branch];
    if (!branchValue || typeof branchValue !== 'object') continue;

    const isArray = Array.isArray(branchValue);

    rowsOf(branchValue).forEach((row, index) => {
      const current = readName(row, field);
      if (current === null) return;

      const formatted = formatPersonName(current);
      if (formatted === current) return;

      const pending: PendingRow = {
        branch,
        index: isArray ? index : null,
        formatted,
      };

      const type = declaredType(row);
      if (type === null) undecided.push(pending);
      else if (type === 'individual') decided.push(pending);
      // Pessoa jurídica fica fora: "HCODE TECNOLOGIA LTDA" viraria "Hcode Tecnologia Ltda".
    });
  }

  if (undecided.length > 0 && (await resolveIsIndividual())) {
    decided.push(...undecided);
  }

  if (decided.length === 0) return args;

  const next = { ...args };

  for (const { branch, index, formatted } of decided) {
    if (index === null) {
      next[branch] = writeName(next[branch], field, formatted);
      continue;
    }

    const rows = [...(next[branch] as unknown[])];
    rows[index] = writeName(rows[index], field, formatted);
    next[branch] = rows;
  }

  return next;
}
