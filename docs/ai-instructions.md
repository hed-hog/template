# AI Instructions in HedHog

This document describes how AI instructions work in HedHog, how to create agents and tools, how to measure cost, and how to debug executions.

---

## How AI instructions work

AI instructions are manageable texts — not hardcoded — that guide the behavior of language models. They live in the `ai_instruction` table and are composed in layers before each call to the LLM.

The system uses an in-memory cache with a 5-minute TTL for the static layers. Dynamic context (user, date, permissions) is generated at call time and is never cached.

---

## Instruction layers

```
L1 — system    Global instruction (e.g. "You are a HedHog assistant...")
L2 — product   Product/platform rules
L3 — module    Context of the active module (lms, finance, operations...)
L4 — agent     Agent persona and objective
L5 — tool      How to use a specific tool (injected on demand)
L6 — runtime   Dynamic data: userId, locale, date, roles (NEVER saved to the database)
L7 — output    JSON output contract (expected schema)
```

| Layer | When included | Cached |
|--------|---------------|----------|
| L1 system | Always | Yes, 5 min |
| L2 product | Always | Yes, 5 min |
| L3 module | When `moduleSlug` is provided | Yes, 5 min per module |
| L4 agent | When `agentSlug` is provided | Yes, 5 min per agent |
| L5 tool | When the tool is called | Together with the tool definition |
| L6 runtime | Always, generated in real time | Never |
| L7 output | When an expected schema exists | In code |

---

## How a final instruction is assembled

```typescript
// AiPromptBuilderService.build()
const { systemPrompt } = await promptBuilder.build({
  moduleSlug: 'lms',       // includes L3
  agentSlug: 'lms-assistant', // includes L4
  locale: 'pt',
});

// systemPrompt = L1 + "\n\n---\n\n" + L2 + "\n\n---\n\n" + L3 + "\n\n---\n\n" + L4
```

The runtime context (L6) is added by the caller:

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

## How to reduce tokens correctly

### 1. Keep L1 + L2 short and stable

L1 + L2 combined should never exceed 300 tokens. Any instruction that changes on every request **does not belong in L1/L2** — it goes to L6.

**Good:**
```
You are a HedHog system assistant. Use available tools to answer accurately.
Respond in the user's language. Be concise.
```
_(~25 tokens)_

**Bad:**
```
Você é um assistente avançado do sistema HedHog com acesso a ferramentas de finanças,
operações, LMS, CRM, commerce e campanhas. Responda sempre em português do Brasil
e use formato markdown quando necessário...
```
_(~60 tokens + hardcoded "pt" which prevents multilingual support)_

### 2. Use L3 and L4 only when necessary

Do not include `moduleSlug` if the conversation is not clearly about that module. Do not include `agentSlug` if there is no active agent.

### 3. Do not put business data in static instructions

Business data (query results, entity values) belongs in the user message or in `tool_result`. Never in the system instruction.

**Bad (in an instruction saved to the database):**
```
O usuário João tem 3 projetos ativos: Alpha ($50k), Beta ($30k), Gamma ($20k).
```

**Correct (as tool_result):**
```json
{ "projects": [{"name": "Alpha", "budget": 50000}, ...] }
```

### 4. Limit the history per conversation

`McpChatService` keeps the last 40 messages per turn (`HISTORY_MESSAGE_LIMIT = 40`). In long conversations, older messages are discarded.

To adjust this limit without a deploy, change the constant or evolve it into a configurable setting.

### 5. Is the model reading unnecessary data?

Every tool call sends the full result back to the LLM. If a tool's result is very large (e.g. 200 records), consider paginating or truncating it before returning it.

---

## How to create new agents

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

### Usage in code

```typescript
const { systemPrompt } = await promptBuilder.build({
  agentSlug: 'meu-agente',
});
```

**Rules for an agent's content:**
- Describe the agent's role, objective, and boundaries
- Mention which tools it should prefer (e.g. `Use lms.* tools for LMS operations`)
- Do not repeat global instructions (no need to say "respond in Portuguese" if L1 already instructs that)
- Maximum ~200 tokens

