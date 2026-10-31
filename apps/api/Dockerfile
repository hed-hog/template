FROM node:24.22.1-alpine AS base

# Keep pnpm version deterministic across all stages.
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Stage 1: Pruner - keep only the API dependency graph in the workspace
FROM base AS pruner

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY patches/ ./patches/
COPY apps/ ./apps/
COPY packages/ ./packages/
COPY libraries/ ./libraries/
COPY scripts/ ./scripts/

RUN pnpm dlx turbo@2.11.4 prune api --docker

# Stage 2: Builder - install full deps for the pruned workspace and compile
FROM base AS builder

# Install dependencies from manifests first for better layer caching.
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/scripts/ ./scripts/
COPY --from=pruner /app/patches/ ./patches/

# Install build dependencies for native modules (sharp, etc)
RUN apk add --no-cache python3 make g++ cairo-dev jpeg-dev pango-dev giflib-dev pixman-dev

# CI pnpm config: network resilience + shared store dir (no auth tokens).
COPY docker/npmrc.ci ./.npmrc

RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Rebuild sharp for the musl-x64 platform to ensure proper runtime compatibility
RUN npm rebuild sharp --build-from-source --os=linux --libc=musl --cpu=x64 2>/dev/null || true

# Copy sources for the pruned workspace and build API.
RUN rm -rf /app/packages/api-prisma/node_modules/@prisma/client
COPY --from=pruner /app/out/full/ ./

WORKDIR /app/apps/api
RUN pnpm exec prisma generate

RUN test -d /app/node_modules/.prisma/client && \
    node -e "require('@prisma/client')"

# O `nest build` da API passou de 4 GB de heap e o passo morria com "Ineffective
# mark-compacts near heap limit" (exit 134), derrubando o job Deploy API e
# pulando todos os deploys que dependem dele. O runner `ubuntu-latest` tem 16 GB,
# entao 8 GB aqui sobram — o mesmo teto que destrava o build local.
#
# Faz o mesmo que o `build:docker` (libraries, `nest build`, assets do core), mas
# as libraries saem do turbo, e nao do `pnpm -r`: com o cache dele num mount do
# BuildKit, um deploy recompila so as libraries que mudaram e as que dependem
# delas. O mount so sobrevive entre builds num builder persistente, como o do
# runner self-hosted do deploy (infra/digitalocean/github-runner); num builder
# novo o cache comeca vazio e o passo custa o mesmo que antes.
#
# Os pre-scripts ficam desligados. O `prebuild` de cada library roda o
# scripts/build-dependencies.ts, que recompila as dependencias quando nao acha o
# cache dele no hedhog.json, e o hedhog.json nao entra na imagem: no build de
# 27/10/2026 foram 28 dependencias ja compiladas compiladas de novo, metade dos
# ~31 min do passo. O turbo ja segue o grafo (`dependsOn: ^build`), e o unico
# pre-script com efeito, o `prisma:update` do api-prisma, gera o mesmo client
# que o `prisma generate` acima.
#
# `--env-mode=loose` porque o modo estrito (padrao do turbo 2) so repassa as
# variaveis declaradas no turbo.json: sem ele o `npm_config_enable_pre_post_scripts`
# e o NODE_OPTIONS nao chegam as libraries, o prebuild roda mesmo assim e, sem o
# cache do hedhog.json, recompila em cadeia as dependencias que o turbo acabou
# de restaurar (um build com so o lms alterado passou de 80 min em 27/10/2026).
# As duas variaveis porque o prefixo mudou: o pnpm 11 (o `packageManager` do
# package.json, que o corepack usa aqui dentro) so le `pnpm_config_*`, e o pnpm
# 10 so le `npm_config_*`.
RUN --mount=type=cache,id=turbo-api,target=/turbo-cache \
    export NODE_OPTIONS="--max-old-space-size=8192" \
      pnpm_config_enable_pre_post_scripts=false \
      npm_config_enable_pre_post_scripts=false \
      TURBO_TELEMETRY_DISABLED=1 && \
    pnpm exec turbo run build --filter='api^...' --cache-dir=/turbo-cache \
      --env-mode=loose --concurrency=4 --output-logs=new-only && \
    pnpm exec nest build && \
    pnpm run copy:core-assets

