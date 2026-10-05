import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Updates from 'expo-updates';
import { Linking, Platform } from 'react-native';

const RELEASES_API =
  'https://api.github.com/repos/DominceAseberos/TalaRide/releases/latest';

type GithubAsset = {
  name?: string;
  browser_download_url?: string;
};

type GithubRelease = {
  tag_name?: string;
  html_url?: string;
  name?: string;
  body?: string;
  draft?: boolean;
  prerelease?: boolean;
  assets?: GithubAsset[];
};

export type AvailableUpdate =
  | {
      kind: 'ota';
      currentVersion: string;
      versionLabel: string;
    }
  | {
      kind: 'apk';
      currentVersion: string;
      versionLabel: string;
      releaseUrl: string;
      apkUrl: string;
      notes?: string;
    }
  | {
      kind: 'none';
      currentVersion: string;
      versionLabel: string;
    };

function cleanVersion(value: string | null | undefined): string {
  return String(value ?? '0.0.0')
    .trim()
    .replace(/^v/i, '')
    .split('-')[0] || '0.0.0';
}

function versionParts(value: string): number[] {
  return cleanVersion(value)
    .split('.')
    .map((part) => Number.parseInt(part, 10))
    .map((part) => (Number.isFinite(part) ? part : 0));
}

export function compareVersions(a: string, b: string): number {
  const left = versionParts(a);
  const right = versionParts(b);
  const length = Math.max(left.length, right.length, 3);

  for (let index = 0; index < length; index += 1) {
    const l = left[index] ?? 0;
    const r = right[index] ?? 0;
    if (l > r) return 1;
    if (l < r) return -1;
  }

  return 0;
}

export function getCurrentAppVersion(): string {
  return (
    Constants.nativeAppVersion ||
    Constants.expoConfig?.version ||
    '0.0.0'
  );
}

async function getLatestGithubRelease(): Promise<GithubRelease | null> {
  const response = await fetch(RELEASES_API, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`GitHub update check failed (${response.status}).`);
  }

  return (await response.json()) as GithubRelease;
}

function getApkAsset(release: GithubRelease): GithubAsset | null {
  return (
    release.assets?.find(
      (asset) =>
        typeof asset.name === 'string' &&
        asset.name.toLowerCase().endsWith('.apk') &&
        typeof asset.browser_download_url === 'string',
    ) ?? null
  );
}

export async function checkForUpdates(): Promise<AvailableUpdate> {
  const currentVersion = getCurrentAppVersion();

  const release = await getLatestGithubRelease();
  if (release && !release.draft && !release.prerelease) {
    const latestVersion = cleanVersion(release.tag_name);
    const apk = getApkAsset(release);

    if (
      compareVersions(latestVersion, currentVersion) > 0 &&
      apk?.browser_download_url &&
      release.html_url
    ) {
      return {
        kind: 'apk',
        currentVersion,
        versionLabel: latestVersion,
        releaseUrl: release.html_url,
        apkUrl: apk.browser_download_url,
        notes: release.body,
      };
    }
  }

  if (Updates.isEnabled) {
    try {
      const result = await Updates.checkForUpdateAsync();
      if (result.isAvailable) {
        return {
          kind: 'ota',
          currentVersion,
          versionLabel: currentVersion,
        };
      }
    } catch {
      // GitHub APK updates remain available even when EAS Update cannot be reached.
    }
  }

  return {
    kind: 'none',
    currentVersion,
    versionLabel: currentVersion,
  };
}

export async function applyUpdate(update: AvailableUpdate): Promise<void> {
  if (update.kind === 'none') return;

  if (update.kind === 'ota') {
    await Updates.fetchUpdateAsync();
    await Updates.reloadAsync();
    return;
  }

  if (Platform.OS !== 'android') {
    await Linking.openURL(update.releaseUrl);
    return;
  }

  if (!FileSystem.cacheDirectory) {
    throw new Error('TalaRide cannot access temporary storage for the update.');
  }

  const target = FileSystem.cacheDirectory + `talaride-${update.versionLabel}.apk`;
  const downloaded = await FileSystem.downloadAsync(update.apkUrl, target);

  if (downloaded.status < 200 || downloaded.status >= 300) {
    throw new Error(`APK download failed (${downloaded.status}).`);
  }

  const contentUri = await FileSystem.getContentUriAsync(downloaded.uri);

  try {
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1,
      type: 'application/vnd.android.package-archive',
    });
  } catch (error) {
    await Linking.openURL(update.releaseUrl);
    throw new Error(
      error instanceof Error
        ? `Android could not open the installer: ${error.message}`
        : 'Android could not open the installer.',
    );
  }
}
