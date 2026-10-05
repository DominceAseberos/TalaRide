# TalaRide Web App & Monorepo — Full Plan

> **Status:** Draft · September 2026
> **Produced by:** Grilled interview session with lead dev

---

## 1. Why a Web App Makes TalaRide Profitable

The mobile app alone is free and privacy-first — it records rides locally and never bills anyone.
The **web dashboard flips the revenue model**: LGUs and franchise operators pay a monthly SaaS fee to manage their fleet legally and efficiently.

| Layer | Who uses it | How they pay |
|---|---|---|
| Mobile app (Expo) | Passengers | Free forever |
| Web dashboard (Next.js) | Operators & LGU admins | Monthly SaaS subscription |

**Why operators/LGUs will pay:**
- LTFRB/LGU compliance is legally required — MTOP renewals, driver licensing, vehicle inspections
- Manual paper records are error-prone and expensive to audit
- A digital registry with expiry alerts saves money and avoids franchise revocations
- The passenger mobile app already builds trust in the TalaRide brand — operators want to be "on" it

---

## 2. Business Model

```
Free tier   →  Mobile passenger app (forever free, privacy-first)
Paid tier   →  Web dashboard per operator/LGU municipality
```

**Suggested pricing (finalize later):**
- ₱499/month per operator (up to 20 vehicles)
- ₱2,999/month per municipality (unlimited operators under one LGU)
- Annual plan: 2 months free

---

## 3. Web Dashboard — MVP Features

### 3.1 Vehicle Registry
- Register tricycles/pedicabs: Body #, MTOP #, Plate #, unit type, year
- Upload vehicle photos
- Status: Active / Suspended / For Renewal

### 3.2 Driver Profiles
- Full name, birthday, license number, license expiry
- Assigned vehicle(s)
- Contact number, emergency contact
- Profile photo upload

### 3.3 Compliance Dashboard
- **MTOP expiry tracker** — color-coded: green → yellow (30 days) → red (expired)
- **Driver license expiry** alerts
- **Vehicle inspection due dates**
- **Franchise status** — Active / Lapsed / Pending Renewal
- Exportable compliance report (PDF/CSV) for LGU submission

### 3.4 Roles
| Role | Access |
|---|---|
| `lgu_admin` | Read all operators in their municipality, generate reports |
| `operator` | Full CRUD on their own vehicles and drivers |
| `driver` | *(Phase 4)* View own profile, receive notifications |

---

## 4. Privacy — What Does NOT Change

> **The mobile passenger app stays 100% local-only.**
> Passenger ride history is NEVER uploaded to Supabase.
> The web app only stores what operators voluntarily enter: vehicle and driver records.

There is no linkage between passenger ride logs and the web app's vehicle registry.

---

## 5. Monorepo Architecture

### Why monorepo?
- Shared TypeScript types prevent drift between mobile and web
- Shared Supabase client factory = one place to update keys/config
- Shared Zod schemas = consistent validation on mobile and server
- Single git history, single PR review process

### Tool: **Turborepo + pnpm workspaces**
- Industry standard for Expo + Next.js monorepos
- Built-in task graph caching (builds, lints, tests run only when changed)
- Optional Vercel remote cache for CI speed

---

## 6. New Monorepo Folder Structure

```
talaride/                          ← monorepo root (rename from TalaRide/)
├── apps/
│   ├── mobile/                    ← Expo passenger app (moved here, unchanged)
│   │   ├── src/
│   │   ├── app.json
│   │   ├── package.json
│   │   └── ...
│   └── web/                       ← NEW: Next.js App Router dashboard
│       ├── app/
│       │   ├── (auth)/            ← /login, /register, /create-org
│       │   ├── (dashboard)/       ← protected layout
│       │   │   ├── vehicles/      ← vehicle registry pages
│       │   │   ├── drivers/       ← driver profile pages
│       │   │   └── compliance/    ← expiry dashboard
│       │   └── layout.tsx
│       ├── components/
│       ├── lib/
│       ├── package.json
│       └── next.config.ts
├── packages/
│   └── shared/                    ← NEW: shared code
│       ├── src/
│       │   ├── types/             ← TS types: Ride, Driver, Vehicle, IdentifierType
│       │   ├── supabase/          ← Supabase client factory + generated DB types
│       │   └── validation/        ← Zod schemas (VehicleSchema, DriverSchema, etc.)
│       ├── tsconfig.json
│       └── package.json
├── supabase/                      ← Migrations + edge functions (moved to root)
│   ├── migrations/
│   └── functions/
├── planning/                      ← This folder
│   └── web-app/
│       └── PLAN.md
├── turbo.json                     ← Turborepo pipeline config
├── pnpm-workspace.yaml            ← Declares apps/* and packages/*
├── package.json                   ← Root devDependencies (turbo, typescript, prettier)
└── tsconfig.json                  ← Root tsconfig extended by all apps/packages
```