# Portao de subida: um provider injetado sem que o modulo o enxergue ("Nest
# can't resolve dependencies of X") so estoura quando o processo sobe — sem esta
# checagem o erro estreia no cluster, com o pod em CrashLoopBackOff e o rollout
# revertido. Roda offline: o compile() do @nestjs/testing monta o grafo sem
# disparar onModuleInit, e o PrismaService entra trocado por um duble, entao nao
# ha banco nem Redis envolvidos. As variaveis abaixo sao descartaveis, so
# existem para satisfazer quem valida configuracao no construtor, e ficam no
# comando (nao viram ENV da imagem).
RUN NODE_ENV=production \
    DATABASE_URL="postgresql://di-check:di-check@127.0.0.1:5432/di-check" \
    JWT_SECRET=di-check \
    JWT_EXPIRES_IN=7d \
    PEPPER=di-check \
    ENCRYPTION_SECRET=di-check \
    CORS_ALLOWED_ORIGINS=http://localhost \
    node scripts/di-check.js

# Source maps do Sentry. O `nest build` e tsc puro (sem bundler), entao nao ha
# plugin que suba os mapas: o upload e explicito, via @sentry/cli. Tem de ser
# AQUI, e nao depois: o stage `deployer` apaga todo *.map de /prod/api/dist
# antes de a imagem de producao ser montada — e e assim que deve continuar. O
# que sobrevive e o Debug ID que o `sourcemaps inject` grava DENTRO de cada
# .js; e ele que casa o stack trace de producao com o mapa guardado no Sentry,
# sem embarcar nenhum .map no runtime.
ARG SENTRY_RELEASE
ARG SENTRY_ORG=
ARG SENTRY_PROJECT=api
# O token entra por mount, nunca por ARG/ENV: ARG fica visivel no `docker
# history` e ENV fica gravado na camada exportada para o cache do GitHub
# Actions (`cache-to: type=gha,mode=max,scope=api`). Sem token o build passa
# igual — so nao sobe os mapas, e o stack trace de producao chega minificado.
RUN --mount=type=secret,id=sentry_auth_token \
    set -eu; \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)"; \
    if [ -z "$SENTRY_AUTH_TOKEN" ]; then \
      echo "AVISO: SENTRY_AUTH_TOKEN ausente — pulando inject/upload de source maps."; \
    elif [ -z "${SENTRY_RELEASE:-}" ]; then \
      echo "AVISO: SENTRY_RELEASE ausente — pulando inject/upload de source maps."; \
    else \
      export SENTRY_AUTH_TOKEN; \
      pnpm exec sentry-cli sourcemaps inject dist; \
      pnpm exec sentry-cli sourcemaps upload \
        --org "$SENTRY_ORG" \
        --project "$SENTRY_PROJECT" \
        --release "$SENTRY_RELEASE" \
        dist \
      || echo "AVISO: upload de source maps falhou (Sentry indisponivel?); build segue."; \
    fi

WORKDIR /app

RUN mkdir -p /app/apps/api/dist/apps/api && \
    cp /app/apps/api/package.json /app/apps/api/dist/apps/api/package.json

# Stage 3: Deployer - create a portable production package for API
FROM builder AS deployer

RUN pnpm --filter api --prod deploy --legacy /prod/api

# Ensure core runtime assets exist in the final dist even if deploy pruning skips them.
RUN set -eux; \
  mkdir -p /prod/api/dist/libraries/core/src/file/templates; \
  mkdir -p /prod/api/dist/libraries/core/src/language; \
  cp -f /app/apps/api/dist/libraries/core/src/file/templates/download-error.html /prod/api/dist/libraries/core/src/file/templates/download-error.html; \
  cp -rf /app/apps/api/dist/libraries/core/src/language/. /prod/api/dist/libraries/core/src/language/

