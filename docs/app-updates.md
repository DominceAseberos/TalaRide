# TalaRide In-App Update Flow

TalaRide 1.2.0 introduces two update paths from **Account → App Updates**.

## 1. OTA updates

Use OTA updates for JavaScript, UI, assets, and business-logic changes that do not require a new native runtime.

The app is configured with:

- EAS Update project: `05dd99d8-b198-4386-bdc7-e85e4d5df01c`
- Runtime version policy: `appVersion`
- Production channel: `production`

Publish an OTA update from `mobile`:

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

1. Bump `expo.version` and `android.versionCode` in `mobile/app.json`.
2. Build using the approved GitHub Actions Android release workflow or an EAS profile with a verified matching signing key.
3. Create a GitHub release in `DominceAseberos/TalaRide` with a matching version tag.
4. Attach the signed `.apk` as a release asset.

The app queries the public GitHub Releases API. If a newer release contains an APK, **Install Update** downloads it into TalaRide and opens Android's package installer.

Android still requires the user to confirm installation. The replacement APK must be signed with the same signing key as the installed TalaRide package.

### Current GitHub Actions signer and upgrade check (2026-10-08)

The Android release workflow currently expects SHA-256 certificate fingerprint
`AD:1C:AC:12:00:08:24:5B:12:92:3F:71:74:BF:DB:73:78:BB:46:DF:9E:F3:66:D3:95:E3:5F:91:35:F1:77:EE`.
Some older release documents refer to the earlier `E7:14:87:90:...` signer.
The fingerprint expected by the build is not evidence of the certificate used
on any APK already installed on a testing device.

**Before the next demonstration or release**, inspect the certificate of the
APK installed on each test device and compare it with the newly built APK.
Android does not allow an in-place upgrade between differently signed APKs
sharing the same application ID. Do not ask testers to uninstall the app just
to bypass this issue: locally stored ride history may be lost. Resolve the
signing/upgrade path with the release owner and back up any irreplaceable local
data before changing installations.

## Bootstrap requirement

Any device still running the original 1.0.0 APK predates this updater and the HTTPS App Link intent filter. That APK cannot add those native capabilities to itself.

Bootstrap such a device with an updater-enabled APK **only if its signing certificate is compatible**. If the old and new signing keys differ, coordinate a migration and protect locally stored data first. After an updater-enabled APK is installed:

- OTA-compatible changes do not require reinstalling an APK.
- Native updates can be initiated directly from TalaRide instead of manually browsing GitHub.
