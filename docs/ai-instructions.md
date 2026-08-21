# Instruções de IA no HedHog

Este documento descreve como as instruções de IA funcionam no HedHog, como criar agentes e tools, como medir custo e como depurar execuções.

---

## Como funcionam as instruções de IA

As instruções de IA são textos gerenciáveis — não hardcoded — que guiam o comportamento dos modelos de linguagem. Elas ficam na tabela `ai_instruction` e são compostas em camadas antes de cada chamada ao LLM.

O sistema usa cache em memória com TTL de 5 minutos para as camadas estáticas. Contexto dinâmico (usuário, data, permissões) é gerado no momento da chamada e nunca cacheado.

---

## Camadas de instrução

```
L1 — system    Instrução global (ex: "Você é um assistente HedHog...")
L2 — product   Regras do produto/plataforma
L3 — module    Contexto do módulo ativo (lms, finance, operations...)
L4 — agent     Persona e objetivo do agente
L5 — tool      Como usar uma tool específica (injetada sob demanda)
L6 — runtime   Dados dinâmicos: userId, locale, data, roles (NUNCA salvo no banco)
L7 — output    Contrato de saída JSON (schema esperado)
```

| Camada | Quando inclusa | Cacheada |
|--------|---------------|----------|
| L1 system | Sempre | Sim, 5 min |
| L2 product | Sempre | Sim, 5 min |
| L3 module | Quando `moduleSlug` fornecido | Sim, 5 min por módulo |
| L4 agent | Quando `agentSlug` fornecido | Sim, 5 min por agente |
| L5 tool | Quando a tool é chamada | Junto com a definição da tool |
| L6 runtime | Sempre, gerado em tempo real | Nunca |
| L7 output | Quando há schema esperado | No código |

---

## Como uma instrução final é montada

```typescript
// AiPromptBuilderService.build()
const { systemPrompt } = await promptBuilder.build({
  moduleSlug: 'lms',       // inclui L3
  agentSlug: 'lms-assistant', // inclui L4
  locale: 'pt',
});

// systemPrompt = L1 + "\n\n---\n\n" + L2 + "\n\n---\n\n" + L3 + "\n\n---\n\n" + L4
```

O contexto de runtime (L6) é adicionado pelo chamador:

```typescript
const runtimeCtx = promptBuilder.buildRuntimeContext({
  userId: 42,
  locale: 'pt',
  userRoles: ['admin', 'admin-lms'],
  currentDate: new Date().toISOString(),
  extraContext: { currentPage: 'courses' },
});

const finalSystemPrompt = systemPrompt + '\n\n' + runtimeCtx;
```

---

## Como reduzir tokens corretamente

### 1. Mantenha L1 + L2 curtas e estáveis

L1 + L2 nunca devem ultrapassar 300 tokens combinadas. Qualquer instrução que muda a cada request **não pertence a L1/L2** — vai para L6.

**Bom:**
```
You are a HedHog system assistant. Use available tools to answer accurately.
Respond in the user's language. Be concise.
```
_(~25 tokens)_

**Ruim:**
```
Você é um assistente avançado do sistema HedHog com acesso a ferramentas de finanças,
operações, LMS, CRM, commerce e campanhas. Responda sempre em português do Brasil
e use formato markdown quando necessário...
```
_(~60 tokens + hardcoded "pt" que impede multilíngue)_

### 2. Use L3 e L4 apenas quando necessários

Não inclua `moduleSlug` se a conversa não for claramente sobre aquele módulo. Não inclua `agentSlug` se não há um agente ativo.

### 3. Não coloque dados de negócio nas instruções estáticas

Dados de negócio (resultados de queries, valores de entidades) pertencem à mensagem do usuário ou ao `tool_result`. Nunca à instrução do sistema.

**Ruim (em instrução salva no banco):**
```
O usuário João tem 3 projetos ativos: Alpha ($50k), Beta ($30k), Gamma ($20k).
```

**Correto (como tool_result):**
```json
{ "projects": [{"name": "Alpha", "budget": 50000}, ...] }
```

### 4. Limite o histórico por conversa

