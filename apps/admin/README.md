# 🎨 HedHog Admin App

Admin dashboard application built with [Next.js 16](https://nextjs.org) in a Turborepo monorepo.

## 🚀 Getting Started

### Development

```bash
# From monorepo root - runs admin + api
pnpm start:admin

# Or run admin only (from this directory)
pnpm dev

# Open http://localhost:3200
```

### Environment Setup

Copy the example environment file:

```bash
cp .env.example .env.local
```

Required variables:

```env
NEXT_PUBLIC_API_BASE_URL=/api
INTERNAL_API_URL=http://localhost:3100
```

- `NEXT_PUBLIC_API_BASE_URL`: public/browser-facing API URL. In local development this can stay as `/api`.
- `INTERNAL_API_URL`: server-side API URL used by Next.js in Docker, Kubernetes, and SSR flows.

## 🐳 Docker Deployment

### Quick Start

```bash
# Build image (from monorepo root)
docker build -f apps/admin/Dockerfile -t hedhog-admin:latest .

# Run container
docker run -d -p 3200:3200 \
  -e NEXT_PUBLIC_API_BASE_URL="http://localhost:3100" \
  -e INTERNAL_API_URL="http://api:3100" \
  --name hedhog-admin hedhog-admin:latest
```

### Using Scripts

**PowerShell (Windows):**

```powershell
.\apps\admin\build-docker.ps1
```

**Bash (Linux/Mac):**

```bash
./apps/admin/build-docker.sh
```

### Using Docker Compose

```bash
cd apps/admin
docker-compose up -d
```

### 📚 Docker Documentation

- [`Dockerfile`](./Dockerfile) - Multi-stage build for the admin image
- [`docker-compose.yaml`](../../docker-compose.yaml) - Local Postgres, Redis and Mailhog
- [DEPLOYMENT.md](../../DEPLOYMENT.md) - Production deployment guide

## 🏗️ Project Structure

```
apps/admin/
├── src/
│   ├── app/              # Next.js App Router pages
│   ├── components/       # React components
│   │   ├── ui/          # Shadcn/UI components
│   │   └── ...          # Feature components
│   ├── lib/             # Utilities and helpers
│   └── i18n/            # Internationalization
├── public/              # Static assets
├── messages/            # i18n translation files
├── Dockerfile           # Production Docker image
├── docker-compose.yml   # Docker Compose config
└── package.json
```

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Components**: Shadcn/UI + Radix UI
- **Icons**: Lucide React
- **Forms**: React Hook Form + Zod
- **State**: TanStack Query (via @hed-hog/next-app-provider)
- **i18n**: next-intl

## 📦 Available Scripts

```bash
pnpm dev          # Start development server (port 3200)
pnpm build        # Build for production
pnpm start        # Start production server
pnpm lint         # Run ESLint
pnpm format       # Format code with Prettier
```

## 🎨 UI Components

This project uses [Shadcn/UI](https://ui.shadcn.com/) components. All components are in `src/components/ui/`.

Key components:

- Forms: `Form`, `Input`, `Select`, `Textarea`, `Checkbox`, etc.
- Data: `Table`, `DataTable`, `Pagination`
- Feedback: `Toast`, `Alert`, `Dialog`, `AlertDialog`
- Layout: `Card`, `Tabs`, `Accordion`, `Sheet`

## 🌍 Internationalization

Translation files are in `messages/{locale}.json`:

- `en.json` - English
- `pt.json` - Portuguese

Usage in components:

```tsx
import { useTranslations } from 'next-intl';

const t = useTranslations('namespace');
return <h1>{t('title')}</h1>;
```

## 🔗 Integration with API

The app uses `@hed-hog/next-app-provider` for API communication:

```tsx
import { useApp, useQuery } from '@hed-hog/next-app-provider';

const { request } = useApp();

const { data } = useQuery({
  queryKey: ['users'],
  queryFn: () => request({ url: '/user', method: 'GET' }),
});
```

## 📚 Learn More

### Next.js Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [Learn Next.js](https://nextjs.org/learn)

### Project Resources

- [DEPLOYMENT.md](../../DEPLOYMENT.md) - Environment setup and deployment scenarios
- [`docker-compose.yaml`](../../docker-compose.yaml) - Local service stack
- [`Dockerfile`](./Dockerfile) - Multi-stage build explanation

## 🚢 Deployment

### Docker (Recommended)

See [DEPLOYMENT.md](../../DEPLOYMENT.md) for the complete guide.

### Kubernetes

See [DEPLOYMENT.md](../../DEPLOYMENT.md) for the Kubernetes deployment guide.

### Cloud Platforms

- **Vercel**: Push to GitHub and connect repository
- **AWS**: Use ECS with Docker image
- **Google Cloud**: Deploy to Cloud Run
- **Azure**: Use Container Apps

See [DEPLOYMENT.md](../../DEPLOYMENT.md) for detailed deployment instructions.

## 🔒 Security

- JWT-based authentication
- HTTP-only cookies for refresh tokens
- Role-based access control
- CORS protection
- CSRF protection

## 📝 License

MIT

---

**Part of the HedHog monorepo** | [Root README](../../README.md)
