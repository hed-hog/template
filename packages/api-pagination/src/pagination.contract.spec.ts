import * as fs from 'fs';
import * as path from 'path';

/**
 * Guardas ESTÁTICAS do contrato de ordenação.
 *
 * Não exercitam código: leem as libraries e reprovam padrões que já causaram
 * bug em produção. São teste, e não regra de lint, porque `pnpm turbo run test`
 * é gate obrigatório no CI enquanto `lint` e `typecheck` rodam com
 * `continue-on-error`.
 *
 * As allowlists abaixo são dívida conhecida. Elas só encolhem: quando um item
 * é corrigido, sai da lista e nunca mais pode voltar.
 */

const LIBS = path.resolve(__dirname, '../../../libraries');

function servicos(): string[] {
  const out: string[] = [];

  const walk = (dir: string) => {
    for (const nome of fs.readdirSync(dir)) {
      const p = path.join(dir, nome);
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        if (nome === 'node_modules' || nome === 'dist') continue;
        walk(p);
      } else if (nome.endsWith('.service.ts') && !nome.endsWith('.spec.ts')) {
        out.push(p);
      }
    }
  };

  for (const lib of fs.readdirSync(LIBS)) {
    const src = path.join(LIBS, lib, 'src');
    if (fs.existsSync(src)) walk(src);
  }

  return out;
}

function mcpTools(): string[] {
  const out: string[] = [];

  const walk = (dir: string) => {
    for (const nome of fs.readdirSync(dir)) {
      const p = path.join(dir, nome);
      const st = fs.statSync(p);
      if (st.isDirectory()) {
        if (nome === 'node_modules' || nome === 'dist') continue;
        walk(p);
      } else if (nome.endsWith('.mcp-tools.ts') && !nome.endsWith('.spec.ts')) {
        out.push(p);
      }
    }
  };

  for (const lib of fs.readdirSync(LIBS)) {
    const src = path.join(LIBS, lib, 'src');
    if (fs.existsSync(src)) walk(src);
  }

  return out;
}

const rel = (p: string) => path.relative(LIBS, p).replace(/\\/g, '/');

/**
 * Extrai o bloco de argumentos de cada chamada a `paginatePrismaModel(`,
 * contando parênteses para não parar num aninhado.
 */
function chamadas(src: string, nome: string): string[] {
  const out: string[] = [];
  let idx = src.indexOf(nome);

  while (idx !== -1) {
    let depth = 0;
    let buf = '';
    for (let i = idx; i < src.length; i++) {
      const ch = src[i];
      if (ch === '(') depth++;
      if (depth > 0) buf += ch;
      if (ch === ')') {
        depth--;
        if (depth === 0) break;
      }
    }
    out.push(buf);
    idx = src.indexOf(nome, idx + nome.length);
  }

  return out;
}

/**
 * Procura uma chave no PRIMEIRO nível do objeto de opções, contando chaves.
 *
 * Indentação não serve como critério: `vaults/vault.service.ts` tem um
 * `orderBy` dentro de `include.vault_person` recuado no mesmo nível de um de
 * topo, e uma regex por espaços o acusava — falso positivo, que é pior que não
 * ter guarda nenhuma.
 */
function temChaveDeTopo(args: string, chave: string): boolean {
  let depth = 0;

  for (let i = 0; i < args.length; i++) {
    const ch = args[i];

    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      continue;
    }

    // Nível 1 = dentro do objeto de opções, fora de qualquer aninhado.
    if (depth !== 1) continue;
    if (!args.startsWith(chave, i)) continue;

    // Tem que ser início de propriedade, não sufixo de outra palavra.
    const anterior = args[i - 1];
    if (anterior && /[A-Za-z0-9_$]/.test(anterior)) continue;

    return true;
  }

  return false;
}

