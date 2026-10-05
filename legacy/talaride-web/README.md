# TalaRide MVP Web Application & API

> Frictionless QR Ph Digital Payments, Safety Records & Rewards for Philippine Tricycles.

This project implements the full **TalaRide MVP Application Plan** (Sections 1 through 43).

📖 **Detailed Documentation**: See [PROJECT_GOALS_AND_MOBILE_ARCHITECTURE.md](./PROJECT_GOALS_AND_MOBILE_ARCHITECTURE.md) for the complete breakdown of project goal objects, entity relationships, sequence flows, and native mobile OS integrations.

As requested, the repository is architected into **two completely separate, independently deployable folders**:

```text
Talaride-web/
├── frontend/               # Standalone Vite + React + Tailwind CSS client
│   ├── dist/               # Production build output (static SPA)
│   ├── src/                # Driver, Commuter, Guest, Admin & Simulator components
│   ├── package.json        # Frontend dependencies & build scripts
│   ├── vite.config.ts      # Vite config with Tailwind & proxy
│   ├── .env.example        # VITE_API_URL configuration
│   └── README.md           # Frontend deployment guide (Vercel, Netlify, Cloudflare)
│
├── backend/                # Standalone Node.js + Express + SSE microservice
│   ├── dist/               # Compiled TypeScript backend
│   ├── src/                # REST API, DB models, SSE real-time event bus
│   ├── package.json        # Backend dependencies & scripts
│   ├── tsconfig.json       # NodeNext TypeScript config
│   ├── .env.example        # PORT=4000 configuration
│   └── README.md           # Backend deployment guide (Render, Railway, Fly.io, AWS)
│
└── package.json            # Root workspace scripts for convenient local orchestration
```

---

## Architecture & Features

### 1. Frontend (`/frontend`)
- **Driver App**:
  - High-contrast, sunlight-legible interface with extra-large touch targets.
  - Driver login (Mobile OTP + PIN).
  - Vehicle assignment & shift start (e.g., Driver **DR-000481** Juan D. operating **TR-01842** Tagum Poblacion TODA).
  - Standard fares: **₱15, ₱20, ₱25, ₱30, ₱40** + **Custom Fare** (₱120 special trip modal with confirmation).
  - Dynamic QR Ph code generator with 10-minute expiry countdown.
  - Instant visual recognition, Web Audio synthesizer chime, and haptic vibration upon server payment confirmation (`✓ PAID ₱30`).
  - Cash ride logging & daily transaction breakdown (**Fare vs. Net Payout after digital gateway fees**).
  - Mediated lost-item recovery alerts (`I Found It`, `Not Found`, `Support`).
- **Commuter App**:
  - Instant "SCAN RIDE" camera/preset scanner.
  - Ride confirmation dialog with fare review before payment.
  - In-app QR Ph checkout (GCash, Maya, GoTyme).
  - Ride history and detailed trip breakdown.
  - Mediated lost-item reporting (Phone, Wallet, Bag, Documents, Keys, Other).
  - TalaRide Rewards progress bar (1 TalaPoint per ride, 10 rides unlock promo reward).
  - Safety Check-In Mode (record cash rides by scanning permanent vehicle sticker without requiring digital payment).
  - Complete Philippine legal notices, safety disclaimers (Sections 29–38), and emergency dialers (Tagum PNP, 911).
- **Guest Payment Mode**:
  - Zero-installation payment flow simulating GCash / Maya scan without the TalaRide app installed.
- **Admin Operations Portal**:
  - Overview KPI metrics: Active Drivers, Digital Adoption %, Total Digital Volume, Confirmation Speed.
  - Drivers management: verification, suspension, TODA assignments.
  - Vehicles management: registration, driver linking, printable permanent QR stickers.
  - Live searchable transaction log.
  - Payment dispute resolution and refund approval.
  - Lost-item queue management.
  - Dynamic standard fare matrix configuration.
- **Live Dual-Screen Simulator**:
  - Side-by-side interactive testing: tap ₱30 on Driver terminal, pay on passenger phone, hear the chime, and see the driver phone turn green in real time!

### 2. Backend (`/backend`)
- **Domain Models** (Section 25): Users, Drivers, Vehicles, Driver Shifts, Rides, Payments, Lost Item Reports, Rewards Transactions, Payment Issues.
- **Real-Time SSE Stream** (`/api/events`): Pushes instant notifications for payment confirmations, shift updates, and lost item reports.
- **QR Ph Engine**: Fee calculation (1.75% provider gateway fee), net driver payout calculation, and payment verification webhooks.
- **Pre-Seeded Data**: Pre-loaded with Driver DR-000481 (Juan Dela Cruz), Vehicle TR-01842, Commuter Maria Santos, and historical transactions matching the plan.

---

## Running Locally

### Option A: Using Root Workspace Scripts
```bash
# Install backend dependencies
npm install --prefix backend

# Install frontend dependencies
npm install --prefix frontend

# Start backend (runs on http://localhost:4000)
npm run dev:backend

# In a separate terminal, start frontend (runs on http://localhost:3000)
npm run dev:frontend
```

### Option B: Running Individually

**Backend:**
```bash
cd backend
npm install
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## Separate Deployment Guide

### Deploying the Backend
- **Platforms**: Render, Railway, Fly.io, DigitalOcean App Platform, or Docker.
- **Root Directory**: `backend`
- **Build Command**: `npm run build`
- **Start Command**: `npm run start`
- **Environment Variables**:
  - `PORT`: (provided automatically by host, or default 4000)
  - `NODE_ENV`: `production`

### Deploying the Frontend
- **Platforms**: Vercel, Netlify, Cloudflare Pages, GitHub Pages, or S3.
- **Root Directory**: `frontend`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Environment Variables**:
  - `VITE_API_URL`: URL of your deployed backend (e.g., `https://api.talaride.ph`)
