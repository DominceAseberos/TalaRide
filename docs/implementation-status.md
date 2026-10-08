# TalaRide — Goal + Implementation Status

> Historical planning snapshot (before the unified monorepo). References to
> Next.js, `apps/web`, and unbuilt web/backend services below are superseded.
> For the current source layout see [README.md](../README.md); for remaining
> demonstration checks see [presentation-readiness-2026-10-08.md](presentation-readiness-2026-10-08.md).

## 1. Goal
TalaRide MVP proves: tricycle drivers accept digital payments, commuters pay fast via QR Ph apps (GCash/Maya/GoTyme/banks) or cash, app adds ride records/safety/lost-item/rewards value, every ride resolves to driver + vehicle + transaction + time. Cash stays. App never mandatory for guest pay. One thing well: `Scan → See ₱30 → Pay → ✓`.

## 2. Architecture (3-tier, SQL)
- Tier 1 `talaride/` mobile (Expo): commuter + driver modes, offline-first, no secrets.
- Tier 2 `talaride-web/` (Next.js): admin frontend + `/api/*` backend truth + public `/v/[code]` fallback. Owns `service_role`, provider keys.
- Tier 3 Supabase Postgres (SQL, not NoSQL): ACID pay+ride+reward tx, FK, unique `provider_ref`, partial unique active shift, CHECK amounts, RLS, realtime.
- Current repo (pre-split): `mobile/`, `apps/web/`, `packages/shared/`, `supabase/`, `docs/`.

## 3. Implemented (mobile-first, verified)
- Shared `packages/shared/src/`: `qr.ts` (static vehicle QR + dynamic payment QR parse/expiry/intent string), `money.ts` (`formatCentavos`, `parsePesoToCentavos` ₱1 floor), `types/payments.ts` (`PaymentIntent`, `ServerRide`, `DEFAULT_FARES`), `validation/payment.ts` (zod centavos 100–99990000).
- Offline `mobile/src/offline/queue.ts`: SQLite `outbox` (`checkin|cash_ride|payment_confirm|payment_issue|lost_report`) + `flushOutbox()`.
- Mock payments `src/payments/mock.ts`: `EXPO_PUBLIC_PAYMENT_MODE=mock`, signed 300s single-use intents, offline verify, 2s status poll, idempotent confirm.
- QR UI: `components/QrImage.tsx` (pure-JS `qrcode-generator` + `react-native-svg`, offline), `app/driver.tsx` (large `TR-01842`, driver name, fare grid + custom confirm, Request payment, WAITING/✓ PAID/expired, New QR/Expire, cash record, today's total), `app/scan-ride.tsx` (barcode QR + manual `TR-00000`, offline), `app/ride-confirm.tsx` (sig/expiry verify, confirm + queue), `app/payment-status.tsx` (poll).
- Commuter UI replaced per plan: `BottomNav` Home/Scan/History/Rewards/Account, `home.tsx` SCAN RIDE hero + recent + rewards progress, `rewards.tsx` x/10 + caps notice, `rides.tsx` history, `ride/[id].tsx` vehicle/date/payment/status/pickup + both report actions, `profile.tsx` Account + Driver mode, `receipt.tsx` history/scan + disclaimers, `Disclaimers.tsx` shorts.
- Deps: `qrcode-generator@1.4.4` + `@types/qrcode-generator@1.0.6`. Env: `.env.example` + `EXPO_PUBLIC_VEHICLE_QR_BASE`, `EXPO_PUBLIC_QR_EXPIRY_SEC=300`, `EXPO_PUBLIC_PAYMENT_MODE=mock`.
- Tests: `tests/qr.test.cjs` (money/vehicle/dynamic), `tests/relay-ui.test.cjs` Disclaimers stub. `typecheck` clean, `expo lint` clean, `test` 35/35.

## 4. Contracts (source of truth)
- `docs/backend-contract.md v2`: naming (`snake_case` DB/API, `camelCase` TS), centavos, codes, 17 APIs §6.1–6.17, RLS, rewards eligibility, env, offline contract.
- `docs/mvp-migration-plan.md`: phases 0–8, file ops, gates, metrics.
- `docs/talaride-web-init.md`: AI copy-paste spec to build Tier 2.

## 5. Not yet (next)
- `talaride-web/` build per init spec: migrations, `/api/*`, webhook HMAC, admin modules, `/v/[code]`, analytics.
- Live QR Ph acquirer swap (mock → provider, same payload shape/UI).
- OTP/PIN/biometric auth, shifts server truth, server rewards mint, push templates.
- Repo split: `git mv mobile→talaride`, `apps/web→talaride-web`, `supabase→talaride-web/supabase`.

## 6. Run/verify
`pnpm --filter @talaride/mobile typecheck|lint|test`, `pnpm --filter @talaride/shared typecheck`. Demo: Driver → fare → Request payment → Scan ride → Confirm → driver ✓ PAID; airplane mode → scan/checkin/cash still instant, sync on reconnect.