O `McpChatService` mantém os últimos 40 mensagens por turn (`HISTORY_MESSAGE_LIMIT = 40`). Em conversas longas, mensagens antigas são descartadas.

Para ajustar esse limite sem deploy, altere a constante ou evolua para uma setting configurável.

### 5. O modelo está lendo dados desnecessários?

Cada tool call envia o resultado completo de volta ao LLM. Se o resultado de uma tool é muito grande (ex: 200 registros), considere paginar ou truncar antes de retornar.

---

## Como criar novos agentes

### Via API

```bash
POST /ai-instruction
{
  "slug": "agent.meu-agente",
  "layer": "agent",
  "name": "Meu Agente",
  "content": "Você é um assistente de RH. Ajude usuários a...",
  "locale": "pt"
}
```

### Via seed YAML (`hedhog/data/*.yaml`)

```yaml
- model: ai_instruction
  data:
    - slug: agent.meu-agente
      layer: agent
      name: Meu Agente
      content: "Você é um assistente de RH..."
      locale: pt
      is_active: true
      version: 1
```

### Uso no código

```typescript
const { systemPrompt } = await promptBuilder.build({
  agentSlug: 'meu-agente',
});
```

**Regras para o conteúdo de um agente:**
- Descreva o papel, objetivo e limites do agente
- Mencione quais tools ele deve preferir (ex: `Use lms.* tools for LMS operations`)
- Não repita instruções globais (não precisar dizer "responda em português" se L1 já instrui isso)
- Máximo ~200 tokens

---

## Como criar novas tools

Tools são registradas via `@McpTool()` no código. O HedHog autentica tools via tabela `route` com `type = 'MCP'`.

```typescript
@McpTool({
  name: 'hr.employees.list',
  description: 'List employees with optional filters by department or status.',
  readOnly: true,
  inputSchema: {
    type: 'object',
    properties: {
      departmentId: { type: 'number', description: 'Filter by department ID' },
      status:       { type: 'string', enum: ['active', 'inactive'] },
    },
  },
})
async listEmployees(args: { departmentId?: number; status?: string }, ctx: McpContext) {
  // ...
}
```

**Regras para descrição de tools:**
- Máximo 2 frases
- Diga o que a tool FAZ, não como ela funciona
- Inclua os filtros principais no texto (melhora o score de seleção automática)
- Use o prefixo de domínio no nome: `hr.`, `finance.`, `lms.`, `operations.`

Para que a tool apareça no MCP Chat, adicione em `route.yaml` e `role.yaml`:

```yaml
# route.yaml
- url: /mcp/hr/employees/list
  method: MCP
  tool_name: hr.employees.list
  relations:
    role:
      - where: { slug: admin }
      - where: { slug: admin-hr }
```

---

## Como medir custo

Cada chamada ao LLM gera um registro em `ai_execution` com totais agregados:

```sql
-- Custo total das últimas 24h
SELECT
  SUM(cost_usd) AS total_usd,
  SUM(tokens_input) AS tokens_in,
  SUM(tokens_output) AS tokens_out
FROM ai_execution
WHERE started_at >= NOW() - INTERVAL '24 hours'
  AND status = 'completed';

-- Custo por modelo
SELECT provider, model, COUNT(*) AS calls,
       SUM(tokens_input) AS tokens_in,
       SUM(tokens_output) AS tokens_out,
       SUM(cost_usd) AS total_usd
FROM ai_execution_step
GROUP BY provider, model
ORDER BY total_usd DESC;

-- Top 10 execuções mais caras
SELECT id, context_slug, cost_usd, tokens_total, status, started_at
FROM ai_execution
ORDER BY cost_usd DESC
LIMIT 10;
```

Os preços ficam em `ai_model_pricing` e são cacheados por 1 hora. Para atualizar preços sem deploy:

```sql
INSERT INTO ai_model_pricing (provider, model, price_input_per_million, price_output_per_million, valid_from)
VALUES ('openai', 'gpt-4o-mini', 0.150, 0.600, NOW())
ON CONFLICT (provider, model, valid_from) DO NOTHING;
```

