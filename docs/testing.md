# Testes automatizados — HedHog Lab v2

Guia da base de testes do monorepo: o que existe, como rodar cada camada e como
o contrato entre API e frontend é protegido. Para o setup rápido de e2e local da
API (docker-compose + `.env`), veja também [TESTING.md](../TESTING.md).

---

## 1. Estratégia — a pirâmide de testes

| Camada | O que garante | Ferramenta | Onde |
|---|---|---|---|
| **Contrato** (fonte única) | Envelope de paginação + formato de erro idênticos nos dois lados | **zod** em `@hed-hog/api-types/contracts` | back (e2e) + front (Vitest) |
| **Unitário — backend** | Services/subscribers não regridem | **Jest + ts-jest** | `apps/api/src`, `libraries/*/src` |
| **Unitário/componente — frontend** | Hooks e componentes não regridem | **Vitest + Testing Library** | `apps/admin/src` |
| **E2E — API** | Rotas respondem com auth e shape corretos | **Jest + supertest** (servidor vivo) | `apps/api/test` |
| **Typecheck** | Sem erros de tipo | `tsc --noEmit` | apps |
| **Gate (CI)** | Tudo acima roda a cada PR | **GitHub Actions + Turbo** | `.github/workflows` |

---

## 2. Estado atual

Gate de testes verde: **`turbo run test` → 18/18** (todas as 14 libraries + api +
admin + class + training).

**Backend (Jest):** todas as libraries têm specs — `inbox` (75), `queue` (64),
`vaults` (252), `campaign` (37), `finance` (29), `operations` (33), `lms` (46),
`core` (35), `agent` (21), `commerce` (25), `crm` (21), `cms` (20),
`category` (19), `address`/`tag` (16 cada) — além do `api` (22).

**As quatro superfícies do Vaults.** O módulo de cofres é o único com modelo
zero-knowledge, e por isso é o único cuja cripto é implementada de forma
independente em quatro lugares — o que faz de divergência silenciosa entre eles
uma classe de falha própria:

| Superfície | Runner | Testes |
|---|---|---|
| `libraries/vaults` | Jest (node) | 252 em 13 suítes — cobertura de statements a 78% |
| `packages/vault-crypto` | Vitest (node) | 146 |
| `apps/hedhog-vaults` (Expo) | Vitest (node) | 401 |
| `apps/hedhog-vaults-extension` (MV3) | Vitest (jsdom por arquivo) | 293 |

Mais a matriz de authz/IDOR em `apps/api/test/vaults-security.e2e-spec.ts` (§7b)
e o spec Playwright em `libraries/vaults/hedhog/frontend/e2e/`.

**Cobertura com gate:** `collectCoverage` ligado em todas as libs;
**`coverageThreshold` em 9 libs** (campaign, core, agent, commerce, finance, lms,
cms, crm, operations) com pisos calibrados pelo baseline — regressão de cobertura
**falha o CI**. Pisos sobem gradualmente conforme os testes crescem.

**Frontend (Vitest + Testing Library + MSW):** config compartilhada em
`@hed-hog/vitest-config`.
- `admin` (**234 testes, roda com `--coverage` + thresholds**): provider
  (interceptors, refresh 401, 403/forbidden, logout, login MFA/verificação,
  settings sensíveis); `_lib` puros (validação de grafo do agent, máquina de
  estados de títulos do finance, formatadores); serviços `_lib/api.ts` agnósticos
  (commerce, queue, operations); utils (`fill-blank`, `format-date`,
  `build-image-url`…); hooks (paginação, persistência, debounce, widget-data);
  componentes (`PaginationFooter`, `SearchBar`, `ViewModeToggle`, `FileTypeIcon`).
- `training`: `runtime-config` (normalização/cache/erro).
- `class`: utils de escopo de rascunho.

**E2E de app (Playwright):** **130 testes em `apps/admin`** (cobertura ampla
das rotas do sidebar, 13 módulos — commerce, crm, campaign, cms, agent, queue,
lms, operations, finance, core, category/tag/inbox — via smoke genérico
"carrega sem crash", mais o smoke original de login→lista→detalhe), **54 em
`apps/class`** (públicas, auth, `/perfil/*`, `/dashboard/*` com conteúdo real
semeado — curso/turma/prova/trilha — e `/pagamento/*`) e **51 em
`apps/training`** (4 perfis do portal — aluno, admin/viewer/instrutor da
empresa, incluindo páginas de detalhe: aluno, turma com abas, trilha) — ver
§5b. Requer app + API vivos + browsers. Roda automatizado (nightly + manual)
em [`ci-e2e.yml`](../.github/workflows/ci-e2e.yml).

**E2E da API (supertest, servidor vivo):** `apps/api/test/*.e2e-spec.ts` —
`auth`, `health`, `settings`, `all-endpoints` (401/públicas/drift route.yaml,
reconhece `@NoRole`), `contract` (shapes contra os schemas zod), `security`
(headers do helmet + authz) e relatórios (`finance-reports`, `contact-reports`).
Rodar com `DISABLE_RATE_LIMIT=true` no servidor (ver §5 e [TESTING.md](../TESTING.md)).

**Dívida conhecida:** `apps/class` e `apps/training` têm erros de tipo
pré-existentes; por isso o typecheck no CI é *report-only* (ver §6).

