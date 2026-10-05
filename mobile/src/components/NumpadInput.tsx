import { Pressable, View } from 'react-native';
import { Copy, Icon } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['CLR', '0', '⌫'],
] as const;

type Key = (typeof ROWS)[number][number];

type NumpadInputProps = {
  value: string;
  onChange: (value: string) => void;
  maxLength?: number;
  disabled?: boolean;
};

export function NumpadInput({
  value,
  onChange,
  maxLength = 15,
  disabled = false,
}: NumpadInputProps) {
  function press(key: Key) {
    if (disabled) return;
    if (key === '⌫') {
      onChange(value.slice(0, -1));
    } else if (key === 'CLR') {
      onChange('');
    } else if (value.length < maxLength) {
      onChange(value + key);
    }
  }

  return (
    <View style={{ gap: 10 }}>
      {/* Number display */}
      <View
        style={{
          backgroundColor: colors.paleGreen,
          borderRadius: 14,
          paddingVertical: 18,
          paddingHorizontal: 20,
          alignItems: 'center',
          minHeight: 76,
          justifyContent: 'center',
        }}
      >
        <Copy
          bold
          style={{
            fontFamily: fonts.bold,
            fontSize: value ? 38 : 28,
            letterSpacing: value ? 6 : 2,
            color: value ? colors.ink : colors.muted,
          }}
        >
          {value || 'Tap a number'}
        </Copy>
      </View>

      {/* Key rows */}
      {ROWS.map((row, rowIndex) => (
        <View key={rowIndex} style={{ flexDirection: 'row', gap: 10 }}>
          {row.map((key) => {
            const isAction = key === '⌫' || key === 'CLR';
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={
                  key === '⌫' ? 'Delete last digit' : key === 'CLR' ? 'Clear all' : `Digit ${key}`
                }
                disabled={disabled}
                onPress={() => press(key)}
                style={({ pressed }) => ({
                  flex: 1,
                  height: 64,
                  borderRadius: 14,
                  backgroundColor: isAction
                    ? colors.border
                    : pressed
                      ? colors.green
                      : colors.field,
                  justifyContent: 'center',
                  alignItems: 'center',
                  opacity: disabled ? 0.45 : 1,
                })}
              >
                {({ pressed }) =>
                  key === '⌫' ? (
                    <Icon
                      name="backspace-outline"
                      size={26}
                      color={pressed ? colors.ink : colors.muted}
                    />
                  ) : (
                    <Copy
                      bold
                      style={{
                        fontFamily: fonts.bold,
                        fontSize: isAction ? 14 : 26,
                        color: isAction ? colors.muted : pressed ? colors.white : colors.ink,
                      }}
                    >
                      {key}
                    </Copy>
                  )
                }
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}
