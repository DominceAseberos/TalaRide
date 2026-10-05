import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import qrcode from 'qrcode-generator';

// Offline QR render: pure-JS matrix + Svg rects. No network, works in Expo Go.
export function QrImage({ value, size = 240 }: { value: string; size?: number }) {
  const { cells, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const count = qr.getModuleCount();
    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < count; y += 1)
      for (let x = 0; x < count; x += 1) if (qr.isDark(y, x)) cells.push({ x, y });
    return { cells, count };
  }, [value]);
  const cell = size / count;
  return (
    <View
      accessibilityLabel="Payment QR code"
      accessible
      style={{ width: size, height: size, backgroundColor: '#fff', padding: 8, borderRadius: 12 }}
    >
      <Svg width={size - 16} height={size - 16} viewBox={`0 0 ${size - 16} ${size - 16}`}>
        {cells.map((c, i) => (
          <Rect
            key={i}
            x={c.x * cell}
            y={c.y * cell}
            width={cell + 0.5}
            height={cell + 0.5}
            fill="#111"
          />
        ))}
      </Svg>
    </View>
  );
}
