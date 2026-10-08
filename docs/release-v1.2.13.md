# TalaRide v1.2.13 — presentation candidate

Android package: `com.beepanjero.talaride`
Android versionCode: `15`

This candidate contains the 2026-10-08 presentation-readiness fixes: truthful test/simulation payment and reward copy, corrected canonical backend example configuration, the React test-environment preload, and Android App Link signer alignment in source.

Before creating `v1.2.13`, commit and review the complete presentation patch set. Tag that reviewed commit exactly; do not move or reuse `v1.2.12`, because it already identifies older source.

Presentation payment behavior is intentionally test/simulation mode on the currently verified backend. Do not describe simulated payments as real charges or test vouchers as redeemable partner benefits.

Before installing the APK, verify its package, version, SHA-256 checksum, and signing certificate. Compare the signer with the APK already installed on the demo phone before attempting an in-place update.
