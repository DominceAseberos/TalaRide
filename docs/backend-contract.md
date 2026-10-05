# TalaRide MVP — Backend Contract (v2, implemented)

Companion to `docs/mvp-migration-plan.md`. Single source for table/column/API/variable names. TS `camelCase` ↔ DB/API `snake_case`. Money = integer centavos. Time = `timestamptz` ISO-8601 UTC. IDs: internal `uuid id`; human `driver_code 'DR-000481'`, `vehicle_code 'TR-01842'`.

Implemented in app: dynamic mock QR + offline queue work with zero backend deploy. Live provider swaps Edge only.

## 0. Stack (suitable, offline-capable)

- Mobile: Expo SDK 57, React 19, RN 0.86, expo-router, `expo-camera` (QR barcode scan, offline), `react-native-svg` + `qrcode-generator` (QR render, pure JS, offline), `expo-crypto` (uuid + SHA256 mock sign, offline), `expo-sqlite` + AsyncStorage (rides + `outbox`, offline), `@supabase/supabase-js` (sync/realtime when online).
- No new native modules. No `expo-network` required: offline = try-online-then-queue + manual retry. QR decode/verify fully offline.
- Shared: `@talaride/shared` `qr.ts` (`buildVehicleQrUrl`, `parseVehicleQr`, `parseDynamicQr`, `isDynamicQrExpired`, `dynamicIntentString`), `money.ts` (`formatCentavos`, `parsePesoToCentavos`), `types/payments.ts`, `validation/payment.ts`.
- Backend: Supabase Postgres + Edge Functions (`payment-intent`, `payment-webhook`, `mock-confirm` demo only, `driver-shift-*`, `ride-checkin`, `cash-record`, `lost-item-*`, `rewards-me`, `payment-issue`, `admin-*`). Realtime `postgres_changes` on `payments:id`.
- Modes: `EXPO_PUBLIC_PAYMENT_MODE=mock|live`. Mock: `provider='mock'`, client-signed SHA256, `mock-confirm` acts as webhook. Live: provider-issued QR Ph, HMAC webhook, mock routes disabled.

## 1. Conventions

| Layer        | Rule                                                                               | Example                                 |
| ------------ | ---------------------------------------------------------------------------------- | --------------------------------------- |
| DB columns   | `snake_case`, PK `id uuid DEFAULT gen_random_uuid()`                               | `amount_centavos`                       |
| TS types     | `camelCase` (`@talaride/shared`)                                                   | `amountCentavos`                        |
| API JSON     | `snake_case` (matches DB)                                                          | `{"amount_centavos":3000}`              |
| Money        | `INT` centavos 100–99990000 (₱1–₱999,900), never float                             | `₱30 → 3000`                            |
| Phone        | E.164 `+63...` in `profiles.mobile_number UNIQUE`                                  | `+639175521928`                         |
| Codes        | `drivers.driver_code UNIQUE 'DR-\d{6}'`, `vehicles.vehicle_code UNIQUE 'TR-\d{5}'` | `DR-000481, TR-01842`                   |
| Static QR    | vehicle identity only, no fare, no expiry                                          | `https://talaride.ph/v/TR-01842?c=ab12` |
| Dynamic QR   | per-intent, single-use, `expires_at=now()+300s`, signed                            | `{"v":1,"payment_id":...,"sig":...}`    |
| Status truth | only `payments.status=confirmed` via webhook/mock-confirm = paid                   | screenshots invalid                     |

Canonical map: `vehicleCode↔vehicle_code`, `driverCode↔driver_code`, `amountCentavos↔amount_centavos`, `paymentMethod↔payment_method`, `shiftId↔shift_id`, `rideId↔ride_id`, `providerRef↔provider_ref`, `providerFeeCentavos↔provider_fee_centavos`, `talarideFeeCentavos↔talaride_fee_centavos`, `netCentavos↔net_centavos (generated)`, `points↔points`.

## 2. Enums

