# TalaRide — presentation-readiness audit

Reviewed: 2026-10-08 · Target: `DominceAseberos/TalaRide` · Working branch: `fix/presentation-ready-2026-10-08` (`e66fd9b` plus uncommitted local changes)

## Decision

**Conditional demo readiness, not production sign-off.** The current repository contains the mobile app (Expo/React Native), web portal (React/Vite), Express API, shared code, and Supabase assets. Backend automated tests passed in a local isolated environment. The presenter still needs a preflight of the real deployed services, test accounts, QR checkout, and the exact APK on the demonstration phone. **Do not describe test-mode PayMongo transactions as actual revenue, test vouchers as merchant-redeemable, or local tests as proof of the deployed system.**

## What was verified locally

| Area | Evidence | Honest presentation claim |
| --- | --- | --- |
| Repository identity | `origin` points to `https://github.com/DominceAseberos/TalaRide.git`; distinct from the `beep-anjero` checkout. | This review targets the Domince monorepo. |
| Deployed services | `https://talaride-web-frontend.vercel.app/` returned HTTP 200. The deployed frontend bundle points to `https://talaride-backend.onrender.com/api`; that backend returned HTTP 200 for `/api/health`, `/api/ready`, and `/api/auth/config`. `/api/ready` reported production environment, durable Supabase persistence, demo auth disabled, and mock/test payment simulation enabled. CORS allowed the Vercel origin. | The documented Vercel + canonical Render pair is reachable and configured for a controlled test-mode presentation. This does not verify a complete account/payment walkthrough. |
| Backend | **54/54 tests passed** in offline, read-only-source Docker with private temporary persistence. Coverage includes authentication/role checks, driver/TODA flows, idempotency, payment/webhook paths, reward behavior, cloud compare-and-swap, and guest-session rules. | Backend logic has automated regression coverage; it was not tested against the production database/payment provider. |
| Mobile | **66/66 tests passed** after preloading `tests/setup-test-env.cjs`, which forces `NODE_ENV=test` before React Test Renderer loads. The suite now also covers the ride-details native share flow and its failure state. This confirms the earlier 18 `React.act` failures were test-environment failures rather than mobile regressions. | Mobile automated regressions are green on this checkout; physical-device behavior is still a separate gate. |
| TypeScript + lint | Fresh monorepo `pnpm typecheck` and `pnpm lint` completed successfully for the configured packages. | Static validation is green; it does not validate runtime/device behavior. |
| Builds | Fresh monorepo `pnpm build` completed successfully for the backend, frontend and shared package. Vite emitted only a non-blocking chunk-size warning for the frontend bundle (~554 kB minified JS). | Current source builds successfully on this host; bundle splitting remains optimization debt, not a presentation blocker. |
| Responsive probe | A strict 390px CSS-viewport CDP layout probe reported document width = viewport width and zero overflow elements on the web login and payment-cancel routes. A later screenshot-metrics attempt failed with Chrome `Target does not support metrics override` and is not used as evidence. | No measured horizontal overflow was found on those two probed routes; this is not a full device/browser matrix. |
| Release configuration | The presentation candidate is now **1.2.13**, Android `versionCode` **15**, and the workflow default tag matches `v1.2.13`. This avoids silently rebuilding the already-existing `v1.2.12` tag, which points to older source. The workflow also has a release-tag/version guard and signer check. Local `assetlinks.json` lists the workflow signer and the workflow verifies that invariant. | Source/workflow consistency checked; no APK was built or signed during this audit. Create the `v1.2.13` tag only from the reviewed presentation commit. The updated association file is not live until the frontend is deployed. |
| Existing patch set | Workflow/version guard, isolated backend test storage, truthful onboarding/payment/reward wording, historical-doc labels, Android signer warnings, and a real native **Share Ride** text-share flow in place of the previous future-feature placeholder. The share payload intentionally excludes the saved note and pickup location. | Changes remain **local/uncommitted**. No publish, push, or deployment occurred. |

Automated tests were run without contacting live service endpoints. Backend tests use private temporary persistence, and the mobile suite now runs under an explicit test React environment. These checks still do not prove the deployed Render/Supabase/PayMongo path or a physical APK.

## Presentation blockers and concrete checks

**P0 — Before inviting anyone to scan or pay**

1. **Deployed readiness — backend/web verified, mobile still to confirm:** the Vercel frontend and canonical `talaride-backend.onrender.com` service were reachable on 2026-10-08; `/api/ready` reported durable Supabase readiness and test-mode payment simulation. Confirm the installed mobile build points to that same canonical backend before presenting. Do not paste credentials into a screen share. The stale `mobile/.env.example` hostname was corrected locally.
2. **Real demo path:** using disposable demo accounts and an approved test vehicle, check driver enrollment → approval → assignment → active shift → sticker scan/manual code → guest fare/checkout → *PayMongo test-mode* signed callback → labeled test receipt. Confirm cash flow independently and explain where it differs. Do not charge real money or rely on a production customer account.
3. **Email/login:** verify allowed Supabase callback URLs and actual email confirmation/reset delivery with disposable accounts. A passing unit test does not verify SMTP, mobile deep links, or expired-link recovery on the deployed setup.
4. **Android installation + App Links:** inspect the certificate of the APK already installed on the demo device **before** attempting an update. Current workflow requires `AD:1C:AC:12:00:08:24:5B:12:92:3F:71:74:BF:DB:73:78:BB:46:DF:9E:F3:66:D3:95:E3:5F:91:35:F1:77:EE`; older notes referred to other signers. The deployed Vercel `assetlinks.json` did **not** include the current `AD:1C:...` signer during this audit. Local source now includes it and the Android workflow enforces the match, but the frontend must be redeployed before automatic HTTPS App Link verification can be trusted for a newly signed APK. A differently signed APK cannot update the same package in place; uninstalling may erase offline ride history.

