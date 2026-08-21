# API App

Estas instrucoes se aplicam a `apps/api`.

## Papel do app
- `apps/api` e um entrypoint fino do backend; a logica de negocio deve ficar em `libraries/*`.
- Integrar modulos das libraries via workspace packages `@hed-hog/*`.

## Prisma
- Nunca editar manualmente `prisma/schema.prisma`.
- Nunca executar `hedhog dev apply` neste repositorio `hub`.
- Nunca executar comandos que resetem/recriem projeto, banco, schema ou migrations existentes.
- Nao apagar, sobrescrever ou regenerar migrations existentes; elas precisam continuar intactas para atualizar o banco de producao.
- Quando alterar YAML de estrutura ou dados em `libraries/*/hedhog/table/*.yaml` ou `libraries/*/hedhog/data/*.yaml`, criar uma nova migration SQL em `apps/api/prisma/migrations` refletindo a mesma alteracao.
- Apos criar um novo arquivo de migration, aplicar executando `pnpm prisma:deploy` no path `apps/api`.
- Para refresh do schema e client, usar `pnpm db:update` apenas quando aplicavel e depois de o banco estar na estrutura esperada.
- Nao introduzir fluxo baseado em `prisma migrate dev` neste projeto, salvo politica futura explicita.

## Integracao backend
- Ao adicionar ou conectar um modulo novo, manter `app.module.ts` e os imports consistentes com o padrao existente.
- Nao duplicar regras de negocio no entrypoint que deveriam estar em services das libraries.
