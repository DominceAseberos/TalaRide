import { useMemo, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import qrcode from 'qrcode-generator';
import * as FileSystem from 'expo-file-system/legacy';
import { Button, Copy } from './ui';

export function QrImage({ value, size = 280, code }: { value: string; size?: number; code?: string }) {
  const svg = useRef<Svg>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { cells, count } = useMemo(() => {
    const qr = qrcode(0, 'M'); qr.addData(value); qr.make();
    const count = qr.getModuleCount(); const cells = [];
    for (let y = 0; y < count; y++) for (let x = 0; x < count; x++) if (qr.isDark(y, x)) cells.push({ x, y });
    return { cells, count };
  }, [value]);
  const height = code ? 360 : 280;
  async function save() {
    if (busy) return;
    setBusy(true); setMessage('');
    try {
      if (Platform.OS !== 'android') throw new Error('Use the driver web portal to download your QR image on this device.');
      const permission = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!permission.granted) return;
      const base64 = await new Promise<string>((resolve, reject) => {
        if (!svg.current) return reject(new Error('QR image is not ready.'));
        svg.current.toDataURL(resolve, { width: 1120, height: 1440 });
      });
      const uri = await FileSystem.StorageAccessFramework.createFileAsync(permission.directoryUri, `TalaRide-${code}.png`, 'image/png');
      await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
      setMessage('QR image saved with your vehicle code.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save the QR image.'); }
    finally { setBusy(false); }
  }
  const cell = 280 / (count + 8);
  return <View style={{ alignItems: 'center', gap: 12 }}>
    <Svg ref={svg} width={size} height={size * height / 280} viewBox={`0 0 280 ${height}`} accessibilityLabel={code ? `Vehicle QR ${code}` : 'Vehicle QR code'}>
      <Rect x={0} y={0} width={280} height={height} fill="white" />
      {cells.map(c => <Rect key={`${c.x}-${c.y}`} x={(c.x + 4) * cell} y={(c.y + 4) * cell} width={cell} height={cell} fill="black" />)}
      {code && <><SvgText x={140} y={312} textAnchor="middle" fill="#003D2B" fontSize={26} fontWeight="bold">{code}</SvgText><SvgText x={140} y={338} textAnchor="middle" fill="#334155" fontSize={12}>Scan QR or enter this vehicle code</SvgText></>}
    </Svg>
    {code && <Button label={busy ? 'Saving…' : 'Download QR image'} disabled={busy} onPress={() => void save()} />}
    {!!message && <Copy>{message}</Copy>}
  </View>;
}
