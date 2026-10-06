# TalaRide v1.2.6

Android package: `com.beepanjero.talaride`

Android version code: `8`

Runtime version: `1.2.6`

Includes admin approval before opening the driver dashboard, separate TODA member assignment, automatic status/group refresh and account-scoped offline caching. Includes the new green tricycle onboarding artwork, updated fare/driver details, and corrected sign-out/loading artwork.

The mobile app connects to the canonical production backend and Supabase project with demo mode disabled. The backend deliberately keeps the PayMongo test gateway; this release does not enable real-money payments or voucher redemption.

The APK must verify with signer SHA-256 `e714879093db3a6e245d492278adb36748a0ef695a62784bd01466c030c914d8`. Verify the finished APK's package, version, architecture, environment and checksum before publishing. Install this update over the previous APK to preserve local data; do not uninstall first.
