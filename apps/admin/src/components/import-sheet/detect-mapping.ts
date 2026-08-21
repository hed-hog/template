/**
 * Column auto-detection for the CSV import wizard.
 *
 * Kept free of React and UI imports so it can be exercised on its own — the
 * matching rules are where a bad call silently corrupts an import.
 */

export type ImportField = {
  /** Value sent to the backend as the target field for a mapped column. */
  value: string;
  /** Already-resolved, human-readable label shown in the UI. */
  label: string;
  /** When false, mapping this field to more than one column raises a warning. */
  allowMultiple?: boolean;
  /**
   * Alternative header spellings used by the auto-detection. Compared without
   * accents, case or punctuation, so `"CEP"` matches a `Endereço — CEP` column.
   */
  aliases?: string[];
};

export type ColumnMapping = Record<string, string>;

export const IGNORE_VALUE = '_ignore';

/** Sentinel picked in the field `<Select>` to turn a column into a custom field. */
export const CUSTOM_OPTION = '__custom__';

/** Prefix that carries a user-named field inside the existing mapping payload. */
export const CUSTOM_PREFIX = 'custom:';

export function isCustomValue(value: string) {
  return value.startsWith(CUSTOM_PREFIX);
}

export function customKeyOf(value: string) {
  return isCustomValue(value) ? value.slice(CUSTOM_PREFIX.length) : '';
}

/**
 * Turns a header into the two shapes the matcher compares against:
 * `"Endereço — Número"` → `{ spaced: 'endereco numero', compact: 'endereconumero' }`.
 *
 * Keeping the spaced form is what stops `"endereco"` from matching
 * `"Endereço — Número"` and `"Endereço — Logradouro"` alike; the compact form
 * is what makes `job_title`, `jobTitle` and `Job Title` collapse into one.
 */
function normalizeHeader(raw: string) {
  const spaced = String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

  return { spaced, compact: spaced.replace(/ /g, '') };
}

/** `"Tamanho da camiseta"` → `"tamanho_da_camiseta"`. */
export function normalizeCustomKey(raw: string) {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

/**
 * Suggests a `csvColumn → field` mapping from the header row.
 *
 * Matching is exact (after normalisation) on purpose. A substring tier was
 * tried and dropped: `"Endereço de cobrança CEP"` matched the generic
 * `endereco` alias of the street field and never reached `cep`, silently
 * mapping a postcode column to the street. Compound aliases
 * (`endereco cep`, `endereco numero`, …) cover the same headers without the
 * ambiguity.
 *
 * Runs in tiers of decreasing confidence and never guesses when a tier leaves
 * more than one candidate for a column — a silently wrong mapping costs the
 * user more than an unmapped column they can see and fix.
 */
export function detectMapping(
  columns: string[],
  fields: ImportField[]
): ColumnMapping {
  const assigned: ColumnMapping = {};
  const consumed = new Set<string>();

  const candidates = fields
    .filter((field) => field.value !== IGNORE_VALUE)
    .map((field) => ({
      field,
      value: normalizeHeader(field.value),
      label: normalizeHeader(field.label),
      aliases: (field.aliases ?? []).map(normalizeHeader),
    }));

  const normalizedColumns = columns.map((column) => ({
    column,
    header: normalizeHeader(column),
  }));

  const sameAs = (a: { spaced: string; compact: string }, b: typeof a) =>
    (a.spaced.length > 0 && a.spaced === b.spaced) ||
    (a.compact.length > 0 && a.compact === b.compact);

  type Tier = (
    header: { spaced: string; compact: string },
    candidate: (typeof candidates)[number]
  ) => boolean;

  const tiers: Tier[] = [
    (header, candidate) => sameAs(header, candidate.value),
    (header, candidate) => sameAs(header, candidate.label),
    (header, candidate) =>
      candidate.aliases.some((alias) => sameAs(header, alias)),
  ];

  for (const matches of tiers) {
    for (const { column, header } of normalizedColumns) {
      if (assigned[column]) continue;
      if (!header.compact) continue;

      const hits = candidates.filter(
        (candidate) =>
          !consumed.has(candidate.field.value) && matches(header, candidate)
      );

      // Ambiguous — leave it for a later tier, or for the user.
      const hit = hits.length === 1 ? hits[0] : undefined;
      if (!hit) continue;

      assigned[column] = hit.field.value;
      if (!hit.field.allowMultiple) consumed.add(hit.field.value);
    }
  }

  const mapping: ColumnMapping = {};
  for (const column of columns) {
    mapping[column] = assigned[column] ?? IGNORE_VALUE;
  }

  return mapping;
}
