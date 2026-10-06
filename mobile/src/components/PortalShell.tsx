import type { PropsWithChildren, ReactNode } from 'react';
import { View } from 'react-native';
import { BottomNav, passengerTabs, type PortalTab } from '@/components/BottomNav';
import { Screen } from '@/components/Screen';
import { Brand } from '@/components/ui';

type Props = {
  activeTab: string;
  tabs?: PortalTab[];
  onTabSelect?: (tab: PortalTab) => void;
  headerAction?: ReactNode;
};

/** Shared passenger and driver dashboard frame, header, spacing, and bottom navigation. */
export function PortalShell({
  activeTab,
  tabs = passengerTabs,
  onTabSelect,
  headerAction,
  children,
}: PropsWithChildren<Props>) {
  return (
    <Screen footer={<BottomNav active={activeTab} tabs={tabs} onSelect={onTabSelect} />}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 22,
        }}
      >
        <Brand />
        {headerAction}
      </View>
      {children}
    </Screen>
  );
}
