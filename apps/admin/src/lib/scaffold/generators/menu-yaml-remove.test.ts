import { describe, expect, it } from 'vitest';
import { removeMenuBlock } from './menu-yaml-remove';

const SAMPLE = `# Comentário de topo
- order: 1000
  icon: settings-2
  slug: /core/management
  relations:
    role:
      - where:
          slug: admin

- menu_id:
    where:
      slug: /core/management
  url: /core/pages
  order: 11
  icon: layout-template
  name:
    en: Pages
    pt: Páginas
  slug: /core/pages
  relations:
    role:
      - where:
          slug: admin

- menu_id:
    where:
      slug: /core/management
  url: /core/access-log
  order: 12
  slug: /core/access-log
  relations:
    role:
      - where:
          slug: admin
`;

describe('removeMenuBlock', () => {
  it('remove o item pelo slug de topo, preservando os vizinhos', () => {
    const { contents, removed } = removeMenuBlock(SAMPLE, '/core/pages');

    expect(removed).toBe(true);
    expect(contents).not.toContain('url: /core/pages');
    expect(contents).toContain('slug: /core/management');
    expect(contents).toContain('url: /core/access-log');
    expect(contents).toContain('# Comentário de topo');
  });

  it('não confunde o slug do menu pai com o slug de topo', () => {
    // '/core/management' aparece como lookup do pai em dois itens, mas é o slug
    // de topo apenas do primeiro — só esse deve sair.
    const { contents, removed } = removeMenuBlock(SAMPLE, '/core/management');

    expect(removed).toBe(true);
    expect(contents).toContain('url: /core/pages');
    expect(contents).toContain('url: /core/access-log');
    // O item de topo /core/management some (não sobra um item cujo último slug seja ele).
    const topLevelManagement = contents
      .split('\n')
      .filter((line) => /^- /.test(line)).length;
    expect(topLevelManagement).toBe(2);
  });

  it('não altera nada quando o slug não existe', () => {
    const { contents, removed } = removeMenuBlock(SAMPLE, '/core/ghost');

    expect(removed).toBe(false);
    expect(contents).toBe(SAMPLE);
  });

  it('termina com uma única quebra de linha', () => {
    const { contents } = removeMenuBlock(SAMPLE, '/core/pages');

    expect(contents.endsWith('\n')).toBe(true);
    expect(contents.endsWith('\n\n')).toBe(false);
  });
});
