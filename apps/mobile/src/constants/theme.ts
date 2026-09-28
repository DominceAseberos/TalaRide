import { Platform } from 'react-native';

export const colors = {
  background: '#FFFEF9',
  white: '#FFFFFF',
  ink: '#101A20',
  muted: '#53606D',
  green: '#006B3D',
  darkGreen: '#003D2B',
  paleGreen: '#EEF7EB',
  border: '#DFE6DF',
  field: '#F6F7F3',
  red: '#E60012',
  paleRed: '#FFF0EB',
  yellow: '#FFA800',
};

const isWeb = Platform.OS === 'web';

export const fonts = {
  regular: isWeb ? 'Arial' : 'Roboto_400Regular',
  medium: isWeb ? 'Arial' : 'Roboto_500Medium',
  bold: isWeb ? 'Arial' : 'Roboto_700Bold',
};
