import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';

/** Safe-area container shared by the upcoming UI screens. */
export function Screen({
  children,
  style,
  scroll = true,
  footer,
}: PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  scroll?: boolean;
  footer?: React.ReactNode;
}>) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.frame}>
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[styles.content, style]}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.content, { flex: 1, minHeight: 0 }, style]}>{children}</View>
          )}
          {footer}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  fill: { flex: 1 },
  frame: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center' },
  content: { flexGrow: 1, padding: 20 },
});
