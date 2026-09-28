import { View, type ViewStyle } from 'react-native';
import { colors } from '@/constants/theme';

const corners: ViewStyle[] = [
  { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },
];

/** Framing guide from the approved scanner prototype; not an OCR bounding box. */
export function CaptureFrame() {
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={{
        position: 'absolute',
        left: '10%',
        right: '10%',
        top: '25%',
        bottom: '25%',
        borderWidth: 1,
        borderColor: colors.green,
        borderRadius: 10,
      }}
    >
      {corners.map((corner, index) => (
        <View
          key={index}
          style={[
            {
              position: 'absolute',
              width: 22,
              height: 22,
              borderColor: colors.white,
              borderRadius: 4,
            },
            corner,
          ]}
        />
      ))}
    </View>
  );
}