---

## Como depurar uma execução

### 1. Ver detalhes de uma execução

```sql
-- Cabeçalho da execução
SELECT id, context_slug, trigger, status,
       tokens_input, tokens_output, tokens_total,
       ROUND(cost_usd::numeric, 6) AS cost_usd,
       EXTRACT(EPOCH FROM (finished_at - started_at)) AS duration_seconds,
       error
FROM ai_execution
WHERE id = <execution_id>;

-- Steps da execução
SELECT step_order, type, provider, model, tool_name,
       tokens_input, tokens_output,
       ROUND(cost_usd::numeric, 8) AS cost_usd,
       duration_ms, success, error,
       LEFT(input_summary, 200) AS input_summary,
       LEFT(output_summary, 200) AS output_summary
FROM ai_execution_step
WHERE execution_id = <execution_id>
ORDER BY step_order;
```

### 2. Ver caminho executado

Analise os `step_order` e `type` dos steps:

| type | Significa |
|------|-----------|
| `prompt` | LLM chamado — inclui tokens de input/output |
| `tool_call` | LLM decidiu chamar uma tool |
| `tool_result` | Resultado da tool enviado de volta ao LLM |
| `output` | Resposta final ao usuário |
| `error` | Erro capturado durante a execução |

### 3. Registrar uma execução manualmente

```typescript
const execId = await aiExecution.start({
  trigger: 'api',
  userId: 42,
  contextSlug: 'meu-contexto',
});

// ... chama o LLM ...

await aiExecution.recordStep({
  executionId: execId,
  stepOrder: 0,
  type: 'prompt',
  provider: 'openai',
  model: 'gpt-4o-mini',
  usage: { input: 1200, output: 350, total: 1550 },
  durationMs: 820,
  inputSummary: 'Pergunta do usuário...',
  outputSummary: 'Resposta do modelo...',
});

await aiExecution.finish(execId, 'completed');
```

### 4. Verificar a instrução que foi usada

```sql
-- Ver instrução ativa por slug
SELECT slug, layer, name, version, LEFT(content, 500) AS content_preview, is_active
FROM ai_instruction
WHERE slug = 'system.global';

-- Ver histórico de versões
SELECT v.version, v.change_note, v.created_at,
       u.name AS changed_by,
       LEFT(v.content, 300) AS content_preview
FROM ai_instruction_version v
LEFT JOIN "user" u ON u.id = v.created_by_id
WHERE v.instruction_id = <id>
ORDER BY v.version DESC;
```

---

## Boas práticas para escrever instruções

### Princípios gerais

1. **Uma instrução, uma responsabilidade.** L1 define tom; L2 define produto; L3 define módulo; L4 define agente. Não misture.
2. **Seja específico, não verbose.** 3 frases precisas valem mais que 1 parágrafo genérico.
3. **Nunca instrua o que já é comportamento padrão do modelo.** "Seja educado e responda bem" não precisa estar escrito.
4. **Coloque constraints, não tutoriais.** "Confirme operações destrutivas antes de executar" é útil. Um parágrafo explicando por que é desnecessário.
5. **Use verbos de ação.** "Responda no idioma do usuário." não "Você deve sempre tentar responder no mesmo idioma que o usuário utiliza."

### Exemplos

#### Instrução global (L1) — BOA

```
You are a HedHog system assistant. Use available tools to answer accurately.
Respond in the user's language. Be concise.
```
_26 tokens, clara, sem redundância._

#### Instrução global (L1) — RUIM

```
Você é um assistente do sistema HedHog, uma plataforma empresarial SaaS modular desenvolvida
para gestão de finanças, operações, LMS, CRM, commerce e campanhas. Você deve sempre ser
educado e profissional, respondendo com clareza e precisão. Use as ferramentas disponíveis
para buscar dados no sistema e nunca invente informações. Sempre responda em português do
Brasil, usando linguagem formal mas acessível.
```
_~90 tokens, muito longo, "não invente" é instrução genérica desnecessária, idioma fixo impede multilíngue._

---

