FROM node:24-alpine AS base

# Keep pnpm version deterministic across all stages.
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate

WORKDIR /app

# Stage 1: Pruner - keep only the API dependency graph in the workspace
FROM base AS pruner

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json ./
COPY apps/ ./apps/
COPY packages/ ./packages/
COPY libraries/ ./libraries/
COPY scripts/ ./scripts/

RUN pnpm dlx turbo@2.8.14 prune api --docker

# Stage 2: Builder - install full deps for the pruned workspace and compile
FROM base AS builder

# Install dependencies from manifests first for better layer caching.
COPY --from=pruner /app/out/json/ ./
COPY --from=pruner /app/scripts/ ./scripts/

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

RUN NODE_OPTIONS="--max-old-space-size=4096" pnpm run build:docker

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

# Install system binaries used in runtime workloads (PDF + video conversion).
RUN apk add --no-cache chromium nss freetype harfbuzz ca-certificates ttf-freefont ffmpeg

# Stage 4: Migrator - dedicated image for running Prisma migrations only
FROM node:24-alpine AS migrator

RUN apk add --no-cache dumb-init \
  && npm install -g prisma@6.18.0 \
  && npm cache clean --force

WORKDIR /app/apps/api

COPY apps/api/prisma ./prisma
COPY apps/api/docker-entrypoint-migrate.sh ./docker-entrypoint-migrate.sh
RUN chmod +x ./docker-entrypoint-migrate.sh

ENTRYPOINT ["dumb-init", "sh", "./docker-entrypoint-migrate.sh"]

# Stage 5: Production - minimal runtime image
FROM node:24-alpine AS production

# Install dumb-init and runtime binaries (PDF + video conversion).
RUN apk add --no-cache dumb-init chromium nss freetype harfbuzz ca-certificates ttf-freefont ffmpeg

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