**P1 — Important product gaps; demonstrate only with clear caveats**

5. **Reward truthfulness:** backend distinguishes test and live reward environments; test vouchers cannot be redeemed with actual partner merchants. Do not promise drink, fuel, or fare discounts without confirmed partner activation. Current mobile rewards UI discloses test-only status when `test_mode` is set. The unused legacy `frontend/src/components/commuter/CommuterRewards.tsx` previously included "READY TO USE"/₱20 copy and an artificial 8-point error fallback; the local patch removes those misleading claims, but this unreferenced component is **not an end-to-end verified demo flow**.
6. **Lost items / data model:** mobile community-relay lost-item records in `lost_item_requests` are not fully bridged to canonical API driver/TODA report lists. State clearly which interface receives which report. Check storage/Edge Function migrations and actual row-level access separately on a safe nonproduction environment.
7. **Phone-only behavior:** camera permission denied/retry, low-light scanning and OCR, offline SQLite ride persistence, reconnect queue, notifications, foreground/background transitions, Android update flow, and screen-size/keyboard behavior still need physical-device evidence. iOS behavior remains unverified without an iPhone.
8. **Business onboarding:** confirm one actual test TODA organization, an approved driver, vehicle assignment, and the appropriate portal permissions. Source-level role handling/tests do not establish the correctness of live accounts or imported records.

**P2 — Engineering/release follow-up**

9. **Automated source gate completed:** fresh monorepo typecheck, lint, tests and configured builds pass. Keep the React test preload in place; React Test Renderer still prints deprecation notices, which are maintenance noise rather than current test failures.
10. The frontend production bundle builds but emits a chunk-size warning (~554 kB minified JS). Code splitting can be handled after the presentation unless load testing on the actual venue/network shows it is materially slow.
11. Create `v1.2.13` only from the final reviewed presentation commit, then build that tag. The existing `v1.2.12` tag points to older source and must not be reused for these fixes. Confirm APK package name `com.beepanjero.talaride` is intentionally retained for upgrade compatibility; compare installed version/signature with candidate, not merely the workflow expectation.
12. iOS universal-link verification remains incomplete: `mobile/app.json` declares the Vercel associated domain, but the deployed `/.well-known/apple-app-site-association` currently falls back to the SPA HTML and no Apple Team ID is recorded in this repo. The custom `talaride://` fallback may still work, but do not promise universal-link behavior on iPhone until a signed iOS build and AASA file are configured and tested.
13. Perform a separate comprehensive security review for production launch. This presentation audit inspected important authentication/payment boundaries and exercised existing tests, but **does not constitute a complete penetration test or security certification**.

## Suggested presentation runbook (with fallback)

1. **Opening (1 minute):** define TalaRide as a tricycle payment, ride-history, safety and TODA workflow prototype; show current architecture: Expo mobile → Express API/Supabase → React TODA portal, with signed PayMongo *test-mode* checkout.
2. **Commuter (2 minutes):** scan a pre-verified vehicle sticker, show fare and guest checkout; identify test-mode status before any payment screen. If service fails, use an approved screen recording or screenshots clearly labeled as a previous local run.
3. **Driver/TODA (2 minutes):** show approved driver + assigned vehicle, shift and receipt/ride history; avoid demo accounts with real personal data.
4. **Controls (1 minute):** explain role-protected administration, signed provider callbacks, idempotency and local offline queue. Attribute claims to automated/source verification, not an unperformed live penetration test.
5. **Limits/roadmap (1 minute):** highlight physical-device QA, live integration/merchant agreements, relay-to-portal bridging and Android signer migration as open items.

**Bring:** a compatible, preinstalled APK with checked certificate; stable power/connectivity; two safe test identities; printed/onscreen approved QR; web portal + API readiness checked immediately before presenting; screenshots/recording as contingency. Never reinstall a tester's existing APK during the presentation to overcome a signer mismatch.

## Source references

- `docs/production-readiness-2026-10-06.md` — deployment, onboarding, webhook, email and integration conditions (dated snapshot).
- `docs/phase-10-qa.md` — physical-device/OS-specific QA matrix.
- `docs/app-updates.md` — current update and signer caveats.
- `backend/tests/`, `mobile/tests/` — automated regression coverage; `mobile/node_modules/react-test-renderer/cjs/` — environment-sensitive test renderer export behavior.
- `backend/src/routes/rewards.ts`, `mobile/src/components/RewardsPanel.tsx` — test-only voucher labels; `frontend/src/components/commuter/CommuterRewards.tsx` — unused legacy promotional copy.

**Bottom line:** use a controlled **test-mode** presentation after the P0 checks. Treat all unverified live, hardware and release behaviors as open until a real device/service walkthrough succeeds.