#### Instrução de módulo (L3) — BOA

```
LMS module manages courses, lessons, enrollments, and XP. Use lms.* tools for all LMS operations.
```
_22 tokens, suficiente para o modelo saber o domínio e quais tools usar._

#### Instrução de módulo (L3) — RUIM

```
O módulo LMS (Learning Management System) do HedHog gerencia cursos e aulas, que podem ser do
tipo vídeo, texto ou quiz. Os alunos se matriculam em cursos e ganham XP ao completar aulas.
O XP é calculado com base em segmentos da aula, que possuem dificuldade (easy, medium, hard, expert)
e tipos de aprendizagem. Use sempre as ferramentas com prefixo lms. para consultar dados do LMS.
```
_~100 tokens. Os detalhes do esquema de XP só são relevantes para o agente de XP — não para todo agente de LMS._

---

#### Instrução de agente (L4) — BOA

```
You are an LMS assistant. Help instructors and students with course creation, lesson management,
enrollments, and learning progress. Focus on educational outcomes. Use lms.* tools.
```
_35 tokens, persona clara, objetivo claro, tool prefix especificado._

#### Instrução de agente (L4) — RUIM

```
Você é um assistente de LMS. Você deve ajudar professores e alunos. Quando alguém perguntar sobre
cursos, use a ferramenta de listagem de cursos. Quando alguém perguntar sobre matrículas, use a
ferramenta de matrículas. Quando alguém perguntar sobre XP, use a ferramenta de XP. Nunca responda
sem consultar os dados reais do sistema. Sempre confirme com o usuário antes de criar ou deletar
qualquer coisa no LMS.
```
_~90 tokens. A lista de ferramentas por pergunta é desnecessária — o modelo já faz isso via tool selection._

---

## Checklist para novas instruções de IA

Antes de criar ou atualizar uma instrução, responda:

- [ ] **A instrução é realmente necessária?** O comportamento padrão do modelo não resolve sem instrução?
- [ ] **Ela está duplicando uma instrução global?** Se já está em L1/L2, não repita em L3/L4.
- [ ] **Ela pode ser menor?** Corte tudo que não for uma restrição ou orientação concreta.
- [ ] **Ela depende de contexto dinâmico?** Dados que mudam por request pertencem a L6 (runtime), não ao banco.
- [ ] **O contexto dinâmico está limitado?** L6 deve incluir apenas o necessário para a tarefa corrente.
- [ ] **O output esperado está claro?** Se a resposta deve seguir um schema, deixe explícito na instrução ou em L7.
- [ ] **Existe schema de saída?** Para respostas estruturadas (JSON), use `response_format: { type: 'json_object' }` ou especifique o schema.
- [ ] **Existe versionamento?** Use `change_note` ao atualizar — o histórico é salvo automaticamente em `ai_instruction_version`.
- [ ] **Existe log de custo?** Toda chamada ao LLM deve passar por `AiExecutionService.start()` / `recordStep()` / `finish()`.
- [ ] **Existe teste ou exemplo de execução?** Antes de ativar em produção, teste a instrução com entradas reais e verifique o comportamento.

---

## Relatório de status — Revisão técnica (2026-06-10)

### Problemas encontrados

| Severidade | Arquivo | Problema |
|-----------|---------|---------|
| **Crítico** | `ai-execution.service.ts:listExecutions()` | SQL injection — `userId` e `contextSlug` interpolados em `$queryRawUnsafe` |
| **Médio** | `ai-instruction.service.ts:invalidateCache()` | Mapeamento slug→cache_key incorreto — `slug.includes(key)` não mapeia `module.lms` → `module:lms` |
| **Médio** | `mcp-chat.service.ts` | Histórico sem janela — todo o histórico era carregado e enviado ao LLM, sem limite |
| **Baixo** | `mcp-chat.service.ts` | Modelo `gpt-4o-mini` hardcoded em `runOpenAiLoop` (dois locais: API call e recordStep) |
| **Info** | `lesson-xp-ai-calculation.service.ts:278` | Prompt de sistema hardcoded para o cálculo de XP do LMS |
| **Info** | `operations-daily-report-ai.service.ts:65-73` | Instrução + schema JSON + dados de negócio misturados na mesma mensagem |
| **Info** | `operations.service.ts:13196,13304` | Dois prompts de sistema hardcoded para geração/revisão de contratos |
| **Info** | `mcp-chat.service.ts:100-209` | `DOMAIN_KEYWORDS` ainda hardcoded (não migrado para registry extensível) |
| **Info** | `mcp-chat.service.ts:84` | `TARGET_SELECTED_TOOLS = 112` — sem redução efetiva de tools (plano propunha ~25) |

