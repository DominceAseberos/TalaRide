import { Image, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

export type IllustrationName = 'splash' | 'scan' | 'privacy' | 'community' | 'mark';

const artwork = {
  mark: {
    source: require('../../assets/branding/talaride-tricycle-app-icon.png'),
    label: 'TalaRide green tricycle logo',
  },
  splash: {
    source: require('../../assets/branding/talaride-tricycle-onboarding.png'),
    label: 'Green Philippine tricycle with an open passenger doorway and driver',
  },
  scan: {
    source: require('../../assets/branding/talaride-tricycle-onboarding.png'),
    label: 'Green Philippine tricycle with an open passenger doorway and driver',
  },
  privacy: {
    source: require('../../assets/branding/talaride-fare-payment.png'),
    label: 'Choose your fare and payment method, then tap Proceed on your phone',
  },
  community: {
    source: require('../../assets/branding/talaride-ride-history.png'),
    label: 'Saved tricycle rides on a phone, a bag for lost-item follow-up, and a reward voucher',
  },
};

export function TalaIllustration({
  name,
  width = 280,
  style,
}: {
  name: IllustrationName;
  width?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const height = width * (name === 'splash' ? 0.82 : name === 'mark' ? 0.84 : 0.88);
  const current = artwork[name];
  return (
    <View style={[{ width, height, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Image
        source={current.source}
        accessibilityLabel={current.label}
        resizeMode="contain"
        style={{ width: '100%', height: '100%', borderRadius: name === 'mark' ? width * 0.22 : 0 }}
      />
    </View>
  );
}
