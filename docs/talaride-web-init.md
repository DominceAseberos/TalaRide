# TalaRide-Web Init — AI Build Spec (frontend + backend, Tier 2)

## 1. Goal

Build `talaride-web/` as Tier 2 of 3-tier MVP: Next.js admin frontend + backend API truth + public vehicle fallback. Mobile `talaride/` (Tier 1) calls these APIs; Supabase Postgres (Tier 3) stores data. MVP proves: driver QR → guest/app pay or cash → server-confirmed `PAID` → ride record → rewards → lost-item + admin. No booking/dispatch/ratings/tracking/chat.

## 2. Tier context

- `talaride/` mobile: Expo, offline queue, QR decode. No secrets. Base URL `EXPO_PUBLIC_WEB_API=https://web.talaride.ph/api`.
- `talaride-web/` (this build): owns UI + `/api/*` + `supabase/` schema IaC.
- Supabase hosted Postgres (SQL, not NoSQL — ACID pay+ride+reward tx, FK, unique `provider_ref`, partial unique active shift, CHECK amounts, RLS, realtime).

## 3. Stack (pinned)

Next `16.3.6`, React `19.2.8`, `@supabase/supabase-js ^2.117.2`, TypeScript `^5`, `zod ^3.24.0`, shared `packages/shared` (`qr.ts`, `money.ts`, `types/payments.ts`, `validation/payment.ts`). Pure server secrets in `lib/supabase-server.ts` only.

## 4. Target tree

```
talaride-web/
  app/layout.tsx app/page.tsx                 # admin shell + overview
  app/v/[code]/page.tsx                       # public fallback: vehicle_code, masked driver, shift status, cash guidance
  app/api/payment-intent/route.ts             # 6.6
  app/api/mock-confirm/route.ts               # 6.7 demo, 403 when PAYMENT_MODE=live
  app/api/payment-webhook/route.ts            # 6.8 HMAC x-provider-signature
  app/api/payment-status/route.ts             # 6.9 GET ?payment_id=
  app/api/shift-start/route.ts app/api/shift-end/route.ts
  app/api/fares/route.ts                      # GET ?organization_id=&municipality=
  app/api/cash-record/route.ts app/api/ride-checkin/route.ts
  app/api/rides/route.ts app/api/rides/[id]/route.ts
  app/api/lost-item-report/route.ts app/api/lost-item-respond/route.ts
  app/api/rewards-me/route.ts app/api/payment-issue/route.ts
  app/api/admin-{transactions,drivers-verify,assign,fares,lost-items,analytics}/route.ts
  lib/supabase-client.ts (anon) lib/supabase-server.ts (service_role, server-only)
  components/{Sidebar,Header,StatsCards,VehiclesTable,DriversList,ComplianceView,TransactionsTable,PaymentIssuesQueue,LostItemsQueue,FareConfig,AnalyticsOverview}
  supabase/migrations/*.sql supabase/functions/payment-webhook/index.ts
```

## 5. Env

Server-only: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENT_PROVIDER_KEY`, `PAYMENT_WEBHOOK_SECRET`, `QR_INTENT_SECRET`, `PAYMENT_MODE=mock|live`. Public: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_WEB_BASE=https://web.talaride.ph`, `NEXT_PUBLIC_QR_EXPIRY_SEC=300`. Never expose service_role to client.

## 6. Conventions (must match `docs/backend-contract.md v2`)

- JSON `snake_case`. Money INT centavos 100–99990000 (₱1–₱999,900), never float. Time ISO UTC.
- `drivers.driver_code 'DR-000481'`, `vehicles.vehicle_code 'TR-00000'`.
- Static QR `${BASE}/v/TR-01842?c=ab12` (identity only). Dynamic QR `{"v":1,"payment_id","ride_id","vehicle_code","amount_centavos","expires_at","nonce","sig"}` single-use, 300s expiry. Only webhook/mock-confirm sets `confirmed`.

## 7. Backend APIs (implement all, zod-validate)

