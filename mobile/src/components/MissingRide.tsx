import { Screen } from './Screen';
import { Button, Copy, Header, Title, replace } from './ui';
import { useMock } from '@/mocks/MockProvider';
export function MissingRide() {
  const { ridesLoading, ridesError } = useMock();
  return (
    <Screen>
      <Header />
      <Title>{ridesLoading ? 'Loading ride…' : 'Ride not found'}</Title>
      <Copy style={{ marginVertical: 20 }}>
        {ridesError ||
          (ridesLoading ? 'Opening your local records.' : 'This ride is no longer available.')}
      </Copy>
      <Button label="View My Rides" onPress={() => replace('/rides')} />
    </Screen>
  );
}
