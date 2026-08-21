function sqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Migration idempotente que remove um item de menu pelo slug, junto com suas
 * traduções e vínculos de cargo. Espelha a remoção do bloco em `menu.yaml`.
 *
 * As FKs de `menu_locale` e `role_menu` são `ON DELETE CASCADE`, mas os deletes
 * são explícitos para deixar claro ao revisor o que sai. Não remove menus
 * filhos: o wizard só gera esta migration quando o item não tem filhos.
 */
export function generateMenuRemovalSql(
  slug: string,
  labelPt: string
): string {
  const literal = sqlLiteral(slug);

  return [
    `-- Remove o menu ${slug} (${labelPt}).`,
    '--',
    '-- Gerado pela exclusão de página em /core/pages. Espelha a remoção do bloco',
    '-- correspondente em libraries/<lib>/hedhog/data/menu.yaml.',
    '--',
    '-- Idempotente: seguro rodar múltiplas vezes.',
    '',
    'DO $$',
    'DECLARE',
    '  v_menu_id INT;',
    'BEGIN',
    `  SELECT id INTO v_menu_id FROM "menu" WHERE slug = ${literal} LIMIT 1;`,
    '',
    '  IF v_menu_id IS NULL THEN',
    '    RETURN;',
    '  END IF;',
    '',
    '  DELETE FROM "role_menu" WHERE menu_id = v_menu_id;',
    '  DELETE FROM "menu_locale" WHERE menu_id = v_menu_id;',
    '  DELETE FROM "menu" WHERE id = v_menu_id;',
    'END $$;',
    '',
  ].join('\n');
}

export function menuRemovalFolderName(
  library: string,
  slug: string,
  timestamp: string
): string {
  const safeSlug = slug.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');

  return `${timestamp}_${library}_remove_${safeSlug}_menu`;
}