---

## 7. Supabase Schema Changes

The current Supabase DB has: `profiles` (passengers) and the lost-item relay edge function.
We add three new tables and extend `profiles`.

### New SQL migrations

```sql
-- organizations: the paying customer unit (operator co-op or LGU)
CREATE TABLE organizations (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT NOT NULL,
  municipality          TEXT NOT NULL,
  region                TEXT NOT NULL,
  subscription_tier     TEXT NOT NULL DEFAULT 'free'
                          CHECK (subscription_tier IN ('free', 'operator', 'lgu')),
  subscription_expires_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- vehicles: registered units per organization
CREATE TABLE vehicles (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  body_number       TEXT NOT NULL,
  mtop_number       TEXT,
  plate_number      TEXT,
  unit_type         TEXT NOT NULL DEFAULT 'tricycle'
                      CHECK (unit_type IN ('tricycle', 'pedicab')),
  year              INTEGER,
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active', 'suspended', 'for_renewal')),
  mtop_expires_at   DATE,
  inspection_due_at DATE,
  photo_url         TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- drivers: registered drivers per organization
CREATE TABLE drivers (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  vehicle_id          UUID REFERENCES vehicles(id) ON DELETE SET NULL,
  full_name           TEXT NOT NULL,
  license_number      TEXT,
  license_expires_at  DATE,
  contact_number      TEXT,
  emergency_contact   TEXT,
  photo_url           TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- extend existing profiles table (passengers already use this)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'passenger'
    CHECK (role IN ('passenger', 'operator', 'lgu_admin')),
  ADD COLUMN IF NOT EXISTS organization_id UUID
    REFERENCES organizations(id) ON DELETE SET NULL;
```

### Row Level Security (RLS) policies

```sql
-- Operators can only touch their own org's vehicles
CREATE POLICY "operator_own_vehicles" ON vehicles
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Operators can only touch their own org's drivers
CREATE POLICY "operator_own_drivers" ON drivers
  FOR ALL USING (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- LGU admins can READ all orgs in their municipality
CREATE POLICY "lgu_read_municipality_orgs" ON organizations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'lgu_admin'
        AND municipality = organizations.municipality
    )
  );
```

---

## 8. `packages/shared` — Shared Code

### Types (`src/types/index.ts`)

```typescript
// Already exists in mobile — move here, import from @talaride/shared
export type IdentifierType = 'MTOP' | 'Body #' | 'Plate #';

// New for web
export type VehicleStatus = 'active' | 'suspended' | 'for_renewal';
export type UnitType = 'tricycle' | 'pedicab';
export type UserRole = 'passenger' | 'operator' | 'lgu_admin';
export type SubscriptionTier = 'free' | 'operator' | 'lgu';

export interface Vehicle {
  id: string;
  organizationId: string;
  bodyNumber: string;
  mtopNumber?: string;
  plateNumber?: string;
  unitType: UnitType;
  status: VehicleStatus;
  mtopExpiresAt?: string;       // ISO date string
  inspectionDueAt?: string;     // ISO date string
  photoUrl?: string;
  createdAt: string;
}

export interface Driver {
  id: string;
  organizationId: string;
  vehicleId?: string;
  fullName: string;
  licenseNumber?: string;
  licenseExpiresAt?: string;
  contactNumber?: string;
  photoUrl?: string;
}
```

### Zod validation (`src/validation/vehicle.ts`)

```typescript
import { z } from 'zod';

export const VehicleSchema = z.object({
  bodyNumber: z.string().min(1).max(15).regex(/^[A-Z0-9][A-Z0-9 -]*$/i),
  mtopNumber: z.string().max(20).optional(),
  plateNumber: z.string().max(10).optional(),
  unitType: z.enum(['tricycle', 'pedicab']),
  year: z.number().int().min(1980).max(new Date().getFullYear() + 1).optional(),
  mtopExpiresAt: z.string().date().optional(),
  inspectionDueAt: z.string().date().optional(),
});

export type VehicleInput = z.infer<typeof VehicleSchema>;
```

---

## 9. Auth Strategy

**Same Supabase project** — extend existing auth with roles.

```
passenger   →  mobile app, local rides, never interacts with web data
operator    →  web dashboard, manages their org's fleet via RLS
lgu_admin   →  web dashboard, read-only across their municipality
```

