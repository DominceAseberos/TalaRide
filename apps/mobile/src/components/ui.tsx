import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { router, type Href } from 'expo-router';
import { colors, fonts } from '@/constants/theme';
import { TalaIllustration } from './TalaIllustration';

export type IconName = ComponentProps<typeof Ionicons>['name'];
export const go = (path: string) => router.push(path as Href);
export const replace = (path: string) => router.replace(path as Href);
export function Icon({
  name,
  size = 22,
  color = colors.ink,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return (
    <Ionicons
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      name={name}
      size={size}
      color={color}
    />
  );
}
export function Copy({
  children,
  style,
  bold = false,
  ...props
}: PropsWithChildren<{ style?: StyleProp<TextStyle>; bold?: boolean }> &
  Omit<ComponentProps<typeof Text>, 'style'>) {
  return (
    <Text {...props} style={[s.copy, bold && { fontFamily: fonts.bold, fontWeight: '700' }, style]}>
      {children}
    </Text>
  );
}
export function Title({ children, style }: PropsWithChildren<{ style?: StyleProp<TextStyle> }>) {
  return (
    <Copy accessibilityRole="header" bold style={[s.title, style]}>
      {children}
    </Copy>
  );
}
export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
  icon,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'outline' | 'subtle';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: IconName;
}) {
  const inner = (
    <View style={s.buttonInner}>
      {icon && <Icon name={icon} color={variant === 'primary' ? colors.white : colors.darkGreen} />}
      <Copy bold style={{ color: variant === 'primary' ? colors.white : colors.darkGreen }}>
        {label}
      </Copy>
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        variant === 'outline' && s.outline,
        variant === 'subtle' && s.subtle,
        { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 },
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={['#00572F', '#00844A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 10 }}
        >
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </Pressable>
  );
}
export function IconButton({
  name,
  label,
  onPress,
  color,
}: {
  name: IconName;
  label: string;
  onPress: () => void;
  color?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={s.iconButton}
    >
      <Icon name={name} color={color} />
    </Pressable>
  );
}
export function Header({ title, right }: { title?: string; right?: React.ReactNode }) {
  return (
    <View style={s.header}>
      <IconButton
        name="chevron-back"
        label="Go back"
        onPress={() => (router.canGoBack() ? router.back() : replace('/home'))}
      />
      {title && <Title style={{ fontSize: 20, flex: 1 }}>{title}</Title>}
      {right}
    </View>
  );
}
export function Brand({ large = false }: { large?: boolean }) {
  return (
    <View accessibilityLabel="TalaRide. Remember every ride." accessible style={s.row}>
      <TalaIllustration name="mark" width={large ? 54 : 43} />
      <View>
        <Copy bold style={{ fontSize: large ? 30 : 24, color: colors.darkGreen }}>
          TalaRide
        </Copy>
        <Copy style={{ fontSize: large ? 12 : 10, fontStyle: 'italic', color: colors.darkGreen }}>
          Remember every ride.
        </Copy>
      </View>
    </View>
  );
}
export function Field({
  label,
  icon,
  trailing,
  style,
  ...props
}: ComponentProps<typeof TextInput> & {
  label: string;
  icon?: IconName;
  trailing?: React.ReactNode;
}) {
  return (
    <View style={[s.field, props.multiline && { alignItems: 'flex-start' }]}>
      {icon && <Icon name={icon} size={20} color={colors.muted} />}
      <TextInput
        {...props}
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[s.input, props.multiline && { minHeight: 60, textAlignVertical: 'top' }, style]}
      />
      {trailing}
    </View>
  );
}
export function Card({ children, style }: PropsWithChildren<{ style?: StyleProp<ViewStyle> }>) {
  return <View style={[s.card, style]}>{children}</View>;
}
export function Detail({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  return (
    <View style={[s.row, { alignItems: 'flex-start', marginVertical: 9 }]}>
      <Icon name={icon} />
      <View style={{ flex: 1 }}>
        <Copy style={{ fontSize: 13, color: colors.muted }}>{label}</Copy>
        <Copy style={{ marginTop: 3 }}>{value}</Copy>
      </View>
    </View>
  );
}
export function ActionRow({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={[s.action, danger && { backgroundColor: colors.paleRed }]}
    >
      <Icon name={icon} color={danger ? colors.red : colors.muted} />
      <Copy style={{ flex: 1, color: danger ? colors.red : colors.ink }}>{label}</Copy>
      <Icon name="chevron-forward" size={18} color={danger ? colors.red : colors.muted} />
    </Pressable>
  );
}

export const s = StyleSheet.create({
  copy: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21, color: colors.ink },
  title: { fontSize: 24, lineHeight: 30 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { minHeight: 48, borderRadius: 10, overflow: 'hidden' },
  buttonInner: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  outline: { borderWidth: 1, borderColor: colors.green },
  subtle: { backgroundColor: '#F0F3EE' },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: -12,
    marginBottom: 12,
    minHeight: 44,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    backgroundColor: colors.field,
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 14,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.ink,
    outlineWidth: 0,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    backgroundColor: colors.background,
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    minHeight: 50,
    borderBottomWidth: 1,
    borderColor: '#EDF0E9',
    borderRadius: 10,
  },
});
