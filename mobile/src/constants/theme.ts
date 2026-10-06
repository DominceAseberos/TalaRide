import { Platform } from 'react-native';

export const colors = {
  background: '#FFFFFF',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  ink: '#25332E',
  muted: '#65716B',
  subdued: '#737F78',
  green: '#356653',
  darkGreen: '#2B5140',
  paleGreen: '#F0F5F2',
  border: '#E2E7E4',
  field: '#F7F9F7',
  red: '#A04444',
  paleRed: '#FCF5F5',
  yellow: '#80612E',
  paleYellow: '#FAF8F2',
  disabled: '#E2E7E4',
  overlay: '#00000066',
  overlayStrong: '#00000088',
};

const isWeb = Platform.OS === 'web';

export const fonts = {
  regular: isWeb ? 'Arial' : 'Roboto_400Regular',
  medium: isWeb ? 'Arial' : 'Roboto_500Medium',
  bold: isWeb ? 'Arial' : 'Roboto_700Bold',
};
