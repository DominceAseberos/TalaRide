import { Pressable, View } from 'react-native';
import { Copy, Icon, replace, type IconName } from './ui';
import { colors } from '@/constants/theme';
import { useNotifications } from '@/notifications/NotificationProvider';
const tabs: { label: string; route: string; icon: IconName; activeIcon: IconName }[] = [
  { label: 'Home', route: '/home', icon: 'home-outline', activeIcon: 'home' },
  { label: 'Scan', route: '/scan', icon: 'scan-outline', activeIcon: 'scan' },
  { label: 'Rides', route: '/rides', icon: 'calendar-outline', activeIcon: 'calendar' },
  {
    label: 'Activity',
    route: '/activity',
    icon: 'notifications-outline',
    activeIcon: 'notifications',
  },
  { label: 'Profile', route: '/profile', icon: 'person-outline', activeIcon: 'person' },
];
export function BottomNav({ active }: { active: string }) {
  const { notifications } = useNotifications();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.background,
        paddingTop: 5,
      }}
    >
      {tabs.map((tab) => (
        <Pressable
          key={tab.label}
          accessibilityRole="tab"
          accessibilityLabel={tab.label}
          accessibilityState={{ selected: active === tab.label }}
          onPress={() => replace(tab.route)}
          style={{ flex: 1, alignItems: 'center', paddingVertical: 8, minHeight: 56 }}
        >
          <View>
            <Icon
              name={active === tab.label ? tab.activeIcon : tab.icon}
              size={22}
              color={active === tab.label ? colors.green : colors.muted}
            />
            {tab.label === 'Activity' && notifications.some((item) => item.unread) && (
              <View
                style={{
                  position: 'absolute',
                  right: -3,
                  top: -2,
                  width: 7,
                  height: 7,
                  borderRadius: 4,
                  backgroundColor: colors.red,
                }}
              />
            )}
          </View>
          <Copy
            bold={active === tab.label}
            style={{
              fontSize: 10,
              lineHeight: 16,
              color: active === tab.label ? colors.darkGreen : colors.muted,
            }}
          >
            {tab.label}
          </Copy>
        </Pressable>
      ))}
    </View>
  );
}
