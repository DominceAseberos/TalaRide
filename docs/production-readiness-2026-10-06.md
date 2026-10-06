# Production preparation — 6 October 2026

Status: the user manually applied the backend storage SQL and returned all four verification checks as true. Deployment of the prepared account/QR update is authorized and in progress. The broader product is not yet fully production-ready; remaining integration is listed below.

## Implemented in this snapshot

- Real Supabase email authentication replaces browser-only TODA passwords and mobile demo sessions. Signup cannot grant an administrator role. Driver enrollment belongs to the authenticated account and remains pending until verified.
- The web root is the TODA login. `/driver` provides registration and the driver's assigned vehicle QR. Guest fare pages are reached through signed `/v/:code` links; there is no web camera-scanner landing page.
- Removed the public test-QR page and reachable demo portal/simulator flows. Mobile accepts registered vehicle stickers and authenticated manual lookup. Legacy demo payment confirmation is rejected outside tests, even if payment configuration is accidentally set to mock.
- Web and Android QR exports include the readable vehicle code. A locally downloaded 1000×1220 web PNG was decoded successfully; its temporary verification fixture and image were removed. Android device export has not been exercised on a physical device.
- Guest payment sessions require both a random session ID and a per-tab browser owner secret. They expire after ten minutes, reserve against concurrent checkout requests, and are consumed after checkout creation. Server restart invalidates unconsumed guest sessions. The physical sticker remains reusable; these controls cannot prove someone physically scanned rather than copied the permanent sticker URL.
- Production API state uses the service-role-only Supabase table in migration `202610060003_backend_state.sql`, with compare-and-swap revisions. Database failures do not fall back to ephemeral JSON. Ride/payment/event creation commits together. Production starts with no seeded fleet records.
- Private driver, ride, report, reward and administration access requires authentication. Confirmed status still comes only from the payment provider. Unimplemented promotional-voucher redemption is disabled in production.

## Deployment blockers and remaining integration

1. DOMS_MCP Supabase management requests for project `icqxcfmhawqxufvlifdv` return **401 Unauthorized**. Restore that connection before applying migrations or deploying Edge Functions. Never paste service-role or management tokens into chat.
2. Apply the repository's pending migrations in order, including optional profile/lost-item image migrations and `202610060003_backend_state.sql`. Verify on the real database. The new storage table does not import prior JSON demo data or existing relational fleet tables automatically. Any real historical records need a reviewed migration before switching.
3. Configure the existing Render service `srv-db23ot67bikc73cb8uc0`, not a new service. Required settings include `NODE_ENV=production`, `DEMO_AUTH=false`, `PAYMENT_MODE=live`, `SUPABASE_URL`, service-role key, **SUPABASE_PUBLISHABLE_KEY**, strong QR secret, live provider key, webhook secret, and the existing Vercel origin. `/api/ready` must verify durable storage; `/api/health` alone does not prove readiness.
4. Real TODA organization membership and organization-scoped dashboard access remain to be integrated. This snapshot allows only explicitly approved global `talaride_admin`/`lgu_admin` accounts to use the administration dashboard. A requested operator role in signup metadata does not grant access.
5. Existing mobile community-relay reports live in `lost_item_requests`, separately from canonical API reports. They are **not yet connected to the driver/TODA report lists**. Deploying the optional image migration alone does not complete that bridge. Profile photos also need verification across both profile and driver records.
6. Verify the real driver-enroll → approve → assign vehicle → start shift → scan/manual code → live checkout → signed webhook → receipt flow. No real payment was charged during local checks. Confirm merchant/payout behavior with the actual configured provider before real driver use.
7. Expo/EAS CLI currently reports not logged in. Authenticate or use the verified local Android release setup, bump the application version/code, build and verify the APK signer against the required `e7148790...c914d8` fingerprint. No APK was built, uploaded, or published for this snapshot.

## Validation

Final `pnpm check` passed: repository type checking, frontend/mobile lint, 39 backend tests, 52 mobile tests, and configured frontend/backend/shared builds. The mobile production environment verification also passed. This does not build an Android APK. Backend tests cover demo-token rejection, signup privilege escalation, authenticated manual lookup, session ownership/reservation/expiry, and payment workflows. Mobile tests include PostgreSQL validation of the new storage migration's client-access restrictions and stale-write rejection. Final verification results should be recorded alongside the resulting commit.

Production startup now validates database table access, the commit RPC and required configuration before opening its port. A failed startup must be corrected through the existing Render service environment; do not weaken database grants or re-enable demo access. Remaining product integration is not represented as complete by deploying this account/QR update.
