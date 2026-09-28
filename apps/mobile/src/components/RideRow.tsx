import { Pressable, View } from 'react-native';
import { ReferenceArt } from './ReferenceArt';
import { Copy, Icon, go, s } from './ui';
import { colors } from '@/constants/theme';
import { formatDate } from '@/mocks/data';
import type { Ride } from '@/types/models';
export function RideRow({ ride }: { ride: Ride }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ride ${ride.number}, ${formatDate(ride.date)}`}
      onPress={() => go(`/ride/${ride.id}`)}
      style={[s.row, { borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 15 }]}
    >
      <ReferenceArt name="thumbnail" width={45} />
      <View style={{ flex: 1 }}>
        <Copy bold>#{ride.number}</Copy>
        <Copy style={{ fontSize: 12, color: colors.muted }}>{formatDate(ride.date)}</Copy>
      </View>
      <Icon name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}
