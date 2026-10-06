import { Pressable, View } from 'react-native';
import { Copy, Icon, replace, type IconName } from './ui';
import { colors } from '@/constants/theme';
import { useNotifications } from '@/notifications/NotificationProvider';

export type PortalTab = {
  id: string;
  label: string;
  icon: IconName;
  activeIcon: IconName;
  route?: string;
};

// Shared passenger portal navigation: Home | Scan | History | Rewards | Account.
export const passengerTabs: PortalTab[] = [
  { id: 'home', label: 'Home', route: '/home', icon: 'home-outline', activeIcon: 'home' },
  { id: 'scan', label: 'Scan', route: '/scan-ride', icon: 'scan-outline', activeIcon: 'scan' },
  {
    id: 'history',
    label: 'History',
    route: '/rides',
    icon: 'calendar-outline',
    activeIcon: 'calendar',
  },
  { id: 'rewards', label: 'Rewards', route: '/rewards', icon: 'gift-outline', activeIcon: 'gift' },
  {
    id: 'account',
    label: 'Account',
    route: '/profile',
    icon: 'person-outline',
    activeIcon: 'person',
  },
];

export function BottomNav({
  active,
  tabs = passengerTabs,
  onSelect,
}: {
  active: string;
  tabs?: PortalTab[];
  onSelect?: (tab: PortalTab) => void;
}) {
  const { notifications } = useNotifications();
  return (
    <View
      style={{
        flexDirection: 'row',
        borderTopWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        paddingTop: 5,
      }}
    >
      {tabs.map((tab) => {
        const selected = active === tab.id || active === tab.label;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => {
              if (onSelect) onSelect(tab);
              else if (tab.route) replace(tab.route);
            }}
            style={{ flex: 1, alignItems: 'center', paddingVertical: 8, minHeight: 56 }}
          >
            <View>
              <Icon
                name={selected ? tab.activeIcon : tab.icon}
                size={22}
                color={selected ? colors.green : colors.muted}
              />
              {(tab.id === 'home' || tab.id === 'overview') &&
                notifications.some((item) => item.unread) && (
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
              bold={selected}
              style={{
                fontSize: 10,
                lineHeight: 16,
                color: selected ? colors.darkGreen : colors.muted,
              }}
            >
              {tab.label}
            </Copy>
          </Pressable>
        );
      })}
    </View>
  );
}