`role: passenger|driver|operator|lgu_admin|talaride_admin`
`driver.verification_status: pending|verified|suspended`
`vehicle.status: active|suspended|for_renewal` (deactivation = `suspended`)
`shift.status: active|ended|expired`
`ride.payment_method: digital|cash` `ride.status: pending|completed|cancelled`
`payment.status: initiated|awaiting_confirmation|confirmed|failed|expired|refunded|reversed`
`payment.provider: mock|qrph_acquirer`
`payment_issue.status: pending|resolved|refunded`
`lost_item.status: submitted|driver_notified|found|unresolved|closed`
`lost_item.category: Phone|Wallet|Bag|Documents|Keys|Other`
`rewards_ledger.status: earned|revoked|redeemed|expired`
`app_notification.kind: payment_success|reward_earned|lost_item_update|payment_received|assignment_notice`
`outbox.kind (client SQLite only): checkin|cash_ride|payment_confirm|payment_issue|lost_report`

## 3. Existing tables (extend)

`profiles += mobile_number TEXT UNIQUE, role += 'driver','talaride_admin', pin_set BOOLEAN DEFAULT false`
`vehicles += vehicle_code TEXT UNIQUE NOT NULL, toda_operator TEXT, qr_checksum TEXT NOT NULL` (checksum = HMAC stub `ab12…`; client accepts `[a-f0-9]{4,16}`)
`drivers += user_id UUID UNIQUE→auth.users, driver_code TEXT UNIQUE NOT NULL, verification_status, toda_operator TEXT`
Keep `organizations` + relay tables (`lost_item_requests, relay_matches, relay_notifications, push_tokens`) legacy.

## 4. New tables (deploy order)

```sql
driver_shifts(id uuid PK, driver_id uuid→drivers NOT NULL, vehicle_id uuid→vehicles NOT NULL,
  organization_id uuid NULL, status TEXT DEFAULT 'active',
  started_at timestamptz DEFAULT now(), ended_at timestamptz NULL);
CREATE UNIQUE INDEX one_active_shift ON driver_shifts(driver_id) WHERE status='active';

fares(id uuid PK, organization_id uuid NULL, municipality TEXT NULL, label TEXT NOT NULL,
  amount_centavos INT NOT NULL CHECK (amount_centavos BETWEEN 100 AND 99990000),
  sort_order INT DEFAULT 0, is_active BOOLEAN DEFAULT true);

rides(id uuid PK, driver_id uuid→drivers NOT NULL, vehicle_id uuid→vehicles NOT NULL,
  shift_id uuid→driver_shifts NULL, passenger_id uuid→profiles NULL,
  amount_centavos INT NOT NULL CHECK (amount_centavos BETWEEN 100 AND 99990000),
  payment_method TEXT NOT NULL, status TEXT DEFAULT 'pending',
  pickup_text TEXT NULL, pickup_lat DOUBLE NULL, pickup_lng DOUBLE NULL,
  created_at timestamptz DEFAULT now(), completed_at timestamptz NULL);

payments(id uuid PK, ride_id uuid UNIQUE→rides NOT NULL, shift_id uuid NULL,
  amount_centavos INT NOT NULL, provider TEXT NOT NULL DEFAULT 'mock',
  provider_ref TEXT UNIQUE NULL, qr_payload TEXT NULL,
  status TEXT DEFAULT 'awaiting_confirmation',
  provider_fee_centavos INT DEFAULT 0, talaride_fee_centavos INT DEFAULT 0,
  net_centavos INT GENERATED ALWAYS AS (amount_centavos - provider_fee_centavos - talaride_fee_centavos) STORED,
  expires_at timestamptz NOT NULL, confirmed_at timestamptz NULL, created_at timestamptz DEFAULT now());
payment_events(id uuid PK, payment_id uuid→payments NOT NULL, event TEXT NOT NULL,
  payload JSONB DEFAULT '{}', created_at timestamptz DEFAULT now());

payment_issues(id uuid PK, payment_id uuid→payments NULL, ride_id uuid→rides NULL,
  reporter_id uuid→profiles NULL, reason TEXT NOT NULL, details TEXT DEFAULT '',
  status TEXT DEFAULT 'pending', created_at timestamptz DEFAULT now());

lost_item_reports(id uuid PK, ride_id uuid→rides NOT NULL, reporter_id uuid→profiles NULL,
  driver_id uuid→drivers NOT NULL, category TEXT NOT NULL, description TEXT NOT NULL,
  status TEXT DEFAULT 'submitted', driver_response TEXT NULL, created_at timestamptz DEFAULT now());

reward_rules(key TEXT PK, value TEXT NOT NULL);
rewards_ledger(id uuid PK, user_id uuid→profiles NOT NULL, ride_id uuid UNIQUE→rides NOT NULL,
  payment_id uuid→payments NOT NULL, points INT DEFAULT 1, status TEXT DEFAULT 'earned',
  created_at timestamptz DEFAULT now());

app_notifications(id uuid PK, user_id uuid→profiles NOT NULL, kind TEXT NOT NULL,
  title TEXT NOT NULL, body TEXT NOT NULL, data JSONB DEFAULT '{}',
  is_read BOOLEAN DEFAULT false, created_at timestamptz DEFAULT now());
```