describe('contrato de ordenação — guardas estáticas', () => {
  it('nenhum service declara validSortFields junto com orderBy fixo', () => {
    // Quando os dois coexistem, o `orderBy` vence e a allowlist nunca é
    // consultada: alguém escreveu a lista achando que estava habilitando
    // ordenação, e a tela manda `sortField` para ser ignorado.
    // Lista vazia = regra fechada. Os tres services do fiscal que estavam
    // aqui ganharam descritor e sairam.
    const DIVIDA_CONHECIDA: string[] = [];

    const encontrados: string[] = [];

    for (const arquivo of servicos()) {
      const src = fs.readFileSync(arquivo, 'utf8');
      for (const args of chamadas(src, 'paginatePrismaModel(')) {
        if (
          temChaveDeTopo(args, 'validSortFields:') &&
          temChaveDeTopo(args, 'orderBy:')
        ) {
          encontrados.push(rel(arquivo));
          break;
        }
      }
    }

    const novos = encontrados.filter((f) => !DIVIDA_CONHECIDA.includes(f));
    expect(novos).toEqual([]);

    // A lista só encolhe: item corrigido tem que sair daqui.
    const corrigidos = DIVIDA_CONHECIDA.filter((f) => !encontrados.includes(f));
    expect(corrigidos).toEqual([]);
  });

  it('nenhum service passa `sort` e `orderBy` na mesma chamada', () => {
    // O descritor já carrega a ordem padrão; um `orderBy` ao lado dele é
    // ignorado e vira duas fontes de verdade para a mesma coisa.
    //
    // Os dois métodos entram aqui, e por motivos diferentes. O
    // `paginatePrismaModel` ao menos avisa em log quando os dois aparecem
    // juntos; o `paginate` não avisa nada — ele resolve a precedência em
    // silêncio (`pagination.service.ts:351-357`), e foi por lá que o commerce
    // entrou, com o descritor no 5º parâmetro e o `orderBy` ainda no 3º.
    //
    // A contagem de chaves funciona para os dois formatos: em `paginate` o
    // `orderBy` mora no objeto de `customQuery` e o `sort` no de `options`,
    // mas ambos ficam a um nível de profundidade dentro dos argumentos.
    const METODOS = ['paginatePrismaModel(', 'paginate('];
    const encontrados: string[] = [];

    for (const arquivo of servicos()) {
      const src = fs.readFileSync(arquivo, 'utf8');
      const conflita = METODOS.some((metodo) =>
        chamadas(src, metodo).some(
          (args) =>
            temChaveDeTopo(args, 'sort:') && temChaveDeTopo(args, 'orderBy:'),
        ),
      );

      if (conflita) encontrados.push(rel(arquivo));
    }

    expect(encontrados).toEqual([]);
  });

  it('tool MCP que aceita sortField declara o enum dos campos válidos', () => {
    // Sem `enum`, o modelo chuta o nome do campo e leva 400. Com descritor, o
    // enum sai de `toMcpProperties()` e não tem como divergir da allowlist.
    const DIVIDA_CONHECIDA = [
      'core/src/mcp/tools/core-ai.mcp-tools.ts',
      'core/src/mcp/tools/core-dashboard.mcp-tools.ts',
      'core/src/mcp/tools/core-event-webhooks.mcp-tools.ts',
      'core/src/mcp/tools/core-files.mcp-tools.ts',
      'core/src/mcp/tools/core-integration-events.mcp-tools.ts',
      'core/src/mcp/tools/core-mail-sent.mcp-tools.ts',
      'core/src/mcp/tools/core-mail.mcp-tools.ts',
      'core/src/mcp/tools/core-menus.mcp-tools.ts',
      'core/src/mcp/tools/core-roles.mcp-tools.ts',
      'core/src/mcp/tools/core-routes.mcp-tools.ts',
      'core/src/mcp/tools/core-screens.mcp-tools.ts',
      'core/src/mcp/tools/core-settings.mcp-tools.ts',
      'core/src/mcp/tools/core-users.mcp-tools.ts',
      'core/src/mcp/tools/core-webhooks.mcp-tools.ts',
      // `operations` ainda usa `normalizePaginationParams` com allowlist inline
      // em cada método. Copiar a lista para o schema aqui reintroduziria a
      // duplicação que o descritor existe para evitar — sai desta lista quando
      // a library migrar para `defineSortable`.
      'operations/src/mcp-tools/operations-projects.mcp-tools.ts',
    ];

    const semEnum: string[] = [];

    for (const arquivo of mcpTools()) {
      const src = fs.readFileSync(arquivo, 'utf8');
      // `sortField: { ... }` dentro de um inputSchema, sem `enum` no bloco.
      const blocos = src.match(/sortField:\s*\{[^}]*\}/g) ?? [];
      if (blocos.some((b) => !b.includes('enum'))) {
        semEnum.push(rel(arquivo));
      }
    }

    const novos = semEnum.filter((f) => !DIVIDA_CONHECIDA.includes(f));
    expect(novos).toEqual([]);

    const corrigidos = DIVIDA_CONHECIDA.filter((f) => !semEnum.includes(f));
    expect(corrigidos).toEqual([]);
  });
});
