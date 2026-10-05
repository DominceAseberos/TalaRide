# TalaRide MVP — App Migration Plan (Current → MVP)

Source: MVP spec §§1-43. Repo: `C:\Projects\TalaRide`.
Current: passenger-only local-first recorder + fleet registry mock. No payments, driver mode, server rides, rewards ledger.

## 0. Current inventory

- Mobile `mobile/src/app/`: `index.tsx` splash, `onboarding.tsx`, `sign-in.tsx`, `home.tsx`, `confirm.tsx`, `scan.tsx`, `rides.tsx`, `ride/[id].tsx`, `receipt.tsx`, `activity.tsx`, `report-lost-item.tsx`, `profile.tsx`
- Mobile data: `src/db/rides.ts` SQLite `rides(id, account_id, vehicle_number, identifier_type, ride_datetime, note, location)`. `src/auth/*` email + Supabase session (SecureStore). `src/scan/ocr.ts`, `identifiers.ts`, `draft.ts`. `src/mocks/MockProvider.tsx`. `src/relay/api.ts` → `community-relay` Edge Function.
- Shared `packages/shared/src/`: `types/index.ts` (`Ride, LostRequest, RelayPrompt, Vehicle, Driver, Organization, UserProfile`), `types/database.ts`, `validation/vehicle.ts`, `validation/driver.ts`
- Web `apps/web/`: `app/page.tsx` + `lib/store.ts` localStorage fleet + `lib/mock-data.ts` + `components/*`. `lib/supabase.ts` unused.
- Supabase `supabase/migrations/`: `202609180001_profiles.sql`, `20260920*_community_relay|notifications|security_retention.sql`, `20260922*_relay_response_consistency.sql`, `20260928*_fleet_management.sql` (`organizations, vehicles, drivers`). Functions: `community-relay/index.ts`, `account-profile/index.ts`.

## 1. Gap matrix (MVP § → delta)

| MVP                                                    | Current                                      | Action                                                                                                              |
| ------------------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| §3 OTP+PIN/biometric, `DR-000481`                      | email/password only, uuid drivers            | add OTP auth, `driver_code`, PIN/biometric unlock                                                                   |
| §4 select tricycle + `START SHIFT`                     | static `drivers.vehicle_id` assignment       | new `driver_shifts` + driver vehicle picker                                                                         |
| §5-7 fare buttons + custom + `REQUEST PAYMENT`         | no fares, no QR                              | new `fares` table + driver fare UI + QR screen                                                                      |
| §8 guest QR Ph pay (GCash/Maya/GoTyme/bank)            | no payments                                  | provider-abstracted QR + webhook confirm                                                                            |
| §9 app `SCAN RIDE → Confirm → RIDE PAID`               | OCR scan → local save only                   | QR decode → server ride+payment intent → provider → confirm                                                         |
| §10 cash record                                        | local note only                              | `CASH` path + optional server check-in                                                                              |
| §11 permanent sticker `TR-01842 / Scan to record`      | OCR of body number                           | static vehicle QR + `SAVE RIDE` check-in                                                                            |
| §12-13 History/Details + Report actions                | local SQLite history                         | server `rides+payments` synced history, keep SQLite as offline cache                                                |
| §14 lost-item driver `FOUND/NOT FOUND`                 | anonymous community relay (`vehicle_digest`) | keep relay, add direct `lost_item_reports` → driver + support mediation                                             |
| §15-16 rewards `1 TalaPoint/digital ride` + anti-fraud | none                                         | `rewards_ledger` + rules, server-minted only                                                                        |
| §17-20 driver totals/fees/pending/paid/fail/offline    | none                                         | driver history + realtime payment status + offline cash fallback                                                    |
| §21 `REPORT PAYMENT PROBLEM` manual review             | none                                         | `payment_issues` queue, no auto-refund                                                                              |
| §22-23 commuter/driver home                            | passenger home only                          | rebuild both homes, add driver mode switch                                                                          |
| §24 admin transactions/lost-items/fares/analytics      | fleet-only mock                              | replace `store.ts` with Supabase + new admin modules                                                                |
| §25 DB objects                                         | 4/10 exist                                   | add `driver_shifts, fares, rides, payments, lost_item_reports, rewards_ledger` + extend `drivers/vehicles/profiles` |
| §26-28 notifications/security/privacy                  | relay push only                              | scoped push templates, no credential storage, QR expiry, explicit shift                                             |
| §29-38 disclaimers                                     | none                                         | legal strings + consent screens (see backend-contract §11)                                                          |

§40 out-of-scope stays out: booking, dispatch, matching, nav, ratings, live GPS, chat, social, delivery, loans, insurance, ads, subscriptions, tiers, bidding, surge, nearby map.

## 2. Binding decisions

