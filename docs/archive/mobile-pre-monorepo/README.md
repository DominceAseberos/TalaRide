# TalaRide

TalaRide is a privacy-first mobile app for recording tricycle and pedicab rides. It helps passengers keep track of vehicle identifiers and ride details so they have useful information if an item is lost.

Ride records stay on the user's device. Supabase is used only for authentication and basic profile information; ride history and scanned images are not uploaded.

## Features

- Email registration, sign-in, password recovery, and session management
- Editable passenger profile
- Camera and gallery scanning for vehicle identifiers
- On-device OCR with manual review and correction before saving
- Manual vehicle identifier entry when OCR is unavailable
- Local ride history stored with SQLite
- Search and filtering by vehicle type and date
- View, edit, and delete saved rides
- Optional ride notes and location details
- Lost-item reporting flow
- Offline access to locally stored rides
- Android, iOS, and web support through Expo

> [!NOTE]
> The community relay is currently a demonstration feature. Native OCR requires a development build and is not available in Expo Go. The web version performs OCR locally in the browser; manual entry remains available when recognition is uncertain.

## Tech Stack

- **Frontend:** React 19, React Native 0.86, TypeScript
- **Framework:** Expo SDK 57 and Expo Router
- **Authentication and profiles:** Supabase
- **Local storage:** Expo SQLite and AsyncStorage
- **Secure session storage:** Expo SecureStore
- **Camera and image selection:** Expo Camera and Expo Image Picker
- **OCR:** `expo-mlkit-ocr` using ML Kit on Android and Apple Vision on iOS; `tesseract.js` in the browser
- **Notifications:** Expo Notifications
- **Testing and quality:** Node test runner, TypeScript, ESLint, and Prettier

## Setup

### Prerequisites

Install the following before starting:

- [Node.js](https://nodejs.org/) LTS
- npm
- An Android emulator or physical Android device, or macOS with Xcode for iOS development
- A [Supabase](https://supabase.com/) project

### 1. Install dependencies

Clone the repository, open the project directory, and install the locked dependency versions:

```bash
npm ci
```

### 2. Configure environment variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

On Windows PowerShell, use:

```powershell
Copy-Item .env.example .env
```

Add your public Supabase project values to `.env`:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
```

Only use the public project URL and publishable key. Never place a service-role key, database password, or other secret in an `EXPO_PUBLIC_*` variable.

### 3. Configure Supabase

Follow the [Supabase setup guide](supabase/README.md) to apply the profile migration and Row Level Security policies, configure authentication callback URLs, and deploy the relay Edge Function when needed.

### 4. Create a native development build

A native development build is required for on-device OCR and SecureStore integration:

```bash
npx expo run:android
```

For iOS, run the following on macOS with Xcode configured:

```bash
npx expo run:ios --device
```

iOS 16.4 or later is required. On Windows, use a short project path if a native Android build fails because of path-length limits.

For the signed Android testing APK, follow the
[Phase 11 Android setup](docs/phase-11-release.md). It uses the linked EAS project
and its managed Android signing keystore.

## Run the App

Start the development server for an installed native development build:

```bash
npx expo start --dev-client
```

You can also launch a platform directly:

```bash
npm run android
npm run ios
npm run web
```

Expo Go can be used for a limited preview, but native OCR is unavailable there. Use manual vehicle identifier entry or install a development build for the complete scanning flow.

## Checks and Tests

```bash
npm test
npm run check
```

`npm test` runs the automated tests. `npm run check` verifies TypeScript, ESLint, and Prettier formatting.

## Privacy Notes

- Ride records are stored locally and are not synchronized to Supabase.
- Captured images are temporarily cached for recognition and removed after the scan flow.
- Photos, raw OCR text, and local file paths are not stored in ride records.
- The local SQLite database is not currently encrypted. The device sandbox and lock screen provide baseline protection, but production use with sensitive data should add and validate database encryption.

## License

This project is licensed under the terms in [LICENSE](LICENSE).