---

## How to create new tools

Tools are registered via `@McpTool()` in code. HedHog authenticates tools through the `route` table with `type = 'MCP'`.

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

**Rules for tool descriptions:**
- Maximum 2 sentences
- State what the tool DOES, not how it works
- Include the main filters in the text (improves the automatic selection score)
- Use the domain prefix in the name: `hr.`, `finance.`, `lms.`, `operations.`

For the tool to appear in the MCP Chat, add it to `route.yaml` and `role.yaml`:

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

## How to measure cost

Every call to the LLM generates a record in `ai_execution` with aggregated totals:

```sql
-- Total cost for the last 24h
SELECT
  SUM(cost_usd) AS total_usd,
  SUM(tokens_input) AS tokens_in,
  SUM(tokens_output) AS tokens_out
FROM ai_execution
WHERE started_at >= NOW() - INTERVAL '24 hours'
  AND status = 'completed';

-- Cost by model
SELECT provider, model, COUNT(*) AS calls,
       SUM(tokens_input) AS tokens_in,
       SUM(tokens_output) AS tokens_out,
       SUM(cost_usd) AS total_usd
FROM ai_execution_step
GROUP BY provider, model
ORDER BY total_usd DESC;

-- Top 10 most expensive executions
SELECT id, context_slug, cost_usd, tokens_total, status, started_at
FROM ai_execution
ORDER BY cost_usd DESC
LIMIT 10;
```

Prices are stored in `ai_model_pricing` and cached for 1 hour. To update prices without a deploy:

```sql
INSERT INTO ai_model_pricing (provider, model, price_input_per_million, price_output_per_million, valid_from)
VALUES ('openai', 'gpt-4o-mini', 0.150, 0.600, NOW())
ON CONFLICT (provider, model, valid_from) DO NOTHING;
```

---

## How to debug an execution

### 1. View the details of an execution

```sql
-- Execution header
SELECT id, context_slug, trigger, status,
       tokens_input, tokens_output, tokens_total,
       ROUND(cost_usd::numeric, 6) AS cost_usd,
       EXTRACT(EPOCH FROM (finished_at - started_at)) AS duration_seconds,
       error
FROM ai_execution
WHERE id = <execution_id>;

-- Execution steps
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

### 2. View the executed path

Look at the `step_order` and `type` of the steps:

| type | Meaning |
|------|-----------|
| `prompt` | LLM called — includes input/output tokens |
| `tool_call` | LLM decided to call a tool |
| `tool_result` | Tool result sent back to the LLM |
| `output` | Final response to the user |
| `error` | Error caught during execution |

### 3. Manually log an execution

```typescript
const execId = await aiExecution.start({
  trigger: 'api',
  userId: 42,
  contextSlug: 'meu-contexto',
});

// ... call the LLM ...

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

### 4. Check which instruction was used

```sql
-- View the active instruction by slug
SELECT slug, layer, name, version, LEFT(content, 500) AS content_preview, is_active
FROM ai_instruction
WHERE slug = 'system.global';

-- View version history
SELECT v.version, v.change_note, v.created_at,
       u.name AS changed_by,
       LEFT(v.content, 300) AS content_preview
FROM ai_instruction_version v
LEFT JOIN "user" u ON u.id = v.created_by_id
WHERE v.instruction_id = <id>
ORDER BY v.version DESC;
```

---

## Best practices for writing instructions

### General principles

1. **One instruction, one responsibility.** L1 defines tone; L2 defines product; L3 defines module; L4 defines agent. Do not mix them.
2. **Be specific, not verbose.** 3 precise sentences are worth more than 1 generic paragraph.
3. **Never instruct what is already the model's default behavior.** "Be polite and respond well" does not need to be written.
4. **State constraints, not tutorials.** "Confirm destructive operations before executing" is useful. A paragraph explaining why is unnecessary.
5. **Use action verbs.** "Respond in the user's language." not "You should always try to respond in the same language the user uses."

### Examples

#### Global instruction (L1) — GOOD