1. **One Expo app, two modes:** `passenger` (default) + `driver` (role-gated). No separate binary for MVP. `src/app/(passenger)/*`, `src/app/(driver)/*` via route groups; update `src/app/_layout.tsx` guard + `useAuth().role` checks.
2. **IDs:** keep `uuid PK id` internally. Add human codes: `drivers.driver_code TEXT UNIQUE 'DR-000481'`, `vehicles.vehicle_code TEXT UNIQUE 'TR-01842'`. QR + UI show codes only. See backend-contract §2.
3. **Money:** integer centavos `amount_centavos INT` (`₱30 = 3000`). Display `₱` via `formatCentavos()`. Never float.
4. **QR split:** (a) payment QR = provider-issued QR Ph bytes/URL, short-lived; (b) vehicle sticker QR = static `${EXPO_PUBLIC_VEHICLE_QR_BASE}/TR-01842?c=<checksum>` (default `https://talaride.ph/v`, configurable) encoding `vehicle_code` only. Never embed fare in sticker.
5. **Payments:** abstract provider behind `payments.provider` + Edge Functions `payment-intent`, `payment-webhook`. MVP integrates 1 QR Ph acquirer (Xendit/PayMongo/Dragonpay — pick one); GCash/Maya/GoTyme/banks are payer-side apps, not separate integrations.
6. **Server truth:** `paid` only on webhook → `payments.status=confirmed`. Client screenshots never accepted.
7. **Offline:** cash + check-in queue in SQLite, sync on reconnect. Payment `WAITING` never resolves offline.

## 3. Phased implementation

### Phase 0 — Shared + DB foundation (unblocks all)

- Extend `@talaride/shared`: `types/payments.ts`, `types/rides.ts`, `types/shifts.ts`, `types/rewards.ts`, `types/lost-items.ts`, `types/fares.ts`; `validation/fare.ts`, `validation/payment.ts`; `qr.ts` (`buildVehicleQrUrl()`, `parseVehicleQr()`), `money.ts` (`formatCentavos()`).
- Supabase migrations in order: `profiles.role+=driver,talaride_admin` + `mobile_number UNIQUE + pin_set`, `vehicles.vehicle_code UNIQUE + toda_operator fields`, `drivers.driver_code UNIQUE + user_id + verification_status`, new `driver_shifts, fares, rides, payments, payment_issues, lost_item_reports, rewards_ledger` (schemas: backend-contract §4).
- Backfill: existing `vehicles→vehicle_code` (`TR-#####`), `drivers→driver_code` (`DR-######`).

### Phase 1 — Auth (§3, §27-28)

- Replace email with OTP: `supabase.auth.signInWithOtp({phone})` + verify. Keep email fallback for admin.
- Files: `src/auth/client.ts` (add phone OTP helpers), new `src/auth/pin.ts` (SecureStore PIN + `expo-local-authentication` biometric — add dep), `src/app/sign-in.tsx` → phone+OTP, `src/app/(driver)/login.tsx` shared.
- `profiles`: `mobile_number, display_name, role, organization_id`.

### Phase 2 — Driver shift + fares (§4-7, §23)

- New routes: `(driver)/vehicle-select.tsx`, `(driver)/home.tsx` (TR-01842 header + fare grid ₱15/20/25/30/40/CUSTOM + DIGITAL/CASH), `(driver)/custom-fare.tsx`, `(driver)/payment-qr.tsx`, `(driver)/payment-status.tsx`, `(driver)/history.tsx`, `(driver)/lost-items.tsx`, `(driver)/account.tsx`.
- State: `src/driver/shift.ts` (`startShift(driver_code, vehicle_code)`, `endShift()`), `src/driver/fare.ts` (admin `fares` fetch + custom validate 100–99990000 centavos = ₱1–₱999900).
- Admin fare config feeds buttons; `CUSTOM` requires confirm screen showing `Special Fare ₱120 / Confirm?`.

### Phase 3 — Payments (§8-10, §18-20)

- `payment-intent` Edge Function: input `{shift_id, vehicle_code, amount_centavos, payment_method:"digital"}` → output `{payment_id, ride_id, amount_centavos, qr_payload, expires_at}`. Server creates `ride_id`. QR expiry 5 min (configurable).
- Driver `payment-qr.tsx`: show provider QR + `WAITING FOR PAYMENT ₱30`; poll/subscribe `payments.status`; on `confirmed` → `✓ PAID` + vibrate + sound (`expo-haptics`, `expo-av` — add deps).
- Guest flow needs zero app change (payer uses GCash/Maya/bank). Commuter-app flow: `SCAN RIDE` → decode vehicle QR or payment QR → `ride-confirm.tsx` (`TR-01842, Driver Juan D., Fare ₱30, Confirm?`) → deep-link provider checkout → `payment-status.tsx` → `✓ RIDE PAID` + save.
- Cash: `recordCashRide()` → `rides(method=cash, status=completed)` + optional passenger check-in link.
- Failures: `TRY AGAIN / GENERATE NEW QR / PAY CASH`. Offline: `Unable to connect → PAY CASH`.

### Phase 4 — Commuter home/history/check-in (§11-13, §22)