---

## 3. Como rodar (Windows / PowerShell)

### Tudo de uma vez (o gate)
```powershell
pnpm turbo run test        # todos os testes unitários (Jest + Vitest)
pnpm turbo run typecheck   # tsc --noEmit em api/admin/class/training
pnpm turbo run lint        # eslint em todos os workspaces
```

### Por pacote
```powershell
pnpm --filter api test                 # unit do backend (NestJS)
pnpm --filter @hed-hog-pro/lms test        # unit de uma library
pnpm --filter @hed-hog-pro/operations test
pnpm --filter admin test               # front do admin (Vitest)
pnpm --filter class test               # front do class (Vitest)
pnpm --filter training test            # front do training (Vitest)
pnpm --filter admin test:watch         # Vitest em watch
```

### Um arquivo / um teste
```powershell
pnpm --filter api exec jest src/cors                    # um arquivo
pnpm --filter admin exec vitest run use-pagination-fetch
```

---

## 4. Camada de contrato (fonte única de verdade)

O ponto onde a API costuma "quebrar o front em silêncio" é o **shape das
respostas** — o envelope de paginação e o formato de erro eram re-declarados à
mão em cada hook. Agora há uma fonte única em zod:

- [`packages/api-types/src/contracts/pagination.ts`](../packages/api-types/src/contracts/pagination.ts)
  → `paginationEnvelope(itemSchema)`, `anyPaginationEnvelope`, tipo `PaginationEnvelope<T>`
- [`packages/api-types/src/contracts/error.ts`](../packages/api-types/src/contracts/error.ts)
  → `apiErrorSchema`, tipo `ApiError`

Reexportados pela entrada principal:
```ts
import { paginationEnvelope, apiErrorSchema, type PaginationEnvelope } from '@hed-hog/api-types';
```

**Quem consome hoje:**
- Front: [`use-pagination-fetch.ts`](../apps/admin/src/hooks/use-pagination-fetch.ts) usa `PaginationEnvelope<T>` em vez de re-declarar.
- Back (e2e): [`contract.e2e-spec.ts`](../apps/api/test/contract.e2e-spec.ts) valida respostas reais contra os schemas.
- Front (unit): [`use-pagination-fetch.test.ts`](../apps/admin/src/hooks/use-pagination-fetch.test.ts) valida o fixture contra o mesmo schema.

> Ao alterar um contrato, mude **apenas** o schema zod e rode `pnpm --filter @hed-hog/api-types build`. Os dois lados passam a enxergar a mudança.

### Smoke test do runtime (sem servidor)
```powershell
pnpm --filter @hed-hog/api-types build
cd packages/api-types
node -e "const {paginationEnvelope}=require('./dist');const z=require('zod');const P=paginationEnvelope(z.object({id:z.number()}));console.log('valido:',P.safeParse({data:[{id:1}],total:1,lastPage:1,page:1,pageSize:10,prev:null,next:null}).success);console.log('invalido:',P.safeParse({data:[{id:1}],total:'x',lastPage:1,page:1,pageSize:10,prev:null,next:null}).success)"
```
Esperado: `valido: true` / `invalido: false`.

---

## 5. Teste E2E da API (servidor vivo)

As specs em `apps/api/test/*.e2e-spec.ts` batem por HTTP contra `API_URL`
(supertest); **não** inicializam o `AppModule`. Precisam de Postgres + Redis + a
API rodando + seed via `/install`.

```powershell
# 1. Infra
docker-compose up -d

# 2. Servidor (terminal 1) — garanta apps/api/.env (ver TESTING.md)
#    DISABLE_RATE_LIMIT=true evita que o rate-limit do /auth barre a suíte
#    (que faz muitos logins seguidos). Produção NÃO deve setar essa flag.
$env:DISABLE_RATE_LIMIT="true"; cd apps/api; pnpm dev

# 3. Seed + testes (terminal 2)
Invoke-WebRequest -Uri "http://localhost:3100/install" -Method POST -ContentType "application/json" `
  -Body '{"appName":"HedHog","slogan":"Panel","userName":"Root","email":"root@hedhog.com","password":"changeme"}'
$env:API_URL="http://localhost:3100"
pnpm --filter api test:e2e                               # toda a suíte e2e
pnpm --filter api test:e2e --testPathPattern=contract    # só o teste de contrato
pnpm --filter api test:endpoints                         # só o all-endpoints (authz/drift)
```

**O que o `all-endpoints.e2e-spec.ts` já valida** (cruzando `route.yaml` com os
controllers): rotas protegidas → 401 sem token; rotas `@Public` → nunca 401;
drift bidirecional (controller sem `route.yaml` e vice-versa).

**O que o `contract.e2e-spec.ts` valida:** respostas de erro batem com
`apiErrorSchema`; endpoints de lista que retornam `data` batem com o envelope de
paginação.

---

## 5b. Teste E2E de app (Playwright)

Config em `apps/admin` ([playwright.config.ts](../apps/admin/playwright.config.ts),
`apps/admin/e2e/`). Requer o **app + a API vivos** (o dev do Next faz proxy
`/api` → `:3100`), um usuário semeado e os browsers do Playwright.

```powershell
# uma vez: baixar o browser
pnpm --filter admin exec playwright install chromium