```
You are a HedHog system assistant. Use available tools to answer accurately.
Respond in the user's language. Be concise.
```
_26 tokens, clear, no redundancy._

#### Global instruction (L1) — BAD

```
Você é um assistente do sistema HedHog, uma plataforma empresarial SaaS modular desenvolvida
para gestão de finanças, operações, LMS, CRM, commerce e campanhas. Você deve sempre ser
educado e profissional, respondendo com clareza e precisão. Use as ferramentas disponíveis
para buscar dados no sistema e nunca invente informações. Sempre responda em português do
Brasil, usando linguagem formal mas acessível.
```
_~90 tokens, too long, "don't make things up" is an unnecessary generic instruction, fixed language prevents multilingual support._

---

#### Module instruction (L3) — GOOD

```
LMS module manages courses, lessons, enrollments, and XP. Use lms.* tools for all LMS operations.
```
_22 tokens, enough for the model to know the domain and which tools to use._

#### Module instruction (L3) — BAD

```
O módulo LMS (Learning Management System) do HedHog gerencia cursos e aulas, que podem ser do
tipo vídeo, texto ou quiz. Os alunos se matriculam em cursos e ganham XP ao completar aulas.
O XP é calculado com base em segmentos da aula, que possuem dificuldade (easy, medium, hard, expert)
e tipos de aprendizagem. Use sempre as ferramentas com prefixo lms. para consultar dados do LMS.
```
_~100 tokens. The XP schema details are only relevant to the XP agent — not to every LMS agent._

---

#### Agent instruction (L4) — GOOD

```
You are an LMS assistant. Help instructors and students with course creation, lesson management,
enrollments, and learning progress. Focus on educational outcomes. Use lms.* tools.
```
_35 tokens, clear persona, clear objective, tool prefix specified._

#### Agent instruction (L4) — BAD

```
Você é um assistente de LMS. Você deve ajudar professores e alunos. Quando alguém perguntar sobre
cursos, use a ferramenta de listagem de cursos. Quando alguém perguntar sobre matrículas, use a
ferramenta de matrículas. Quando alguém perguntar sobre XP, use a ferramenta de XP. Nunca responda
sem consultar os dados reais do sistema. Sempre confirme com o usuário antes de criar ou deletar
qualquer coisa no LMS.
```
_~90 tokens. The list of tools per question type is unnecessary — the model already does this via tool selection._

---

## Checklist for new AI instructions

Before creating or updating an instruction, answer:

- [ ] **Is the instruction actually necessary?** Does the model's default behavior fail to handle it without an instruction?
- [ ] **Is it duplicating a global instruction?** If it is already in L1/L2, do not repeat it in L3/L4.
- [ ] **Can it be shorter?** Cut everything that is not a concrete constraint or guideline.
- [ ] **Does it depend on dynamic context?** Data that changes per request belongs in L6 (runtime), not in the database.
- [ ] **Is the dynamic context limited?** L6 should only include what is necessary for the current task.
- [ ] **Is the expected output clear?** If the response must follow a schema, make it explicit in the instruction or in L7.
- [ ] **Does an output schema exist?** For structured responses (JSON), use `response_format: { type: 'json_object' }` or specify the schema.
- [ ] **Is there versioning?** Use `change_note` when updating — the history is automatically saved in `ai_instruction_version`.
- [ ] **Is there cost logging?** Every LLM call must go through `AiExecutionService.start()` / `recordStep()` / `finish()`.
- [ ] **Is there a test or execution example?** Before enabling in production, test the instruction with real inputs and verify the behavior.

---

## Status report — Technical review (2026-06-10)

### Issues found

