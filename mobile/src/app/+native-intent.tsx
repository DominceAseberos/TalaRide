type NativeIntentEvent = {
  path: string;
  initial: boolean;
};

const APP_SCHEME = 'talaride:';
const WEB_HOST = 'talaride-web-frontend.vercel.app';
const VEHICLE_RE = /^\/v\/(TR-\d{5})\/?$/i;

function normalizeCustomScheme(url: URL) {
  const hostPart = url.hostname ? '/' + url.hostname : '';
  const pathname = url.pathname === '/' ? '' : url.pathname;
  return (hostPart + pathname || '/') + url.search + url.hash;
}

export function redirectSystemPath({ path }: NativeIntentEvent): string {
  try {
    if (!path) return '/';

    const url = new URL(path, 'https://' + WEB_HOST);

    if (url.protocol === APP_SCHEME) {
      const normalized = normalizeCustomScheme(url);
      const customUrl = new URL(normalized, 'https://' + WEB_HOST);
      const vehicleMatch = customUrl.pathname.match(VEHICLE_RE);

      if (vehicleMatch) {
        const checksum = customUrl.searchParams.get('c') || '';
        return (
          '/ride-confirm?vehicle_code=' +
          encodeURIComponent(vehicleMatch[1].toUpperCase()) +
          '&c=' +
          encodeURIComponent(checksum)
        );
      }

      return normalized;
    }

    if (url.hostname === WEB_HOST || !/^https?:$/i.test(url.protocol)) {
      const vehicleMatch = url.pathname.match(VEHICLE_RE);
      if (vehicleMatch) {
        const checksum = url.searchParams.get('c') || '';
        return (
          '/ride-confirm?vehicle_code=' +
          encodeURIComponent(vehicleMatch[1].toUpperCase()) +
          '&c=' +
          encodeURIComponent(checksum)
        );
      }
    }

    if (path.startsWith('/')) return path;
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}