Client offline mirror (SQLite `talaride.db`, no server): `rides(...)` existing + `outbox(id, kind, payload, created_at, attempts, last_error)` in `mobile/src/offline/queue.ts`. Flush order: `checkin, cash_ride, payment_confirm, payment_issue, lost_report`.

Seed `reward_rules`: `min_eligible_centavos=1500, points_per_ride=1, daily_cap=3, reward_threshold=10`. Seed `fares`: ₱15/20/25/30/40.

## 5. RLS summary

Enable RLS new tables; revoke `anon`; grant scoped `authenticated`. Driver: own shifts/rides/payments via `my_driver_id()`. Passenger: own rides (`passenger_id=auth.uid()`), own ledger/notifications, insert own reports/issues. `fares`: authenticated read `is_active`. Admin helpers `is_admin()`. Webhooks `service_role` only.

## 6. APIs (all)

Base `https://<project>.supabase.co/functions/v1/<name>`, `Authorization: Bearer <jwt>` except webhook (HMAC) and static vehicle web page (public). Errors `{error}` + `400|401|404|409|429|410`.

| #    | Method + route                                                                                                                                                                                    | Req                                                                                                            | Res                                                                                                                                                          | Offline                                            |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------- |
| 6.1  | `POST /auth-otp-request`                                                                                                                                                                          | `{mobile_number}`                                                                                              | `{sent:true}`                                                                                                                                                | online only                                        |
| 6.2  | `POST /auth-otp-verify`                                                                                                                                                                           | `{mobile_number, otp}`                                                                                         | `{access_token, refresh_token, user:{id, role}}`                                                                                                             | online only                                        |
| 6.3  | `POST /driver-shift-start`                                                                                                                                                                        | `{driver_code, vehicle_code}`                                                                                  | `{shift_id, driver_id, vehicle_id, started_at}` 409 active, 403 suspended                                                                                    | online; stale shift ended server-side              |
| 6.4  | `POST /driver-shift-end`                                                                                                                                                                          | `{shift_id}`                                                                                                   | `{shift_id, status:"ended", summary:{digital_rides, digital_centavos, net_centavos, cash_rides}}`                                                            | queue end, show local totals                       |
| 6.5  | `GET /fares?organization_id=&municipality=`                                                                                                                                                       | —                                                                                                              | `{fares:[{id,label,amount_centavos,sort_order}]}`                                                                                                            | cached `DEFAULT_FARES`, refresh when online        |
| 6.6  | `POST /payment-intent`                                                                                                                                                                            | `{shift_id, vehicle_code, amount_centavos, payment_method:"digital"}`                                          | `201 {payment_id, ride_id, amount_centavos, qr_payload, expires_at}` creates `rides(pending)+payments(awaiting_confirmation)`                                | online; offline → cash/checkin only                |
| 6.7  | `POST /mock-confirm` (demo only, disabled live)                                                                                                                                                   | `{payment_id}`                                                                                                 | `{payment_id, status:"confirmed"}` idempotent, rejects expired/used                                                                                          | works offline same-device; cross-device queues     |
| 6.8  | `POST /payment-webhook` (provider, HMAC `x-provider-signature`)                                                                                                                                   | `{provider_ref, provider_status:PAID\|FAILED\|EXPIRED, amount_centavos}`                                       | marks `confirmed/failed/expired`, mints rewards if eligible, notifies                                                                                        | online only                                        |
| 6.9  | `GET /payment-status?payment_id=`                                                                                                                                                                 | —                                                                                                              | `{payment_id, status, amount_centavos, confirmed_at}` + realtime `payments:id`                                                                               | poll 2s; offline returns last-known + expiry check |
| 6.10 | `POST /cash-record`                                                                                                                                                                               | `{shift_id, vehicle_code, amount_centavos}`                                                                    | `{ride_id, status:"completed"}` no `payments` row                                                                                                            | queue `cash_ride`, instant local receipt           |
| 6.11 | `POST /ride-checkin`                                                                                                                                                                              | `{vehicle_code, pickup_text?, pickup_lat?, pickup_lng?}`                                                       | `{ride_id, vehicle_code, driver_name_masked, recorded_at}`                                                                                                   | queue `checkin`, instant local save                |
| 6.12 | `GET /rides?limit=&cursor=` / `GET /rides/:id`                                                                                                                                                    | —                                                                                                              | `{rides:[{ride_id, vehicle_code, driver_code, driver_name_masked, date, amount_centavos, payment_method, status}], next_cursor}`                             | local SQLite first, server merge when online       |
| 6.13 | `POST /lost-item-report`                                                                                                                                                                          | `{ride_id, category, description}`                                                                             | `{report_id, status:"submitted"}` notifies driver                                                                                                            | queue `lost_report`                                |
| 6.14 | `POST /lost-item-respond` (driver)                                                                                                                                                                | `{report_id, response:found\|not_found\|contact_support}`                                                      | `{report_id, status:found\|unresolved}` notifies passenger                                                                                                   | queue, sync later                                  |
| 6.15 | `GET /rewards-me`                                                                                                                                                                                 | —                                                                                                              | `{points_balance, current, threshold, history:[{ride_id, points, status}]}`                                                                                  | cached, server truth when online                   |
| 6.16 | `POST /payment-issue`                                                                                                                                                                             | `{payment_id?, ride_id?, reason:paid_twice\|wrong_amount\|deducted_no_confirm\|wrong_custom\|other, details?}` | `{issue_id, status:"pending"}`                                                                                                                               | queue `payment_issue`                              |
| 6.17 | Admin `GET /admin-transactions?payment_id=&driver_code=&vehicle_code=&date=` `POST /admin-drivers-verify` `POST /admin-assign` `POST /admin-fares` `GET /admin-lost-items` `GET /admin-analytics` | role-gated                                                                                                     | analytics `{activation_wau, tx_per_driver_day, digital_pct, success_pct, qr_to_confirm_p50_p95, repeat_30d_pct, checkins, recovery_pct, retention_30_60_90}` | online only                                        |