# infra + API (ver §5) precisam estar no ar; então:
pnpm --filter admin test:e2e            # sobe o `pnpm dev` do admin e roda os specs
pnpm --filter admin exec playwright test --list   # só lista (valida config, sem rodar)
```

O projeto `setup` (`e2e/auth.setup.ts`) loga uma vez e persiste o storageState;
o `smoke.spec.ts` exercita login → listagem → detalhe (`/commerce/customers`).
Variáveis: `E2E_EMAIL`, `E2E_PASSWORD`, `E2E_BASE_URL` (aponte para um server
já em pé e o webServer é desligado).

**130 testes**, organizados um spec por módulo (`commerce.spec.ts`,
`crm.spec.ts`, `campaign.spec.ts`, `cms.spec.ts`, `agent.spec.ts`,
`queue.spec.ts`, `finance.spec.ts`, `core.spec.ts`, `operations.spec.ts`,
`lms.spec.ts`, `misc.spec.ts` — home + category/tag/inbox), todos usando o
mesmo helper genérico `expectPageLoads` (`support.ts`): navega, confirma que
não caiu no `/login` e que `getByRole('main').first()` fica visível — sem
afirmar o heading específico de cada tela, já que ~115 das 182 rotas do app
usam o mesmo componente `entity-list`/`PageHeader` (título vem de config por
módulo, não por página). URLs extraídas dos `hedhog/data/menu.yaml` de cada
library (fonte real do sidebar, via `GET /menu/system`) — **um único login
basta** (`root@hedhog.com`, role `admin`), ao contrário do `training`, porque
quase toda rota libera esse role. Cobertura é ampla mas rasa nos módulos
maiores (`lms`, `operations`, `finance`, `core` — 36/29/25/28 rotas reais cada,
com telas de relatório/gráfico, Gantt e editor de certificado fora do padrão
genérico) e nas ~16 rotas `[id]` de detalhe real (`courses`, `classes`,
`exams`, `paths`, `enterprise`, `collaborators`, `contracts`, `projects` etc.)
— a maioria dos módulos (`commerce`, `crm`, `core/users` etc.) abre o detalhe
num Sheet/Dialog sobre a própria listagem, não numa rota nova.

`workers: 6` no config (em vez do default = nº de cores): sob `pnpm dev`, o
Next compila cada rota sob demanda na primeira visita, e 130 specs distintos
concorrendo em paralelismo total (16 workers) faziam algumas navegações
estourarem o timeout por contenção de compilação — não é bug de app (mesmos
specs, rodados com menos concorrência ou com retry, sempre passam).

Dois gaps reais encontrados (menu.yaml referencia uma URL sem `page.tsx`
correspondente no front — 404 genuíno, não incluídos no spec até existir):
`/campaign` (raiz do módulo, ao contrário de commerce/agent/operations que têm
dashboard próprio) e `/lms/xp/lesson-maps` (backend com
`lesson-xp-map.controller.ts` pronto, front nunca implementado).

Mesmo padrão em `apps/class` ([playwright.config.ts](../apps/class/playwright.config.ts),
`apps/class/e2e/`), com uma diferença de infra: o dev do class sobe em
**HTTPS local** via mkcert (`https://localhost:3002`, por isso
`ignoreHTTPSErrors: true` no config e no `webServer`). Reaproveita o mesmo
`root@hedhog.com` semeado pelo `/install` da API (não há seed próprio de aluno).

Cobertura ampla (50 testes, todos passando com `--headed`), organizada por
arquivo:

- `public.spec.ts` — landing, `/privacidade`, `/termos`, `/planos`,
  `/certificados/[slug]` público (código inexistente).
- `auth-pages.spec.ts` — `/signup`, `/forget-password`, `/reset-password` (sem
  código), `/callback/[provider]/login` (code fake — cai na tela de falha da
  página ou no modal genérico de erro, dependendo de o provider OAuth estar
  configurado no ambiente).
- `perfil.spec.ts` — as demais páginas de `/perfil/*` (`historico-pagamentos`
  fica em `smoke.spec.ts`).