# Hoist ALL pnpm virtual store packages to top-level node_modules/.
# NestJS compiles workspace packages into a flat dist/ directory, so their
# transitive dependencies must be resolvable from the project root node_modules
# rather than from per-package isolation in .pnpm/.
# Uses relative symlinks so paths survive the COPY to the production stage.
RUN set -eux; \
    NM="/prod/api/node_modules"; \
    for pkg_dir in "$NM"/.pnpm/*/node_modules/*; do \
      [ -d "$pkg_dir" ] || continue; \
      name="$(basename "$pkg_dir")"; \
      case "$name" in .*) continue;; esac; \
      if echo "$name" | grep -q '^@'; then continue; fi; \
      [ -e "$NM/$name" ] || ln -s "${pkg_dir#$NM/}" "$NM/$name"; \
    done; \
    for scope_dir in "$NM"/.pnpm/*/node_modules/@*; do \
      [ -d "$scope_dir" ] || continue; \
      scope="$(basename "$scope_dir")"; \
      for pkg_dir in "$scope_dir"/*; do \
        [ -d "$pkg_dir" ] || continue; \
        name="$(basename "$pkg_dir")"; \
        mkdir -p "$NM/$scope"; \
        [ -e "$NM/$scope/$name" ] || ln -s "../${pkg_dir#$NM/}" "$NM/$scope/$name"; \
      done; \
    done

# Make @hed-hog/core resolve to the NestJS-compiled output in dist/.
# The compiled files use relative paths to other workspace packages (e.g.,
# require('../../../packages/api/src')) that only work from dist/libraries/core/src/.
# Copying them to the pnpm store would break those paths, so we symlink
# node_modules/@hed-hog/core directly to the dist output.
RUN set -eux; \
    DIST_CORE="/prod/api/dist/libraries/core/src"; \
    NM_CORE="/prod/api/node_modules/@hed-hog/core"; \
    if [ -d "$DIST_CORE" ]; then \
      rm -rf "$NM_CORE"; \
      mkdir -p "$(dirname "$NM_CORE")"; \
      ln -s "../../dist/libraries/core/src" "$NM_CORE"; \
    fi

# Copy the GENERATED .prisma/client from the builder stage (at /app/node_modules/.prisma/client/)
# to the deployed package.  The copy from the pnpm store would only get the
# default stub, not the real generated client with models and runtime.
RUN set -eux; \
    mkdir -p /prod/api/node_modules/.prisma/client; \
    cp -r /app/node_modules/.prisma/client/* /prod/api/node_modules/.prisma/client/

# Make generated Prisma client reachable from api-prisma loaded via pnpm virtual store.
RUN set -eu; \
    for nm in /prod/api/node_modules/.pnpm/@hed-hog+api-prisma@*/node_modules; do \
      [ -d "$nm" ] || continue; \
      mkdir -p "$nm/node_modules"; \
      ln -sfn ../../../../.prisma "$nm/node_modules/.prisma"; \
    done

# Keep compatibility with compiled workspace paths that resolve from dist/.
RUN set -eux; \
  mkdir -p /prod/api/dist; \
  ln -sfn ../node_modules /prod/api/dist/node_modules

# Migrations are handled by the dedicated migrator image, so Prisma CLI is not needed here.
RUN rm -rf /prod/api/node_modules/.pnpm/prisma@* /prod/api/node_modules/prisma

# Validate Prisma client is available in deployed package
RUN node -e "require('/prod/api/node_modules/@prisma/client')"
RUN node -e "require('/prod/api/node_modules/.prisma/client')"
RUN node -e "require('/prod/api/node_modules/@hed-hog/api-prisma/dist/generated-client.js')"

# Keep only the musl query engine required by @prisma/client on Alpine runtime.
RUN find /prod/api/node_modules/.pnpm -type f -path "*/@prisma/engines/*" \
      ! -name "libquery_engine-linux-musl-*.so.node" \
      ! -name "LICENSE" \
      ! -name "README.md" \
      -delete

# Clean incompatible sharp binaries from all platforms except musl
RUN for sharpath in /prod/api/node_modules/.pnpm/sharp@*/node_modules/sharp; do \
      [ -d "$sharpath" ] || continue; \
      find "$sharpath/build/Release" -type f ! -name "*musl*" -delete 2>/dev/null || true; \
      find "$sharpath/vendor" -maxdepth 1 -type d ! -name "musl*" -exec rm -rf {} + 2>/dev/null || true; \
    done

RUN rm -rf \
    /prod/api/.turbo \
    /prod/api/coverage \
    /prod/api/src \
    /prod/api/test \
    /prod/api/Dockerfile \
    /prod/api/.dockerignore \
    /prod/api/.eslintrc.js \
    /prod/api/.prettierrc.js \
    /prod/api/jest.config.d.ts \
    /prod/api/jest.config.d.ts.map \
    /prod/api/jest.config.js \
    /prod/api/jest.config.js.map \
    /prod/api/jest.config.ts \
    /prod/api/tsconfig.build.json \
    /prod/api/tsconfig.build.tsbuildinfo \
    /prod/api/tsconfig.json

