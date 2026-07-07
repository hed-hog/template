# HedHog Framework - Bootstrap Template

[![CI](https://github.com/hed-hog/template/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/hed-hog/template/actions/workflows/ci.yml)
[![Security](https://github.com/hed-hog/template/actions/workflows/security.yml/badge.svg?branch=master)](https://github.com/hed-hog/template/actions/workflows/security.yml)

This is the bootstrap template for the **HedHog Framework**, a modular framework based on NestJS and Next.js for building enterprise applications. Use it as a starting point for a new project.

> 🌐 Official website and full documentation: **[hedhog.com](https://hedhog.com)**

## Project Structure

HedHog is organized as a monorepo using **pnpm** and **Turborepo**, split into three main directories:

### 📁 Apps

Main applications that already come ready with the framework:

- **`apps/admin`** - Admin dashboard in Next.js with authentication, user management, roles and settings
- **`apps/api`** - REST API in NestJS that serves as the backend for the admin dashboard

### 📚 Libraries

Feature modules that can be installed into HedHog as needed. The `libraries/` directory **is not committed to the template** — it is created and populated by the HedHog CLI as modules are installed into the project.

> **Licensing**: only the **Core** module is Open Source (MIT). All other modules are **Enterprise** and require an active HedHog commercial license.

#### Open Source

- **`libraries/core`** - Core modules (auth, user, role, menu, settings, file, mail, AI, dashboard)

#### Enterprise

- **`libraries/address`** - Address management
- **`libraries/agent`** - AI agents
- **`libraries/campaign`** - Email campaigns (templates, recipient lists, sending, suppression and tracking)
- **`libraries/category`** - Category system
- **`libraries/cms`** - Content management
- **`libraries/commerce`** - Commerce (products, orders and payments)
- **`libraries/crm`** - CRM (people, contacts, proposals and sales funnel)
- **`libraries/finance`** - Finance (accounts, entries and reports)
- **`libraries/inbox`** - Unified inbox
- **`libraries/lms`** - LMS (courses, lessons, classes, enrollments, certificates and gamification)
- **`libraries/operations`** - Operations (contracts and operational routines)
- **`libraries/queue`** - Queues and asynchronous processing
- **`libraries/tag`** - Tag system

### 🔧 Packages

Reusable support packages shared across the ecosystem:

- **`@hed-hog/api`** - Shared utilities for NestJS (decorators, guards, etc.)
- **`@hed-hog/api-prisma`** - Shared Prisma client
- **`@hed-hog/api-pagination`** - Pagination service
- **`@hed-hog/api-locale`** - Internationalization
- **`@hed-hog/api-mail`** - Email sending
- **`@hed-hog/next-app-provider`** - React provider for Next.js (auth, queries, context)
- **`@hed-hog/eslint-config`** - ESLint configurations
- **`@hed-hog/jest-config`** - Jest configurations
- **`@hed-hog/typescript-config`** - TypeScript configurations
- **`@hed-hog/ui`** - Reusable React components

All packages and applications are 100% [TypeScript](https://www.typescriptlang.org/).

### Utilities

This monorepo already comes configured with essential tools:

- [TypeScript](https://www.typescriptlang.org/) - Static typing
- [ESLint](https://eslint.org/) - Code linting
- [Prettier](https://prettier.io) - Code formatting
- [Jest](https://jestjs.io/) - Unit testing
- [Playwright](https://playwright.dev/) - E2E testing
- [Prisma](https://www.prisma.io/) - Database ORM
- [pnpm](https://pnpm.io/) - Package manager
- [Turborepo](https://turborepo.com/) - Monorepo build system

## Getting Started

### Prerequisites

- Git
- Node.js 24+
- pnpm 9+
- PostgreSQL 18+ (or use the included Docker Compose)

### Installation

```bash
# Clone this template
git clone <your-repository-url> my-project
cd my-project

# Install dependencies
pnpm install

# Configure environment variables (creates .env in all apps)
# pnpm install already runs this automatically via postinstall

# Start the database (optional - using Docker)
docker-compose up -d

# Run Prisma migrations
cd apps/api
pnpm prisma:deploy

# Go back to the root and start the project
cd ../..
pnpm start:admin  # Starts admin (3200) + api (3100)
# or
pnpm dev          # Starts everything in parallel
```

### Available Commands

This `Turborepo` already configured useful commands for all your apps and packages.

#### Build

```bash
# Builds all applications and packages
pnpm run build
```

#### Development

```bash
# Starts the development server for all apps
pnpm run dev

# Or start specific apps
pnpm start:admin  # Admin + API
pnpm start:api    # API only
```

#### Tests

```bash
# Runs all tests
pnpm run test

# E2E tests
pnpm run test:e2e
```

#### Lint and Formatting

```bash
# Code linting
pnpm run lint

# Formats all code
pnpm format
```

#### Database

```bash
# Updates the Prisma schema from the existing database
pnpm db:update

# Applies migrations (first time)
cd apps/api
pnpm prisma:deploy
```

## Module Development

### Creating a New Library

Libraries under `libraries/` follow the NestJS module pattern and can be installed as needed:

```typescript
// Example: libraries/my-module/src/my-module.module.ts
@Module({
  imports: [forwardRef(() => CoreModule)],
  controllers: [MyModuleController],
  providers: [MyModuleService],
  exports: [MyModuleService],
})
export class MyModuleModule {}
```

### Publishing a Package

```bash
cd packages/package-name
pnpm prod  # Runs: patch → build → publish
```

## Architecture

### Backend (NestJS)

- **Library-First pattern**: All business logic lives in `libraries/core`
- **apps/api**: Just an entry point that imports the modules from the libraries
- **Prisma**: Migration-first workflow; changes to database YAML require a new versioned SQL migration
- **Authentication**: JWT with refresh tokens
- **Authorization**: Role and route-based permission system

### Frontend (Next.js)

- **App Router**: Next.js 15 with React Server Components
- **Shadcn/UI**: Components with Tailwind CSS v4
- **TanStack Query**: Server state management via `@hed-hog/next-app-provider`
- **Internationalization**: next-intl with support for multiple languages
- **Forms**: react-hook-form + zod for validation

### Remote Caching

> [!TIP]
> Vercel Remote Cache is free for all plans. Get started today at [vercel.com](https://vercel.com/signup?/signup?utm_source=remote-cache-sdk&utm_campaign=free_remote_cache).

Turborepo can use a technique known as [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```bash
npx turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, you can link your Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```bash
npx turbo link
```

## Contributing

This is a project under active development. Contributions are welcome!

1. Fork the project
2. Create a branch for your feature (`git checkout -b feature/MyFeature`)
3. Commit your changes (`git commit -m 'Add MyFeature'`)
4. Push to the branch (`git push origin feature/MyFeature`)
5. Open a Pull Request

## Useful Links

- [HedHog - Official Website and Documentation](https://hedhog.com)
- [Turborepo Documentation](https://turborepo.com/docs)
- [NestJS Documentation](https://docs.nestjs.com)
- [Next.js Documentation](https://nextjs.org/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Shadcn/UI Components](https://ui.shadcn.com)

## License

The **Core** module (`libraries/core`) is **Open Source** under the MIT license. All other modules under `libraries/*` are **Enterprise**, distributed under a commercial license — see the `LICENSE.md` of each library.
