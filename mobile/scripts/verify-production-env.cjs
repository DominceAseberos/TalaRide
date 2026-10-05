const fs = require('node:fs');
const path = require('node:path');

const required = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'EXPO_PUBLIC_WEB_API',
  'EXPO_PUBLIC_PAYMENT_MODE',
  'EXPO_PUBLIC_VEHICLE_QR_BASE',
  'EXPO_PUBLIC_QR_EXPIRY_SEC',
  'EXPO_PUBLIC_DEMO_MODE',
];

const file = path.join(__dirname, '..', '.env.production');
if (!fs.existsSync(file)) {
  console.error('Missing mobile/.env.production');
  process.exit(1);
}

const values = new Map();
for (const rawLine of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
  const line = rawLine.trim();
  if (!line || line.startsWith('#')) continue;
  const index = line.indexOf('=');
  if (index < 1) continue;
  const key = line.slice(0, index).trim();
  let value = line.slice(index + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }
  values.set(key, value);
}

const missing = required.filter((key) => !values.get(key));
if (missing.length) {
  console.error('Production environment is incomplete: ' + missing.join(', '));
  process.exit(1);
}

const supabaseUrl = values.get('EXPO_PUBLIC_SUPABASE_URL') || '';
const webApi = values.get('EXPO_PUBLIC_WEB_API') || '';
const vehicleQrBase = values.get('EXPO_PUBLIC_VEHICLE_QR_BASE') || '';

for (const [name, value] of [
  ['EXPO_PUBLIC_SUPABASE_URL', supabaseUrl],
  ['EXPO_PUBLIC_WEB_API', webApi],
  ['EXPO_PUBLIC_VEHICLE_QR_BASE', vehicleQrBase],
]) {
  if (!/^https:\/\//i.test(value)) {
    console.error(name + ' must use HTTPS in production.');
    process.exit(1);
  }
}

console.log('Production environment is present and structurally valid.');