# Runtime doesn't need TypeScript declaration/maps in compiled output.
RUN find /prod/api/dist -type f \( -name "*.map" -o -name "*.d.ts" -o -name "*.tsbuildinfo" \) -delete

# NOTA: nao instale binarios de runtime (chromium, ffmpeg) aqui. O stage de
# producao copia apenas /prod/api/ deste stage — pacotes apk vao para /usr/bin e
# /usr/lib, fora do caminho copiado — e ja os instala por conta propria. Um
# `apk add` aqui e ~500MB de layer morta que so ocupa disco no runner e infla o
# export `cache-to: type=gha,mode=max,scope=api`.

# Stage 4: Migrator - dedicated image for running Prisma migrations only
FROM node:24.22.1-alpine AS migrator

# O prisma fica num diretorio proprio, e nao em `npm install -g`, porque o
# install global ignora `overrides`: o @prisma/config do 6.19.3 ainda traz o
# deepmerge-ts 7.1.5 (CVE-2026-40345). Depois do install o npm sai da imagem:
# o entrypoint chama o binario do prisma, e o npm que vem na imagem do Node
# carrega brace-expansion e undici vulneraveis.
RUN apk add --no-cache dumb-init \
  && mkdir -p /opt/prisma \
  && cd /opt/prisma \
  && echo '{"private":true,"dependencies":{"prisma":"6.19.3"},"overrides":{"deepmerge-ts":"^8.0.2"}}' > package.json \
  && npm install --omit=dev --no-audit --no-fund \
  && ln -s /opt/prisma/node_modules/.bin/prisma /usr/local/bin/prisma \
  && npm cache clean --force \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /root/.npm

WORKDIR /app/apps/api

COPY apps/api/prisma ./prisma
COPY apps/api/docker-entrypoint-migrate.sh ./docker-entrypoint-migrate.sh
RUN chmod +x ./docker-entrypoint-migrate.sh

ENTRYPOINT ["dumb-init", "sh", "./docker-entrypoint-migrate.sh"]

# Stage 5: Production - minimal runtime image
FROM node:24.22.1-alpine AS production

# Install dumb-init and runtime binaries (PDF + video conversion).
# iputils: o `ping` do monitor de saude (libraries/status) usa socket ICMP sem
# privilegio, que o ping do busybox nao abre; o pod precisa do sysctl
# net.ipv4.ping_group_range (k8s/queue-workers/worker-deployment.yaml).
RUN apk add --no-cache dumb-init chromium nss freetype harfbuzz ca-certificates ttf-freefont ffmpeg iputils

# O runtime so roda `node` (o SystemService consulta o registry por HTTP, sem o
# CLI): o npm que vem na imagem do Node carrega brace-expansion e undici
# vulneraveis, e nem ele nem npx/corepack sao usados aqui.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
  /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV CHROMIUM_NO_SANDBOX=true

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Set working directory
WORKDIR /app/apps/api

# Copy portable deployed API package (includes production node_modules).
COPY --chown=nestjs:nodejs --from=deployer /prod/api/ ./

# Normalize potential CRLF in shell script copied from Windows host.
RUN sed -i 's/\r$//' /app/apps/api/docker-entrypoint.sh

# Keep entrypoint executable after copy.
RUN chmod +x /app/apps/api/docker-entrypoint.sh

# Create storage directory (if needed by the app)
RUN mkdir -p /app/apps/api/storage && chown -R nestjs:nodejs /app/apps/api/storage

# Release assado na imagem: o @sentry/node le `release` de SENTRY_RELEASE, entao
# nao existe env var de release para manter nos Deployments — a imagem E o
# release, e hub-queue-worker/hub-video-worker herdam o mesmo valor porque usam
# a mesma imagem. Fica DEPOIS do apk add de proposito: o valor muda a cada
# commit e invalidaria a camada mais cara do stage (chromium + ffmpeg).
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=$SENTRY_RELEASE

# Switch to non-root user
USER nestjs

# Expose port
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s \
  CMD node -e "require('http').get('http://localhost:3100/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use custom entrypoint
ENTRYPOINT ["/app/apps/api/docker-entrypoint.sh"]

# Start the application with dumb-init
CMD ["dumb-init", "node", "dist/apps/api/src/main.js"]
