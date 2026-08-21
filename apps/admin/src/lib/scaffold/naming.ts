/** Helpers de nomenclatura. A entrada canônica é sempre snake_case. */

function splitWords(value: string): string[] {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .split(/[^A-Za-z0-9]+/)
    .filter(Boolean);
}

export function toPascalCase(value: string): string {
  return splitWords(value)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('');
}

export function toCamelCase(value: string): string {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toKebabCase(value: string): string {
  return splitWords(value)
    .map((word) => word.toLowerCase())
    .join('-');
}

export function toSnakeCase(value: string): string {
  return splitWords(value)
    .map((word) => word.toLowerCase())
    .join('_');
}

/** Título legível a partir do identificador, usado como fallback de label. */
export function toTitleCase(value: string): string {
  return splitWords(value)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Pluralização simples em inglês, suficiente para rotas e nomes de menu.
 * O wizard sempre deixa o resultado editável pelo usuário.
 */
export function pluralize(value: string): string {
  if (/(s|x|z|ch|sh)$/i.test(value)) {
    return `${value}es`;
  }

  if (/[^aeiou]y$/i.test(value)) {
    return `${value.slice(0, -1)}ies`;
  }

  return `${value}s`;
}
