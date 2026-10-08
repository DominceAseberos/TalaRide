# TalaRide v1.2.7

> Historical release notes. The current Android workflow (2026-10-08) expects a
> different signer (`AD:1C:AC:12:...:77:EE`); the fingerprint below is the
> requirement recorded for this older release, not for new builds. Confirm
> actual installed/build APK signatures before attempting any upgrade.

Android package: `com.beepanjero.talaride`

Android version code: `9`

Runtime version: `1.2.7`

Adds canonical role-based access for passenger, driver, TODA operator, and admin accounts. Driver access is limited to the driver portal after admin verification; TODA operators can view their own group's members and lost-item notices, while admins manage groups and driver/operator assignments.

The web app is reserved for TODA operations and administration. The mobile app routes passengers, drivers, and staff to the portal allowed by their account role. The payment provider remains in test mode.

The APK must verify with signer SHA-256 `e714879093db3a6e245d492278adb36748a0ef695a62784bd01466c030c914d8`. Verify package, version, architecture, production environment and checksum before publishing. Install over the previous APK to preserve local data; do not uninstall first.