- `dashboard.spec.ts` — todas as páginas de `/dashboard/*`. Depende do
  `auth.setup.ts` conceder acesso via **redemption code** (mesmo mecanismo de
  cortesia usado em produção — `POST /commerce/redemption-codes/generate` +
  `POST /commerce/profile/redeem`, chamados com o token do próprio
  `root@hedhog.com`, que já tem role `admin`); se o grant falhar ou o produto
  `complete` não existir no ambiente, cada teste pula com `test.skip` em vez
  de falhar. IDs inexistentes (`999999999`) são usados de propósito para
  exercitar os estados de erro/"não encontrado" de forma determinística e
  segura.

  `auth.setup.ts` também semeia (idempotente, via API, com o próprio token do
  root) um curso + turma + prova + trilha reais, para as listagens de
  `/dashboard/cursos|turmas|provas|trilhas` exercitarem o estado populado, não
  só o vazio — mesma raiz de nomes (`E2E Playwright Class`) usada em todos.
  Achado no caminho: `/dashboard/turmas` busca "minhas turmas" via
  `/lms/enterprise/training/student/class-groups` (rota de **training**, não
  um catálogo B2C puro) — mesmo o `root@hedhog.com` sendo um aluno individual
  no `class`, a turma só aparece com um vínculo `enterprise_student` de verdade
  (mesmo padrão do `training`, com uma enterprise dedicada "E2E Playwright
  Class" para não colidir com a fixture do `training`). Cursos/provas/trilhas
  de `/lms/platforma/*` já são catálogo geral, sem esse requisito. O clique no
  card de curso abre um `CoursePreviewModal` na mesma URL (não navega para
  `/dashboard/cursos/[slug]` — essa rota só é alcançada de outra forma).
- `pagamento.spec.ts` — `/pagamento` (sem `price_id`, com `price_id` inválido
  e com um `price_id` real resolvido em runtime via `/commerce/checkout/plans`)
  e `/pagamento/confirmacao` (sem/com `order_id` inválido).

**Regra de segurança seguida em todos os specs de `/perfil/*`, `/dashboard/*` e
`/pagamento/*`:** nenhum teste clica em ações reais/irreversíveis (cancelar
assinatura, excluir notificações/conta, desconectar OAuth, trocar senha/e-mail,
encerrar sessões, matricular-se, comprar acesso, iniciar tentativa de
prova/quiz, submeter avaliação, alterar visibilidade de certificado) nem
submete formulários que criem conta ou processem pagamento real — só carrega a
página e confirma o estado esperado.

```powershell
pnpm --filter class exec playwright install chromium
pnpm --filter class test:e2e
```

Scaffold também em `apps/training` ([playwright.config.ts](../apps/training/playwright.config.ts),
`apps/training/e2e/`) — HTTP puro (porta 3001, sem HTTPS/mkcert), e as chamadas
de API vão **direto** ao backend (`API_BASE_URL` do `.env`, resolvido em runtime
via `/api/runtime-config`), sem proxy `/api` como admin/class.

`training` é um portal **multi-perfil** (admin/viewer/instrutor/aluno de uma
empresa cliente — "enterprise"), não um app de um público só. Cobertura
completa dos 4 perfis (51 testes): `perfil.spec.ts` + `student.spec.ts` +
`public.spec.ts` (aluno), `admin.spec.ts`, `viewer.spec.ts`, `instructor.spec.ts`.

**Um usuário dedicado por perfil** (`e2e-training-{student,admin,viewer,instructor}@hedhog.com`,
nunca o `root@hedhog.com`) — o root já tem outro perfil de enterprise
pré-existente no banco de dev, e com 2+ perfis a `AuthProvider` do training não
auto-seleciona (a seleção manual só fica em `sessionStorage`, que o
`storageState` do Playwright não captura). Um usuário com exatamente 1 perfil
sempre auto-seleciona, em qualquer contexto de página novo. Os 4 usuários
compartilham a mesma enterprise/curso/turma/sessão ("E2E Playwright Training"),
provisionados via API (autenticado como root, role `admin`) de forma
idempotente. `playwright.config.ts` tem 4 projects (`chromium-{student,admin,
viewer,instructor}`), cada um com seu próprio `storageState` e `testMatch`
restrito aos specs daquele perfil; `auth.setup.ts` roda os 4 logins em série
(`test.describe.serial`) porque compartilham os mesmos find-or-create.

Diferenças de provisionamento por perfil:

- **Aluno**: `enterprise_student` + matrícula na turma, e acesso de commerce
  (`GET /commerce/profile/access`, `POST /commerce/redemption-codes/generate`,
  `POST /commerce/profile/redeem`, mesmo mecanismo do `class`) — necessário
  porque `/lms/platforma/*` (cursos, trilhas, provas) usa o mesmo
  `CommerceActiveAccessGuard`, um gate **separado** do perfil de enterprise.
- **Admin/viewer**: `POST /lms/enterprise/:id/users` com `role: enterprise_admin`
  ou `role: viewer`. **Viewer precisa ser literalmente `role: "viewer"`**, não
  `hr_manager` — várias telas (turmas, licenças, avaliações) escondem botões
  de mutação checando `accessSlug === "lms-enterprise-viewer"` direto, não o
  `home-viewer` já com downgrade do `resolveHomeRole` (que trata `hr_manager`
  como `home-viewer` só para fins de roteamento, mas essas telas não usam
  `resolveHomeRole`).
- **Instrutor**: não é via `enterprise_user` — é uma linha em `instructor`
  (`POST /lms/instructors`, exige `admin`/`admin-lms`) **+**
  `PATCH /lms/instructors/:id/training-access {enabled:true}`, que concede a
  role `lms-instructor` via `role_user`. Sem esse PATCH, `GET
  /lms/instructors/me` (chamado pelo `AuthProvider`) retorna 403 e o perfil
  sintético de instrutor nunca aparece — fácil de esquecer. Também vincula a
  turma compartilhada a este instrutor (`PATCH /lms/classes/:id
  {instructorId}`) e cria uma sessão (`POST /lms/classes/:id/sessions`, data em
  2026) para o card da turma não quebrar (ver achados abaixo) e para
  `/relatorios` do instrutor ter dado real (`getReports` deriva turmas de
  `course_class_session.instructor_id`, não de `course_class_group.instructor_id`).

```powershell
pnpm --filter training exec playwright install chromium
pnpm --filter training test:e2e
```

Além das listagens, cobre páginas de detalhe alcançadas por navegação real
(clicando no card/linha, não `page.goto` direto no id): `/alunos/[id]`
(admin), `/turmas/[id]` com as abas fixas (Agenda/Frequência/Materiais),
`/trilhas/[id]` (aluno), e `/reset-password` sem token.

**Bugs reais encontrados e corrigidos no código durante este trabalho** (não só
contornados no teste):

- `CreateEnterpriseDto.slug` era opcional no DTO, mas a coluna `enterprise.slug`
  é `NOT NULL` e o service não derivava um slug automático — `POST
  /lms/enterprise` sem `slug` lançava um 500 (`PrismaClientValidationError`).
  Corrigido em `enterprise.service.ts` (`toEnterpriseWriteData`): deriva o
  slug do `name` no create quando omitido, mesmo padrão já usado em
  `TrainingService.slugify`.
- `apps/training/app/trilhas/page.tsx` calculava o `role` do guard de acesso a
  partir de `session` já na primeira renderização, sem esperar `isReady` (ao
  contrário de `app/page.tsx`) — navegação direta para `/trilhas` redirecionava
  para `/` antes da sessão real carregar, para qualquer perfil. Corrigido
  esperando `isReady` antes de decidir redirecionar.
- `formatShortDate` em `admin-turmas.tsx`/`instructor-turmas.tsx` fazia
  `turma.endDate.slice(...)` sem checar null — uma turma sem data de término
  (estado real e comum: turma em andamento) quebrava a listagem inteira com
  `TypeError: Cannot read properties of null`. Corrigido com guarda de
  null (retorna "—").
- O perfil sintético de instrutor tem `enterpriseId: 0` (não vem de uma
  enterprise real). `instructor-dashboard.tsx` e a variante de instrutor de
  `avaliacoes-page.tsx` mandavam esse `0` como filtro pro backend por testar
  o objeto `selectedProfile` inteiro em vez do valor de `enterpriseId` — home
  e `/avaliacoes` do instrutor sempre mostravam estado vazio, mesmo com
  turmas/avaliações reais. Corrigido checando `selectedProfile?.enterpriseId`
  (mesmo padrão já correto em `instructor-turmas.tsx`).
- `apps/training/app/trilhas/[id]/page.tsx` tinha o mesmo bug de corrida do
  item acima (`/trilhas`) — mesmo fix (esperar `isReady`).
- `TrainingService.getById` (`libraries/lms/src/training/training.service.ts`)
  retornava `null` para um id de trilha inexistente, o que o NestJS serializa
  como **200 OK com corpo vazio** em vez de 404 — o front (`GET
  /lms/platforma/paths/:id`, consumido por `trilhas-detail-page.tsx`) então
  tentava `res.json()` num corpo vazio e vazava `"Unexpected end of JSON
  input"` na tela em vez de "Trilha não encontrada.". Corrigido lançando
  `NotFoundException`, mesmo padrão já usado em outros métodos do mesmo
  service — beneficia também `training.controller.ts` e `training.mcp-tools.ts`,
  que tinham o mesmo problema sem teste cobrindo.

---

## 6. CI (GitHub Actions)

### [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) — a cada PR/push
Não precisa de banco: builda as libs e gera o client Prisma a partir do
`schema.prisma` commitado. Passos: `install` → `build:libs` → **`test` (gate
obrigatório)** → `lint` e `typecheck` (*report-only*).

> **Por que report-only?** `class` e `training` têm dívida de tipos
> pré-existente. Assim que ela for zerada, remova o `continue-on-error` dos
> passos de lint/typecheck no `ci.yml` para torná-los bloqueantes.

### [`.github/workflows/ci-e2e.yml`](../.github/workflows/ci-e2e.yml) — nightly + manual
Sobe Postgres 17 + Redis, aplica migrations, semeia `/install`, inicia a API e
roda `test:e2e`. Começa como `workflow_dispatch` + agendado (não bloqueia PRs)
até estabilizar; depois pode ir para `pull_request`.

### [`.github/workflows/security.yml`](../.github/workflows/security.yml) — PR/push + semanal
`pnpm audit --audit-level=high` (*report-only* — há dívida pré-existente,
sobretudo em tooling transitivo) + **CodeQL** (JS/TS) para análise estática.

---

## 7. Provar que o contrato pega quebras

A melhor validação é ver o teste ficar **vermelho** ao quebrar o contrato de
propósito:

1. Em [`pagination.ts`](../packages/api-types/src/contracts/pagination.ts),
   adicione um campo obrigatório ao `paginationEnvelope` (ex.: `hasMore: z.boolean()`).
2. Rode:
   ```powershell
   pnpm --filter @hed-hog/api-types build
   pnpm --filter admin test
   ```
3. O teste do front falha (o fixture não satisfaz mais o schema) — provando que
   a mudança de shape é pega **antes** de chegar ao app. O E2E quebraria igual,
   pois as respostas reais não teriam o campo.
4. Reverta a edição.

---

## 7b. Segurança (hardening + testes)

**Hardening aplicado (com testes):**

- **helmet** ([main.ts](../apps/api/src/main.ts) + [helmet-options.ts](../apps/api/src/security/helmet-options.ts)):
  headers de segurança + remove `X-Powered-By`. Config conservadora (sem CSP;
  CORP `cross-origin` para o front carregar arquivos da API). Teste unitário de
  headers + assert no E2E de segurança.
- **rate-limit no `/auth`** ([auth.controller.ts](../libraries/core/src/auth/auth.controller.ts)):
  `@UseGuards(ThrottlerGuard)` + `@Throttle` (10/min por IP) nos endpoints de
  verificação de credencial (login, login-email-verification, login-code,
  login-recovery-code). Teste de 429. O limite acomoda a suíte E2E de auth (que
  faz vários logins) — pode ser reduzido para maior rigor ajustando os testes.
- **no-leak de erro** ([http-exception.filter.ts](../apps/api/src/filters/http-exception.filter.ts)):
  erro genérico (500) não expõe mais `message`/`name` internos ao cliente (log
  completo preservado). Teste unitário.

**Testes de segurança:** [security.e2e-spec.ts](../apps/api/test/security.e2e-spec.ts)
(headers ao vivo, authz positivo/negativo) e [all-endpoints.e2e-spec.ts](../apps/api/test/all-endpoints.e2e-spec.ts)
(protegidas → 401, `@Public` → nunca 401, drift route.yaml↔controller).

### Camada de segurança do Vaults

O módulo de cofres é o primeiro com RBAC **por recurso** (OWNER > ADMIN > EDITOR
> READER, por cofre) em cima do papel global. São quatro instrumentos, e cada um
existe porque o anterior não alcança:

1. **Drift de guardas e limites** — [`libraries/vaults/src/common/route-guards.spec.ts`](../libraries/vaults/src/common/route-guards.spec.ts).
   Lê os metadados reais (`Reflect`) dos 8 controllers e compara com uma tabela
   literal: qual rota é `@Public()`, qual é `@NoRole()`, e o limite de cada
   `@Throttle`. Um `@Public()` acrescentado sem intenção reprova.
   Roda em milissegundos, sem banco.

   > **Por que o limite de requisição é conferido por metadado e não ao vivo:**
   > o `ci.yml` roda com `DISABLE_RATE_LIMIT=true`, e o `skipIf` do
   > `ThrottlerModule` desliga **todo** o throttling nesse modo — um assert de 429
   > ao vivo nunca falharia lá. O mecanismo do 429 em si continua coberto por
   > `apps/api/src/security/throttler.spec.ts`.

2. **Matriz de authz e IDOR ao vivo** — [`apps/api/test/vaults-security.e2e-spec.ts`](../apps/api/test/vaults-security.e2e-spec.ts)
   (52 casos) sobre a fixture de [`test/support/vaults-fixture.ts`](../apps/api/test/support/vaults-fixture.ts):
   cinco personas reais (`e2e-vaults-{owner,admin,editor,reader,outsider}@hedhog.com`),
   cada uma com keypair e master key geradas pelo `@hed-hog/vault-crypto`. Os
   `encrypted_vault_key` são embrulhos ECIES legítimos — um dos casos desembrulha
   a chave do READER e decifra o segredo de verdade, outro confirma que o mesmo
   ciphertext não abre com o `vaultId` do vizinho (AAD).

   Cobre: a matriz de escrita por papel, "só OWNER mexe em OWNER", rotação
   incompleta recusada **sem gravar nada pela metade**, 14 tentativas de IDOR
   entre cofres (segredo, anexo, atividade, `move`, auto-promoção), o 404 genérico
   do link público sem oráculo de enumeração, e a regressão do painel que já
   contou a instalação inteira.

   Entra no gate do `ci.yml` sozinha (`test:e2e` roda todo `.e2e-spec.ts`). Sem
   servidor, os casos se pulam com o **motivo concreto** — um "pulando" mudo faz
   52 casos verdes parecerem 52 casos executados.

   Duas armadilhas descobertas montando a fixture, documentadas no arquivo:
   o papel `admin-vaults` precisa ser concedido por `POST /user/:userId/role/:roleId`
   (aditivo), porque `PATCH /role/:roleId/user` faz `deleteMany` do papel inteiro;
   e `POST /crypto/setup` é um upsert que grava um par de chaves novo a cada
   execução, órfãnando os cofres anteriores — por isso a fixture reseta os cinco
   keystores com `DELETE /crypto/me` antes de montar.

3. **Negativos de cripto** — `packages/vault-crypto/src/{envelope,kdf,secret-crypto}.test.ts`.
   O que sustenta o zero-knowledge não é o round-trip funcionar, é a decifragem
   **falhar** fora do contexto exato: tag adulterada em 1 bit, IV adulterado,
   ciphertext truncado, AAD trocada. E o fator de trabalho do Argon2id
   (64 MB × 3 × 4) está fixado em teste — baixá-lo é uma mudança que não quebra
   nada, não aparece em tela e barateia um ataque offline contra o banco.

4. **Fronteira da extensão** — `apps/hedhog-vaults-extension/src/**`.
   `messaging-autofill.test.ts` cobre o único ponto em que a senha sai do service
   worker: recusa de domínio que não casa, recusa de downgrade https→http, e as 7
   mensagens `EXTENSION_ONLY` verificadas uma a uma a partir de um remetente
   content script. `oauth.test.ts` recomputa o `code_challenge` com `node:crypto`
   a partir do verifier realmente enviado, em vez de comparar com uma constante.

**Lacunas conhecidas, hoje fixadas por teste em vez de silenciadas** (o
`route-guards.spec.ts` mantém o inventário, então uma rota nova sem limite
reprova):

- `POST /secret-share/received/:id/open` e todo o `SecretAttachmentController`
  não têm `@Throttle`.
- `GET /crypto/public-key/:userId` não checa membresia — qualquer portador do
  papel `admin-vaults` enumera quem tem keystore. A chave pública é pública por
  design; o que o teste fixa é a **forma** da resposta (nada de material de
  destravamento), não a política.
- `POST /crypto/setup` é um upsert sem prova de posse: quem já tem cofres pode
  sobrescrever a própria `public_key` e tornar toda `encrypted_vault_key` já
  embrulhada indecifrável. É auto-lockout, não vazamento, mas é irreversível.
  A troca de senha-mestra NÃO passa por aqui: ela tem rota própria
  (`PATCH /crypto/me/password` → `CryptoService.updateEncryptedPrivateKey`), cujo
  DTO sequer aceita `publicKey`. Quem for mexer no `setup` precisa manter essa
  separação — é o que impede que "trocar a senha" vire perda de acesso.
- A troca de senha-mestra não tem prova de posse server-side, e não tem como ter:
  sendo zero-knowledge, o servidor não conhece a senha e não há verifier no
  schema. Quem chega ao `PATCH` já provou posse no cliente (só se produz o blob
  novo decifrando o antigo), mas um cliente hostil com o token da sessão pode
  gravar lixo no lugar da private key. O estrago é o mesmo do `DELETE /crypto/me`,
  que já é exposto — daí o limite de 5/min em vez de uma defesa nova.
- `FILL_CREDENTIAL`/`FILL_TOTP`/`MATCH_DOMAIN` validam contra o `message.url`
  auto-declarado pelo content script, sem cruzar com o `sender.url` que o Chrome
  fornece. Inofensivo hoje (sem `externally_connectable`, página nenhuma alcança
  o `onMessage`), mas é a defesa em profundidade que falta.

**Proposta — `ValidationPipe` whitelist (não aplicado):** hoje o
[ValidationPipe](../apps/api/src/main.ts) não usa `whitelist`, então propriedades
desconhecidas passam (superfície de mass-assignment). Recomendação:
`new ValidationPipe({ transform: true, whitelist: true })` para **remover** campos
não declarados nos DTOs. Não foi aplicado porque muda o parsing de **toda**
requisição e pode afetar endpoints que dependem de campos fora do DTO (ex.: os que
leem `@Query` cru) — requer varredura + validação antes de ligar. `forbidNonWhitelisted`
(rejeitar em vez de remover) é ainda mais estrito e deve vir depois.

**Cobertura futura de segurança:** a matriz de authz por papel e o isolamento /
IDOR foram entregues **para o módulo vaults** (ver acima). Continua pendente o
isolamento de tenant do `lms` (`resolveEnterpriseId`), que exige a sua própria
fixture multi-tenant.

---

## 8. Onde ficam os testes

```
apps/api/
  src/**/*.spec.ts            # unit (Jest) — jest.config.ts
  test/*.e2e-spec.ts          # e2e (supertest) — test/jest-e2e.json
apps/admin/
  src/**/*.test.{ts,tsx}      # front (Vitest) — vitest.config.ts
  e2e/support.ts              # helper genérico expectPageLoads (e2e)
  e2e/{misc,smoke}.spec.ts    # e2e (Playwright) — specs cross-cutting, hand-authored
  e2e/generated/*.spec.ts     # e2e (Playwright) — GERADO, não versionado (ver abaixo)
apps/class/
  {app,components,hooks,lib}/**/*.test.ts   # front (Vitest)
  e2e/*.spec.ts               # e2e (Playwright) — playwright.config.ts
apps/training/
  {app,components,hooks,lib}/**/*.test.ts   # front (Vitest)
  e2e/*.spec.ts               # e2e (Playwright) — playwright.config.ts
libraries/<lib>/
  src/**/*.spec.ts                       # unit (Jest) — jest.config.ts + tsconfig.spec.json
  hedhog/frontend/e2e/<lib>.spec.ts.ejs  # e2e (Playwright), fonte da verdade — ver abaixo
packages/api-types/
  src/contracts/*.ts          # schemas zod compartilhados
packages/vault-crypto/
  src/*.test.ts               # cripto pura (Vitest, node) — vitest.config.ts
apps/hedhog-vaults/           # app Expo dos cofres
  src/**/__tests__/*.test.ts  # Vitest (node); aliases @vault-crypto / @admin-vaults
apps/hedhog-vaults-extension/ # extensão MV3
  src/**/*.test.ts            # Vitest; ambiente por arquivo via `// @vitest-environment`
apps/api/test/
  support/vaults-fixture.ts   # fixture multi-papel (não casa com o testRegex do e2e)
```

> **Atenção nas libraries Nest:** o `testRegex` do preset é `.*\.spec\.ts$`. Um
> arquivo `.test.ts` ali é **silenciosamente ignorado** — falso verde. Nos apps e
> em `packages/vault-crypto`, que usam Vitest, o padrão é `.test.ts`.

Config compartilhada de Jest: `@hed-hog/jest-config` (`base`/`nest`/`next`).
Config compartilhada de Vitest: `@hed-hog/vitest-config` (`react` + `setup` com
MSW e jest-dom).

**E2E do admin por library.** Cada library dona de um módulo do admin traz seu
spec Playwright junto do código-fonte, em `libraries/<lib>/hedhog/frontend/e2e/
<lib>.spec.ts.ejs` — mesmo padrão (e mesmo marcador `.ejs`, que **não** é um
template real, é só um sinalizador de tooling) já usado por
`hedhog/frontend/{app,messages,public,widgets}`. Specs cross-cutting que não
pertencem a uma única library (`misc.spec.ts`, `smoke.spec.ts`) continuam
hand-authored direto em `apps/admin/e2e`.

Antes de cada run, `apps/admin/playwright.config.ts` chama
`e2e/generate-specs.mjs` via `globalSetup`, que varre
`libraries/*/hedhog/frontend/e2e/*.spec.ts.ejs` e copia cada um para
`apps/admin/e2e/generated/<lib>.spec.ts` (pasta gitignored, sempre
reconstruída). Como a varredura é um glob físico sobre `libraries/*`, a
filtragem "só rodar specs de libraries presentes neste projeto" acontece
automaticamente — não é preciso consultar `hedhog.json`: se a pasta da
library não existir, o glob não encontra nada para ela.

Rodar manualmente: `node apps/admin/e2e/generate-specs.mjs`.

**Limitação conhecida / follow-up:** essa sincronização é um script local
deste repo, não o CLI `hedhog` (`@hed-hog/cli`, publicado no npm — código-fonte
não faz parte deste monorepo). Para que outros projetos que instalam essas
libraries via `hedhog dev apply`/`assets-to-library` também recebam os specs
de e2e automaticamente, o CLI precisaria aprender a copiar
`hedhog/frontend/e2e` como já faz com `app`/`messages`/`public`/`widgets` —
isso está fora do alcance deste repo.

---

## 9. Roadmap (próximas fases)

Já entregue: **Fase 0** (fundação de CI, specs verdes, typecheck), **Fase 1**
(camada de contrato), **Fase 2** (frontend robusto: config Vitest compartilhada,
interceptors do provider via MSW, hooks, componente, `runtime-config` do training
e scaffold Playwright) e **Fase 3** (hardening: helmet, rate-limit no `/auth`,
no-leak de erro; scanning `pnpm audit` + CodeQL — ver §7b). Pendente:

- **Fase 2 (restante):** Playwright já roda ponta a ponta contra o stack vivo,
  ligado ao CI (`ci-e2e.yml`, nightly + manual, matrix admin/class/training) —
  cobertura ampla no admin (130 testes, sidebar inteiro — ver §5b), no class
  (50 testes: públicas, auth, `/perfil/*`, `/dashboard/*` com conteúdo real
  semeado e `/pagamento/*`) e no training (os 4 perfis — aluno,
  admin/viewer/instrutor da empresa — §5b), incluindo vários bugs reais que os
  testes encontraram e que já foram corrigidos no código (não só contornados —
  ver §5b). Pendente: 2 gaps de página ausente encontrados no admin
  (`/campaign` raiz, `/lms/xp/lesson-maps` — ver §5b); ampliar cobertura do
  admin nos módulos maiores (`lms`, `operations`, `finance`, `core`) além do
  smoke genérico e nas ~16 rotas `[id]` de detalhe real; cobrir fluxos de
  mutação real (criar/editar/excluir, com limpeza) nos 3 apps — hoje todo spec
  é deliberadamente somente-leitura; ampliar testes de componente das
  primitivas de `entity-list`.
- **Fase 3 (restante):** ~~matriz completa de authz por role~~ e ~~isolamento /
  IDOR~~ **entregues para o módulo vaults** (§7b) — falta estendê-los ao `lms`
  (`resolveEnterpriseId`), que precisa da própria fixture multi-tenant. Continua
  pendente: avaliar/aplicar o `ValidationPipe` whitelist (§7b).
- **Vaults (restante):** teste de componente da UI da extensão
  (`popup`/`options`/`UnlockScreen`) e dos hooks e providers do app Expo — os dois
  exigem uma Testing Library que o repo ainda não tem, e no caso do React Native
  a conta é alta (o `vitest.config.ts` do app roda em `environment: 'node'`, sem
  transformação de RN; fazer o RTL-RN funcionar exigiria o babel-preset do RN,
  jsdom e mocks para ~20 módulos `expo-*`). Alternativa mais barata e de valor
  equivalente: extrair a decisão dos providers (`auth-provider`, `crypto-provider`,
  `vault-gate`) para módulos puros e testá-los sem React. Também pendentes:
  `offline/snapshot-store.ts` e `offline/sync-engine.ts` (os dois maiores sem
  teste no app) e os 9 `src/services/*`.
- **Fase 4 — Qualidade contínua:** husky + lint-staged; thresholds de cobertura
  (o vaults ficou de fora por decisão — a cobertura subiu, mas nada impede que
  caia; o molde é [libraries/lms/jest.config.ts](../libraries/lms/jest.config.ts));
  decidir sobre as 21 composite actions órfãs em `.github/actions/`.
- **Gate real de PR:** nenhum workflow roda em `pull_request` hoje — o `ci.yml` é
  `workflow_dispatch` puro. Enquanto for assim, o drift de guardas do vaults (e
  todo o resto do gate) só é pego quando alguém dispara à mão.
