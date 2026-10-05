# Phase 11 Android APK setup

Date started: 2026-09-25

## Scope

This phase is limited to an installable Android testing APK. It does not include
iOS, Apple credentials, production builds, app-store submission, Firebase/FCM,
or push-notification credentials.

## Completed setup

- EAS project:
  [`@an_jelo/talaride`](https://expo.dev/accounts/an_jelo/projects/talaride)
- EAS project ID: `05dd99d8-b198-4386-bdc7-e85e4d5df01c`
- Android application ID: `com.beepanjero.talaride`
- EAS-managed Android signing keystore
- Development and internal preview build profiles
- Public Supabase variables available to the EAS development and preview builds

The EAS project ID is public and remains committed under
`expo.extra.eas.projectId`. Signing credentials stay on EAS and are not stored in
the repository.

## Build commands

Create a development APK containing the Expo development client:

```bash
npx eas-cli build --platform android --profile development
```

Create a standalone internal preview APK:

```bash
npx eas-cli build --platform android --profile preview
```

The preview and production profiles both produce installable Android APKs. The production profile uses the `production` EAS Update channel. No app-store submission profile is configured.

## Testing checklist

- Install the APK on a physical Android device.
- Sign in using the configured Supabase project.
- Capture a clear vehicle plate and confirm OCR prefills the number.
- Choose a plate image from the gallery and confirm the same behavior.
- Correct the detected number manually and save the ride.
- Restart the app and confirm local rides persist.

Push notification delivery is outside this phase and is expected to remain
unavailable until separately configured.

## Build record

- Profile: `preview`
- Platform: Android
- Application ID: `com.beepanjero.talaride`
- App version/build: `1.0.0` / `1`
- Git commit: `9c693bf`
- EAS build: `1e32f09c-7d9c-4c34-a225-771ff2ad68af`
- Status: finished successfully on 2026-09-25
- APK: [Download the TalaRide Android testing APK](https://expo.dev/artifacts/eas/hTnGH5I0mKrcGVV1-y3axZqON5i84bO2nAIKlby2szQ.apk)


## TalaRide 1.2.2 release preparation

- App version: `1.2.2`
- Android versionCode: `4`
- Runtime version: `1.2.2` through the `appVersion` runtime policy
- Build profile: `production`
- Distribution: internal APK
- EAS Update channel: `production`

### Included user-facing changes

- Unified TalaRide cream, white, and deep-green visual theme across the customer-facing web flow and mobile app.
- Removed the web demo role switcher from the production UI; role areas remain available through their routes.
- Redesigned the permanent-QR checkout so scanned users see verified driver and vehicle details first, followed by fare and payment selection.
- Redesigned mobile onboarding around the current QR journey.
- Aligned custom fare validation with the ₱15 configured minimum.
- Preserved permanent vehicle QR deep links and the live Render/Vercel checkout flow.

### Release verification

Before publishing the APK:

```bash
pnpm --filter @talaride/mobile typecheck
pnpm --filter @talaride/mobile lint
pnpm --filter @talaride/mobile test
cd apps/mobile
npm run release:verify-env
npx eas-cli build --platform android --profile production
```

Do not create the public GitHub `v1.2.2` release until the production APK has finished successfully and the APK asset is attached. The in-app updater treats the latest non-prerelease GitHub release containing an APK as an available native update.
