import { Platform } from 'react-native';

export const colors = {
  background: '#FFFEF9',
  surface: '#FFFFFF',
  white: '#FFFFFF',
  ink: '#101A20',
  muted: '#53606D',
  subdued: '#78847E',
  green: '#006B3D',
  darkGreen: '#003D2B',
  paleGreen: '#EEF7EB',
  border: '#DFE6DF',
  field: '#F6F8F5',
  red: '#C73E3A',
  paleRed: '#FFF3F1',
  yellow: '#E7B342',
  paleYellow: '#FFF8E5',
  disabled: '#C9D5CE',
  overlay: '#00000066',
  overlayStrong: '#00000088',
};

const isWeb = Platform.OS === 'web';

export const fonts = {
  regular: isWeb ? 'Arial' : 'Roboto_400Regular',
  medium: isWeb ? 'Arial' : 'Roboto_500Medium',
  bold: isWeb ? 'Arial' : 'Roboto_700Bold',
};