| Severity | File | Issue |
|-----------|---------|---------|
| **Critical** | `ai-execution.service.ts:listExecutions()` | SQL injection — `userId` and `contextSlug` interpolated into `$queryRawUnsafe` |
| **Medium** | `ai-instruction.service.ts:invalidateCache()` | Incorrect slug→cache_key mapping — `slug.includes(key)` does not map `module.lms` → `module:lms` |
| **Medium** | `mcp-chat.service.ts` | Unbounded history — the entire history was loaded and sent to the LLM, with no limit |
| **Low** | `mcp-chat.service.ts` | Model `gpt-4o-mini` hardcoded in `runOpenAiLoop` (two locations: API call and recordStep) |
| **Info** | `lesson-xp-ai-calculation.service.ts:278` | System prompt hardcoded for the LMS XP calculation |
| **Info** | `operations-daily-report-ai.service.ts:65-73` | Instruction + JSON schema + business data mixed in the same message |
| **Info** | `operations.service.ts:13196,13304` | Two hardcoded system prompts for contract generation/review |
| **Info** | `mcp-chat.service.ts:100-209` | `DOMAIN_KEYWORDS` still hardcoded (not migrated to an extensible registry) |
| **Info** | `mcp-chat.service.ts:84` | `TARGET_SELECTED_TOOLS = 112` — no effective tool reduction (the plan proposed ~25) |

### Adjustments made in this review

1. **SQL injection fixed** (`ai-execution.service.ts`) — `listExecutions()` rewritten with a parameterized `Prisma.$queryRaw` for all 4 cases (no filter, by userId, by contextSlug, by both). `limit` capped at 100.

2. **Cache invalidation fixed** (`ai-instruction.service.ts`) — `invalidateCache()` now correctly extracts the layer and identifier from the slug to delete the right keys (e.g. `module.lms` → deletes `module` and `module:lms`).

3. **History windowing applied** (`mcp-chat.service.ts`) — Both loops (OpenAI and Gemini) now limit the history to the `HISTORY_MESSAGE_LIMIT = 40` most recent messages, preventing token explosion in long conversations. The window uses `.slice()` instead of summarization to preserve the integrity of tool_call/tool_result pairs.

### Qualitative token reduction estimate

| Change | Estimated reduction |
|---------|-----------------|
| Global instruction from the database (instead of duplicated hardcoded text) | 0% (was equivalent) |
| History windowing (40 msgs instead of unlimited) | **40-80%** in long conversations (>40 msgs) |
| Selective L3/L4 composition (only when needed) | **20-40%** when module/agent is not identified |
| Compact global instruction (L1 ~26 tokens vs. previous) | **~5%** per turn |
| _Pending: tool reduction 112→25_ | _estimated ~60%_ of input tokens in typical requests |
| _Pending: history window with intelligent summarization_ | _estimated ~20%_ additional on top of simple windowing |

### What can still be optimized

1. **`TARGET_SELECTED_TOOLS = 112` → reduce to ~25-30**: the largest available token gain. Requires careful scoring adjustment and testing with users across different roles.

2. **Hardcoded `gpt-4o-mini` model** in `McpChatService`: move to the `mcp-default-model-openai` setting to avoid a deploy when changing models.

3. **Migrate module prompts**: LMS XP, daily report, and Operations contracts still have hardcoded prompts. Migrate to `ai_instruction` (layer=agent) and `ai_prompt_template` (for templates with variables).

4. **Separate the JSON schema from the user message** in the daily report: instruction + schema should be the system prompt (L7), not the user message.

5. **Intelligent history summarization**: the current windowing is simple (slice). Implement summarization for conversations longer than 40 messages, preserving context without sending tokens.

6. **`/ai/instructions` admin screen**: instruction CRUD with a visual diff of versions.

7. **`/ai/usage` dashboard**: cost visualization by period, drill-down by execution, top tools.

### Recommendations for the next step

**Immediate step (high priority):**
- Reduce `TARGET_SELECTED_TOOLS` from 112 to 30 with testing
- Move the `mcp-chat` default model to a setting

**Next step:**
- Migrate the LMS XP prompt to `ai_instruction` layer=agent + `ai_prompt_template` for the template with variables
- Migrate the daily report: separate the instruction (database) from business data (user message)
- Basic instruction management screen in the admin

**Future step:**
- Intelligent history summarization with summary caching
- Cost and token dashboard
- Alert via `ai-daily-cost-limit-usd`
