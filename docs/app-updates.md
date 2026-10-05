# TalaRide In-App Update Flow

TalaRide 1.2.0 introduces two update paths from **Account → App Updates**.

## 1. OTA updates

Use OTA updates for JavaScript, UI, assets, and business-logic changes that do not require a new native runtime.

The app is configured with:

- EAS Update project: `05dd99d8-b198-4386-bdc7-e85e4d5df01c`
- Runtime version policy: `appVersion`
- Production channel: `production`

Publish an OTA update from `apps/mobile`:

```bash
eas update --channel production --message "Describe the update"
```

The app checks EAS Update on startup and also checks manually from **Account → App Updates**. When an OTA update is available, the user can tap **Install Update & Restart**.

## 2. Native Android APK updates

Use an APK update when changing native configuration or dependencies, including:

- Android permissions
- intent filters / App Links
- Expo SDK or native modules
- package/application configuration
- anything requiring a new Android binary

For a native release:

1. Bump `expo.version` and `android.versionCode` in `apps/mobile/app.json`.
2. Build with the `production` EAS profile.
3. Create a GitHub release in `DominceAseberos/TalaRide` with a matching version tag.
4. Attach the signed `.apk` as a release asset.

The app queries the public GitHub Releases API. If a newer release contains an APK, **Install Update** downloads it into TalaRide and opens Android's package installer.

Android still requires the user to confirm installation. The replacement APK must be signed with the same signing key as the installed TalaRide package.

## Bootstrap requirement

The currently installed 1.0.0 APK predates this updater and the HTTPS App Link intent filter. It cannot add those native capabilities to itself.

Install the updater-enabled 1.2.0 APK once. After that:

- OTA-compatible changes do not require reinstalling an APK.
- Native updates can be initiated directly from TalaRide instead of manually browsing GitHub.