Dynamic QR payload (mock + live same fields): `{"v":1,"payment_id","ride_id","vehicle_code","amount_centavos","expires_at","nonce","sig"}`. Verify: shape → expiry → sig (`mock`: SHA256(intent+secret) in `src/payments/mock.ts`; live: HMAC in Edge).

## 7. Realtime + push

Channels `payments:{payment_id}`, `shifts:{driver_id}`, `lost_reports:{user_id}`. Push kinds in `app_notifications`. Templates only: `✓ PAYMENT RECEIVED ₱30`, `LOST ITEM REPORT`, `Assignment: TR-01842`.

## 8. Webhook + idempotency

HMAC-SHA256 raw body with `PAYMENT_WEBHOOK_SECRET`, `provider_ref UNIQUE`, amount cross-check vs `payments.amount_centavos` (mismatch → `payment_issue` + hold). Mock idempotent on `payment_id`.

## 9. Rewards eligibility (webhook tx)

Mint iff `confirmed` + `passenger_id NOT NULL` + `amount>=min_eligible` + `today<count daily_cap` + no refund + velocity ≤3/day same pair. Else `payment_events(reward_skipped)`.

## 10. Env

Client (`EXPO_PUBLIC_*`): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_VEHICLE_QR_BASE=https://talaride.ph/v`, `EXPO_PUBLIC_QR_EXPIRY_SEC=300`, `EXPO_PUBLIC_PAYMENT_MODE=mock`.
Server secrets: `SUPABASE_SERVICE_ROLE_KEY`, `PAYMENT_PROVIDER_KEY`, `PAYMENT_WEBHOOK_SECRET`, `QR_INTENT_SECRET`, `RELAY_MATCH_SECRET`, `EXPO_ACCESS_TOKEN`.

## 11. Migration order + acceptance

1 profiles/drivers/vehicles extends (nullable → backfill `TR-#####`/`DR-######` → NOT NULL) → 2 shifts+fares → 3 rides+payments+events → 4 issues → 5 lost_reports → 6 rewards+app_notifications → 7 RLS → 8 functions → 9 seeds.
Accept: dynamic QR single-use + 300s expiry; mock paid <3s same-device; offline scan/checkin/cash instant, syncs on reconnect; only webhook/mock-confirm marks paid; rewards server-minted with caps; driver sees fare vs net.