**Operator sign-up flow:**
1. Visit `app.talaride.ph/register`
2. Create account (email + password via Supabase Auth)
3. Fill in organization details (name, municipality, region)
4. `profiles.role` set to `operator` automatically — RLS enforces access
5. Manually upgraded to `lgu_admin` by support team for MVP; self-serve upgrade in Phase 4

---

## 10. Deployment

| App | Host | URL |
|---|---|---|
| Web dashboard | **Vercel** | `app.talaride.ph` |
| Marketing site *(Phase 4)* | Vercel | `talaride.ph` |
| Mobile app | **EAS** (Expo) | App Store + Google Play |
| Database + Auth | **Supabase Cloud** | Existing project |
| Edge functions | Supabase Edge | Same project |

### Environment variable rules

```
packages/shared    →  NO secrets (types/schemas only)
mobile        →  EXPO_PUBLIC_SUPABASE_URL
                      EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY
apps/web           →  NEXT_PUBLIC_SUPABASE_URL
                      NEXT_PUBLIC_SUPABASE_ANON_KEY
                      SUPABASE_SERVICE_ROLE_KEY  ← server-only, NEVER in client bundle
```

> **Critical:** `SUPABASE_SERVICE_ROLE_KEY` is only used in Next.js Server Components and
> Route Handlers (no `'use client'` files). Never expose it to the browser.

---

## 11. Migration Phases

### Phase 1 — Monorepo Setup *(Completed)*
- [x] Init Turborepo at repo root, create `pnpm-workspace.yaml`
- [x] Move Expo app → `mobile/`, update all internal paths
- [x] Scaffold `apps/web/` with Next.js App Router & TypeScript
- [x] Create `packages/shared/`, migrate shared models and Zod validation schemas
- [x] Link `@talaride/shared` as workspace dependency across apps
- [x] Smoke test: `pnpm turbo build`, `typecheck`, and `test` run clean

### Phase 2 — Supabase Schema *(Completed)*
- [x] Write migration `supabase/migrations/202609280001_fleet_management.sql` (`organizations`, `vehicles`, `drivers`)
- [x] Alter `profiles` for `role`, `organization_id`, and `municipality`
- [x] Implement and verify multi-tenant Row Level Security (RLS) policies with automated PostgreSQL integration tests
- [x] Generate TypeScript DB types in `@talaride/shared` (`src/types/database.ts`)

### Phase 3 — Web Dashboard MVP *(Completed)*
- [x] Sleek Filipino transport tech glassmorphism design system in Vanilla CSS
- [x] Vehicle Registry: filterable list table, search, registration modal with Zod validation, inline status toggling, deletion
- [x] Driver Directory: driver cards, license expiry detection, vehicle assignment dropdown, driver creation modal
- [x] Compliance Dashboard: color-coded MTOP expiry countdowns, urgent alerts (&lt; 30d), physical inspection due tracker
- [x] Export LGU Compliance CSV: one-click CSV generation formatted for LGU Tricycle Franchising & Regulatory Board (TFRB)
- [x] Local fleet store with browser persistence and realistic initial seed dataset

### Phase 4 — Launch & Scale *(~2–4 weeks)*
- [ ] Stripe / Maya billing integration for subscription payments
- [ ] Email alerts for upcoming expiries (Supabase + Resend)
- [ ] Public vehicle lookup: `talaride.ph/verify/[bodyNumber]`
- [ ] Mobile badge: "Verified Vehicle" shown in passenger app when body # is in registry
- [ ] Driver self-registration portal
- [ ] Marketing landing page at `talaride.ph`

---

## 12. Open Decisions (Resolve Before Phase 1)

| Decision | Recommendation |
|---|---|
| Root folder rename? | Rename `TalaRide/` → `talaride/` for consistency |
| Billing at launch — Stripe or manual invoice? | **Manual invoicing** for MVP; Stripe in Phase 4 |
| Will drivers get their own login? | Yes, Phase 4 |
| Public marketing site? | Yes, `talaride.ph` — Phase 4 |
| RA 10173 (Data Privacy Act) compliance for driver PII? | **Must-do before storing driver data**: Privacy Policy, NPC registration |

---

## 13. Summary

```
TalaRide monorepo
├── mobile      Expo passenger app — free, privacy-first, unchanged
├── apps/web         Next.js operator/LGU SaaS dashboard — the revenue engine
└── packages/shared  Types + Supabase client + Zod schemas — shared truth
```

**The mobile app is the trust-builder. The web app is the business.**
Operators and LGUs pay because compliance is mandatory — TalaRide just makes it effortless.
