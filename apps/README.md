# HedHog Full Stack - Docker Compose

Stack completo: PostgreSQL + API (NestJS) + Admin (Next.js)

## Quick Start

```powershell
# No diretório apps/
cd apps

# Build e start de todos os containers
docker-compose up -d

# Ver logs
docker-compose logs -f

# Ver logs de um serviço específico
docker-compose logs -f api
docker-compose logs -f admin
docker-compose logs -f db

# Parar todos os containers
docker-compose down

# Parar e remover volumes (apaga dados do banco)
docker-compose down -v
```

## Acessar URLs

- **Admin**: http://localhost:3200
- **API**: http://localhost:3100
- **API Health**: http://localhost:3100/health
- **PostgreSQL**: localhost:5432 (user: hedhog, password: changeme, db: hedhog)

## Configuração

Edite o arquivo `.env` no diretório `apps/` para customizar:

- `RUN_MIGRATIONS=true` - Roda migrations na inicialização da API
- `JWT_SECRET` - Segredo para tokens JWT
- `JWT_EXPIRES_IN` - Tempo de expiração dos tokens JWT
- `CORS_ALLOWED_ORIGINS` - URLs permitidas pelo CORS da API (separadas por vírgula)
- `NEXT_PUBLIC_API_BASE_URL` - URL pública da API usada pelo browser/admin
- `INTERNAL_API_URL` - URL server-side da API usada pelo Next.js em Docker/Kubernetes

## Build individual

```powershell
# Apenas API
docker-compose build api

# Apenas Admin
docker-compose build admin

# Rebuild sem cache
docker-compose build --no-cache api
```

## Troubleshooting

### API não conecta no banco
- Verifique se o healthcheck do `db` está ok: `docker-compose ps`
- Veja logs do banco: `docker-compose logs db`

### Admin não conecta na API
- Verifique se a API está saudável: `curl http://localhost:3100/health`
- Confirme `NEXT_PUBLIC_API_BASE_URL` e `INTERNAL_API_URL` no `.env`

### Rebuild após mudanças no código
```powershell
docker-compose down
docker-compose build
docker-compose up -d
```
