# Stage 1: Base
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# Stage 2: Dependencies
FROM base AS deps
# Copy workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./

# Copy scripts needed for postinstall
COPY scripts ./scripts

# Copy admin app
COPY apps/admin/package.json ./apps/admin/package.json

# Copy all packages (with their package.json and tsconfig)
COPY packages ./packages

# CI pnpm config: network resilience + shared store dir (no auth tokens).
COPY docker/npmrc.ci ./.npmrc

# Install all dependencies (frozen lockfile for reproducible builds)
RUN corepack use pnpm@10.32.1
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Stage 3: Builder
FROM base AS builder
WORKDIR /app

# Build with a deterministic placeholder so NEXT_PUBLIC_API_BASE_URL can be
# replaced at container startup with the real public URL from runtime env vars.
ENV NEXT_PUBLIC_API_BASE_URL=__RUNTIME_NEXT_PUBLIC_API_BASE_URL__
ENV NEXT_STANDALONE=1
ENV CI=true

# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./

# Same CI pnpm config as deps stage (store-dir). Keeping this consistent stops
# pnpm from treating the copied node_modules as stale and recreating it offline.
COPY docker/npmrc.ci ./.npmrc

# Copy installed dependencies from deps stage
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/admin ./apps/admin
COPY --from=deps /app/packages ./packages
COPY --from=deps /app/scripts ./scripts

# Copy source code for admin and all packages
COPY apps/admin ./apps/admin
COPY packages ./packages

# Reconcile node_modules against the lockfile. The node_modules copied from the
# deps stage can be served from an older cached layer, so a few packages may be
# missing; allow pnpm to fetch them from the registry (all public, no auth) while
# the shared store cache keeps the already-present packages fast. Not --offline,
# which would fail on any package missing from the store (ERR_PNPM_NO_OFFLINE_TARBALL).
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile

# Build the admin app with Turbo
RUN pnpm build --filter admin

# Stage 4: Runner (Production)
FROM node:24-alpine AS runner
WORKDIR /app

# Default environment (can be overridden at runtime)
ENV NODE_ENV=production
ENV PORT=3200
ENV HOSTNAME="0.0.0.0"

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output (Next.js optimized build)
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

# Copy entrypoint script that replaces NEXT_PUBLIC_* placeholders at startup
COPY --chown=nextjs:nodejs apps/admin/docker-entrypoint.sh /app/docker-entrypoint.sh
RUN sed -i 's/\r$//' /app/docker-entrypoint.sh && chmod +x /app/docker-entrypoint.sh

# Ensure app directory permissions remain valid for the Next.js runtime
RUN chown nextjs:nodejs /app && chmod 755 /app

USER nextjs

EXPOSE 3200

ENTRYPOINT ["/app/docker-entrypoint.sh"]
