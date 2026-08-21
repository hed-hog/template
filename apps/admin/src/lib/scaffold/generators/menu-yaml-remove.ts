export type MenuBlockRemovalResult = {
  contents: string;
  removed: boolean;
};

/**
 * Divide o YAML em blocos de item de topo. Cada item começa com `- ` na coluna 0;
 * tudo até o próximo `- ` (ou o fim do arquivo) pertence ao mesmo item. Preserva
 * o texto exatamente como está — não reserializa, então comentários e formatação
 * dos outros itens ficam intactos.
 */
function splitTopLevelItems(source: string): string[] {
  const lines = source.split('\n');
  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^- /.test(line)) {
      // Fecha o bloco anterior (item ou preâmbulo de comentários) antes de abrir
      // o novo item, para não descartar o que veio antes do primeiro `- `.
      if (current.length > 0) {
        blocks.push(current.join('\n'));
      }
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    blocks.push(current.join('\n'));
  }

  return blocks;
}

/**
 * Slug de topo do item: a chave `slug:` indentada com exatamente 2 espaços
 * (filha direta do `- `). O lookup do menu pai (`menu_id.where.slug`) fica a 6
 * espaços e os cargos a 10 — nenhum casa este padrão.
 */
function itemOwnSlug(block: string): string | null {
  const match = block.match(/^ {2}slug:\s*['"]?(\S+?)['"]?\s*$/m);
  return match?.[1] ?? null;
}

/**
 * Remove do `menu.yaml` o item de topo cujo `slug:` próprio é `slug` — nunca o
 * item errado por causa do slug do menu pai ou de um cargo.
 */
export function removeMenuBlock(
  source: string,
  slug: string
): MenuBlockRemovalResult {
  const blocks = splitTopLevelItems(source);
  let removed = false;

  const kept = blocks.filter((block) => {
    if (!/^- /.test(block)) {
      // Preâmbulo (comentários antes do primeiro item): nunca remove.
      return true;
    }

    if (itemOwnSlug(block) === slug) {
      removed = true;
      return false;
    }

    return true;
  });

  if (!removed) {
    return { contents: source, removed: false };
  }

  // Normaliza linhas em branco acumuladas pela remoção do bloco.
  const contents = kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\n+/, '');

  return { contents: contents.endsWith('\n') ? contents : `${contents}\n`, removed: true };
}
