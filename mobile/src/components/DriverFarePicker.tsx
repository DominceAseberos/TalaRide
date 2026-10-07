import { Pressable, View } from 'react-native';
import { Card, Copy, Icon } from '@/components/ui';
import { colors } from '@/constants/theme';

export type DriverFareOption = {
  id: string;
  label: string;
  amountCentavos: number;
};

export function DriverFarePicker({
  fares,
  selectedFareCentavos,
  onSelect,
}: {
  fares: DriverFareOption[];
  selectedFareCentavos: number | null;
  onSelect: (amountCentavos: number) => void;
}) {
  return (
    <View style={{ gap: 10 }}>
      {fares.map((fare) => {
        const selected = selectedFareCentavos === fare.amountCentavos;
        const amount = (fare.amountCentavos / 100).toFixed(fare.amountCentavos % 100 ? 2 : 0);
        return (
          <Pressable
            key={fare.id}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={`${fare.label}${selected ? ', selected' : ''}`}
            onPress={() => onSelect(fare.amountCentavos)}
            style={({ pressed }) => ({ opacity: pressed ? 0.75 : 1 })}
          >
            <Card
              style={{
                borderWidth: 2,
                borderColor: selected ? colors.green : colors.border,
                backgroundColor: selected ? colors.paleGreen : colors.white,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Icon name={selected ? 'checkmark-circle' : 'cash-outline'} color={colors.green} />
                <Copy style={{ flex: 1 }}>{fare.label}</Copy>
                <Copy bold>₱{amount}</Copy>
              </View>
            </Card>
          </Pressable>
        );
      })}
    </View>
  );
}