- Rebuild `home.tsx`: `SCAN RIDE` hero + Recent ride + `Rewards 8/10`. Nav: `Home|History|Rewards|Account` (`BottomNav.tsx` update).
- `scan-ride.tsx`: QR scanner (`expo-camera` barcode, not OCR) → `parseVehicleQr()` → fetch `vehicles+current shift/driver` → `Record? SAVE RIDE` (cash) or `Confirm?` (digital).
- Keep OCR scan as fallback entry for legacy body numbers.
- `rides.tsx` + `ride/[id].tsx`: switch source from SQLite-only to server `rides+payments` (SQLite remains offline mirror: add `server_id, sync_status, payment_method, amount_centavos` columns, migration v2).
- `receipt.tsx`: show disclaimers (§29-38 short versions + link full).

### Phase 5 — Lost items (§14)

- Keep `community-relay` for anonymous matching; add `lost_item_reports` direct path: `History → REPORT LOST ITEM → category[Phone|Wallet|Bag|Documents|Keys|Other] + description → SUBMIT`.
- Driver receives push `LOST ITEM REPORT 8:42 PM ride` → `I FOUND IT / I DID NOT FIND IT / CONTACT SUPPORT`. No phone exposure; support mediates.
- Admin queue: `submitted|driver_notified|found|unresolved|closed`.

### Phase 6 — Rewards (§15-16)

- Server-only mint in `payment-webhook` after `confirmed`: 1 pt if `eligible=true` (checks: authenticated passenger, not refunded, `amount_centavos >= min_eligible`, daily cap, duplicate driver/rider velocity).
- Commuter `rewards.tsx`: `8/10 rides → reward`. No client-side point calc.
- Rules table `reward_rules(key,value)` editable by admin; no hardcoded peso logic in client.

### Phase 7 — Admin web (§24, §41, target `talaride-web/` per 3-tier split)

- Delete `apps/web/lib/store.ts` localStorage + `mock-data.ts` seed path; keep `lib/supabase.ts` (anon, client) + add `lib/supabase-server.ts` (service_role, server components/route handlers only, never client) wired to real tables.
- Keep `Sidebar/StatsCards/VehiclesTable/DriversList/ComplianceView`; add modules: `TransactionsTable` (search by `payment_id|driver_code|vehicle_code|date`), `PaymentIssuesQueue`, `LostItemsQueue`, `FareConfig`, `AnalyticsOverview` (activation, tx/driver/day, digital %, success %, QR-to-confirm latency, guest→install, 30d repeat, check-ins, recovery rate, retention 30/60/90).
- Driver verify/suspend, vehicle register/assign/deactivate, shift override (end stale shifts).

### Phase 8 — Hardening + legal (§26-39)

- Push templates only: `payment_success, reward_earned, lost_item_update, payment_received, assignment_notice`. No marketing pushes.
- Location permission `Allow|Not Now`, approximate pickup only; privacy notice + consent log.
- Disclaimer strings component `src/components/Disclaimers.tsx` shown at pay/registration (backend-contract §11 full text keys).
- Analytics events: `qr_generated, payment_confirmed, check_in_saved, reward_issued` with latency timings.

## 4. File ops summary

Create: `src/app/(driver)/*` (7 files), `src/app/scan-ride.tsx`, `ride-confirm.tsx`, `payment-status.tsx`, `rewards.tsx`, `src/driver/*`, `src/payments/*`, `src/components/Disclaimers.tsx`, `packages/shared/src/{types,validation}/payments|rides|shifts|rewards|fares.ts`, `qr.ts`, `money.ts`, supabase `20*_{shifts,fares,rides,payments,lost_reports,rewards}.sql`, functions `payment-intent|payment-webhook|driver-shift|lost-item-notify|rewards-evaluate`.
Modify: `sign-in.tsx`, `home.tsx`, `scan.tsx` (add barcode mode), `rides.tsx`, `ride/[id].tsx`, `receipt.tsx`, `report-lost-item.tsx`, `BottomNav.tsx`, `db/rides.ts` (v2 cols), `auth/*`, `relay/api.ts` (keep), `apps/web/*` (store→Supabase + 4 new modules).
Delete: `apps/web/lib/mock-data.ts` seed usage, `src/mocks/MockProvider.tsx` production path.

## 5. Test gates per phase

OTP login, shift start/end isolation, custom-fare confirm, QR expiry, guest pay → driver `PAID` <15s p95 LAN, cash fallback offline, check-in without payment, refund flag blocks rewards, fraud caps (min fare, daily limit, duplicate velocity), RLS (driver sees own shifts/payments; passenger sees own rides; admin scoped).

## 6. Metrics (§41)

Track in `AnalyticsOverview`: weekly active drivers, tx/active-driver/day, digital %, intent→confirmed %, QR→confirm seconds, guest→install %, 30d repeat %, voluntary check-ins, lost reports + recovery %, driver retention 30/60/90.
