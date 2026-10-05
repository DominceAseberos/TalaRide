# TalaRide

TalaRide is maintained as a single monorepo for the mobile app, public/admin web frontend, backend API, shared code, and Supabase schema.

## Repository layout

```text
TalaRide/
├─ apps/
│  ├─ mobile/       Expo / React Native Android app
│  ├─ frontend/     React + Vite web app deployed to Vercel
│  └─ backend/      Node + Express API deployed to Render
├─ packages/
│  ├─ shared/       Shared TypeScript code used by TalaRide apps
│  └─ contracts/    Cross-app API/QR contract fixtures
├─ supabase/        Canonical Supabase migrations and functions
├─ docs/
├─ render.yaml
├─ pnpm-workspace.yaml
└─ turbo.json
```

The former standalone `Talaride-web` repository is preserved as migration history, but production source now belongs in this repository.

## Requirements

- Node.js
- pnpm 9.15.9
- Android SDK / JDK for native Android builds
- Supabase project credentials
- Backend provider credentials when running live payments

## Install

From the repository root:

```bash
pnpm install
```

Environment files are app-specific and are not committed:

- `apps/mobile/.env` or `apps/mobile/.env.production`
- `apps/frontend/.env`
- `apps/backend/.env`

Use the corresponding `.env.example` files as templates. Never commit signing keys, service-role keys, webhook secrets, or production env files.

## Development

Run an individual app:

```bash
pnpm mobile
pnpm frontend
pnpm backend
```

Or run workspace tasks with Turborepo:

```bash
pnpm build
pnpm test
pnpm lint
pnpm typecheck
```

Useful targeted checks:

```bash
pnpm test:mobile
pnpm test:backend
pnpm build:frontend
pnpm build:backend
```

## Production deployment roots

### Android / Expo

- App root: `apps/mobile`
- Android package: `com.beepanjero.talaride`
- GitHub APK releases are published from this repository.

### Vercel frontend

- Repository: `DominceAseberos/TalaRide`
- Root directory: `apps/frontend`
- Build command: `npm run build`
- Output directory: `dist`

### Render backend

- Repository: `DominceAseberos/TalaRide`
- Root directory: `apps/backend`
- Build command: `npm ci --include=dev && npm run build`
- Start command: `npm start`
- Health check: `/api/health`

The root `render.yaml` is configured for `apps/backend`.

## Supabase

`supabase/` is the canonical schema/function directory for the unified repository. Historical uncommitted migrations from the former web checkout were not merged automatically; they must be reviewed against the canonical migration history before adoption.

## Migration notes

The production Vite frontend and Express backend were imported from the latest `DominceAseberos/Talaride-web/main`. The previous experimental Next.js frontend is preserved under `legacy/next-web/` but is outside the active workspace so there is only one production frontend.

Historical mobile/web documentation is retained under `docs/archive/`. The old uncommitted web Supabase migrations are preserved under `supabase/archive/talaride-web-uncommitted/` for review only and are not applied automatically.
