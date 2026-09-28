import { Pressable, View } from 'react-native';
import { Copy, Icon, s, type IconName } from './ui';
import { colors } from '@/constants/theme';

export function ActivityCard({
  title,
  children,
  date,
  badge,
  icon,
  tone = 'active',
  unread = false,
  onPress,
}: {
  title: string;
  children: React.ReactNode;
  date: string;
  badge?: string;
  icon: IconName;
  tone?: 'active' | 'found' | 'expired';
  unread?: boolean;
  onPress: () => void;
}) {
  const color = tone === 'active' ? colors.yellow : tone === 'found' ? colors.green : '#78858B';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${badge ? `, ${badge}` : ''}`}
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
      }}
    >
      <View style={[s.row, { alignItems: 'flex-start', gap: 12 }]}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 9,
            backgroundColor: `${color}26`,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon} color={color} size={27} />
        </View>
        <View style={{ flex: 1 }}>
          <Copy bold style={{ fontSize: 14, lineHeight: 20 }}>
            {title}
          </Copy>
          {children}
          <Copy style={{ fontSize: 12, color: colors.muted, marginTop: 4 }}>{date}</Copy>
        </View>
        {badge && (
          <Copy
            style={{
              fontSize: 11,
              lineHeight: 18,
              paddingHorizontal: 7,
              paddingVertical: 2,
              borderRadius: 7,
              backgroundColor: tone === 'active' ? '#FFE594' : '#DEE2E3',
            }}
          >
            {badge}
          </Copy>
        )}
        {unread && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              marginTop: 7,
              backgroundColor: colors.red,
            }}
          />
        )}
      </View>
    </Pressable>
  );
}
