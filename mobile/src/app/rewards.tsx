import { Screen } from '@/components/Screen';
import { BottomNav } from '@/components/BottomNav';
import { RewardsDisclaimer } from '@/components/Disclaimers';
import { RewardsPanel } from '@/components/RewardsPanel';

export default function RewardsScreen() {
  return (
    <Screen footer={<BottomNav active="Rewards" />}>
      <RewardsPanel audience="passenger" />
      <RewardsDisclaimer />
    </Screen>
  );
}