- `POST /api/payment-intent {shift_id,vehicle_code,amount_centavos,payment_method:"digital"}` → `201 {payment_id,ride_id,amount_centavos,qr_payload,expires_at}`; creates `rides(pending)+payments(awaiting_confirmation,provider=mock|qrph_acquirer)`. Validate shift active, vehicle active.
- `POST /api/mock-confirm {payment_id}` → confirmed; reject expired/used; 403 if live.
- `POST /api/payment-webhook` HMAC body, `{provider_ref UNIQUE,provider_status:PAID|FAILED|EXPIRED,amount_centavos}`; amount cross-check; PAID → `confirmed+completed_at` + atomic reward mint + notifications + `payment_events`. Idempotent retries.
- `GET /api/payment-status?payment_id=` → `{payment_id,status,amount_centavos,confirmed_at}`.
- `POST /api/cash-record {shift_id,vehicle_code,amount_centavos}` → `{ride_id,completed}` no payments row.
- `POST /api/ride-checkin {vehicle_code,pickup_text?,pickup_lat?,pickup_lng?}` → `{ride_id,vehicle_code,driver_name_masked,recorded_at}`.
- `GET /api/rides?limit=&cursor=` + `GET /api/rides/:id` (passenger-scoped, cursor pagination).
- `POST /api/lost-item-report {ride_id,category:Phone|Wallet|Bag|Documents|Keys|Other,description≤500}` → `{report_id,submitted}`; `POST /api/lost-item-respond {report_id,response:found|not_found|contact_support}` (driver).
- `GET /api/rewards-me` → `{points_balance,current,threshold:10,history[]}` server truth.
- `POST /api/payment-issue {payment_id?,ride_id?,reason:paid_twice|wrong_amount|deducted_no_confirm|wrong_custom|other,details?}` → `{issue_id,pending}` manual review, no auto-refund.
- `POST /api/shift-start {driver_code,vehicle_code}` 409 active / 403 suspended; `POST /api/shift-end {shift_id}` → summary `{digital_rides,digital_centavos,net_centavos,cash_rides}`.
- `GET /api/fares` → `{fares:[{id,label,amount_centavos,sort_order}]}` seed ₱15/20/25/30/40.
- Admin (role `talaride_admin|lgu_admin|operator`): transactions search (`payment_id|driver_code|vehicle_code|date`), drivers-verify, assign, fares PUT, lost-items queue, analytics `{activation_wau,tx_per_driver_day,digital_pct,success_pct,qr_to_confirm_p50_p95,repeat_30d_pct,checkins,recovery_pct,retention_30_60_90}`.
- Errors `{error}` + `400|401|404|409|429|410`. Rate-limit writes.

## 8. DB (Supabase Postgres, in `supabase/migrations/`)

Extend `profiles(mobile_number UNIQUE,role+=driver|talaride_admin,pin_set)`, `vehicles(vehicle_code UNIQUE,qr_checksum,toda_operator)`, `drivers(user_id UNIQUE,driver_code UNIQUE,verification_status)`. Create `driver_shifts` (partial unique active), `fares`, `rides`, `payments(provider_ref UNIQUE, net_centavos generated, expires_at)`, `payment_events`, `payment_issues`, `lost_item_reports`, `reward_rules(seed min_eligible_centavos=1500,points_per_ride=1,daily_cap=3,threshold=10)`, `rewards_ledger`, `app_notifications`. RLS: revoke anon, scoped authenticated, `service_role` webhooks. Rewards mint iff confirmed + authed passenger + min fare + daily cap + velocity ≤3/day pair.

## 9. Frontend (admin + public)

Tabs: Overview, Vehicles, Drivers, Transactions, Payment Issues, Lost Items, Fares, Compliance, Analytics. Keep existing `Sidebar/Header/StatsCards/VehiclesTable/DriversList/ComplianceView`; add `TransactionsTable` (search), `PaymentIssuesQueue(pending|resolved|refunded)`, `LostItemsQueue(submitted|driver_notified|found|unresolved|closed)`, `FareConfig`, `AnalyticsOverview` (metrics above). Verify/suspend drivers, register/assign/deactivate vehicles, end stale shifts. CSV compliance export kept.

## 10. Offline contract (mobile expects)

Mobile verifies QR sig/expiry offline, queues `checkin|cash_ride|payment_confirm|payment_issue|lost_report` in SQLite outbox, `POST`s on reconnect. APIs must accept delayed sync (idempotent keys `payment_id`/`ride_id`), return last-known status + expiry on `payment-status` when stale.

## 11. Acceptance

`pnpm dev/build/typecheck/lint` clean. Guest sticker → public page. Driver intent → QR → mock-confirm `PAID` <3s. Expired/used QR → 410 + new QR required. Cash/checkin no payments row. Rewards only server-minted with caps. No `service_role` in client bundle (`grep -r SERVICE_ROLE app components lib/supabase-client` empty). Manual refund queue works, no auto-refund.

## 12. Build order

1 env + supabase clients → 2 migrations + seeds → 3 payment-intent/mock-confirm/status/webhook → 4 shifts/fares/cash/checkin/rides → 5 lost/rewards/issues → 6 admin APIs + UI modules → 7 public `/v/[code]` → 8 analytics → 9 acceptance.