### Ajustes realizados nesta revisão

1. **SQL injection corrigido** (`ai-execution.service.ts`) — `listExecutions()` reescrito com `Prisma.$queryRaw` parametrizado para todos os 4 casos (sem filtro, por userId, por contextSlug, por ambos). `limit` limitado a 100.

2. **Cache invalidation corrigida** (`ai-instruction.service.ts`) — `invalidateCache()` agora extrai corretamente layer e identifier do slug para deletar as chaves certas (ex: `module.lms` → deleta `module` e `module:lms`).

3. **Histórico com janela aplicada** (`mcp-chat.service.ts`) — Ambos os loops (OpenAI e Gemini) agora limitam o histórico a `HISTORY_MESSAGE_LIMIT = 40` mensagens recentes, prevenindo token explosion em conversas longas. A janela usa `.slice()` em vez de resumo para preservar a integridade dos pares tool_call/tool_result.

### Estimativa qualitativa de redução de tokens

| Mudança | Redução estimada |
|---------|-----------------|
| Instrução global via banco (em vez de hardcoded duplicado) | 0% (era equivalente) |
| Janela de histórico (40 msgs em vez de ilimitado) | **40-80%** em conversas longas (>40 msgs) |
| Composição seletiva L3/L4 (só quando necessário) | **20-40%** quando módulo/agente não identificado |
| Instrução global compacta (L1 ~26 tokens vs anterior) | **~5%** por turn |
| _Pendente: redução de tools 112→25_ | _estimado ~60%_ de tokens de input em requests típicos |
| _Pendente: janela de histórico com resumo inteligente_ | _estimado ~20%_ adicional sobre janela simples |

### O que ainda pode ser otimizado

1. **`TARGET_SELECTED_TOOLS = 112` → reduzir para ~25-30**: maior ganho de tokens disponível. Requer ajuste cuidadoso do scoring e testes com usuários com diferentes roles.

2. **Modelo hardcoded `gpt-4o-mini`** em `McpChatService`: mover para setting `mcp-default-model-openai` para evitar deploy em troca de modelo.

3. **Migrar prompts de módulo**: LMS XP, daily report e contratos Operations ainda têm prompts hardcoded. Migrar para `ai_instruction` (layer=agent) e `ai_prompt_template` (para templates com variáveis).

4. **Separar schema JSON da mensagem do usuário** no daily report: instrução + schema devem ser o system prompt (L7), não a user message.

5. **Resumo inteligente do histórico**: o atual windowing é simples (slice). Implementar sumarização para conversas de mais de 40 mensagens, preservando contexto sem enviar tokens.

6. **Tela de administração `/ai/instructions`**: CRUD de instruções com diff visual de versões.

7. **Dashboard `/ai/usage`**: visualização de custo por período, drill-down por execução, top tools.

### Recomendações para próxima etapa

**Etapa imediata (alta prioridade):**
- Reduzir `TARGET_SELECTED_TOOLS` de 112 para 30 com testes
- Mover modelo default de `mcp-chat` para setting

**Etapa seguinte:**
- Migrar prompt de LMS XP para `ai_instruction` layer=agent + `ai_prompt_template` para o template com variáveis
- Migrar daily report: separar instrução (banco) de dados de negócio (user message)
- Tela básica de gerenciamento de instruções no admin

**Etapa futura:**
- Resumo inteligente de histórico com cache de resumo
- Dashboard de custo e tokens
- Alerta por `ai-daily-cost-limit-usd`
