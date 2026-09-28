import { Image, View, type StyleProp, type ViewStyle } from 'react-native';

// Display only approved artwork from the unmodified reference composite.
// The image is clipped at render time, so no replacement art is invented.
const regions = {
  logo: [79, 104, 86, 96],
  splashBrand: [54, 103, 139, 155],
  city: [20, 294, 208, 157],
  scan: [268, 92, 150, 151],
  privacy: [498, 100, 117, 129],
  community: [682, 85, 174, 157],
  vehicle: [42, 575, 154, 73],
  thumbnail: [689, 568, 46, 42],
  camera: [1320, 125, 195, 195],
} as const;

export function ReferenceArt({
  name,
  width,
  style,
}: {
  name: keyof typeof regions;
  width: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [x, y, w, h] = regions[name];
  const scale = width / w;
  return (
    <View accessible={false} style={[{ width, height: h * scale, overflow: 'hidden' }, style]}>
      <Image
        accessible={false}
        source={require('../../assets/references/ui-prototypes.png')}
        resizeMode="stretch"
        style={{
          position: 'absolute',
          width: 1536 * scale,
          height: 1024 * scale,
          left: -x * scale,
          top: -y * scale,
        }}
      />
    </View>
  );
}
