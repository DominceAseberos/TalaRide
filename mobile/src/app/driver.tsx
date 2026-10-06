import { useEffect, useState } from 'react';
import { AppState, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Button, Card, Copy, Detail, Icon, Title } from '@/components/ui';
import { DriverEnrollment, type RegisteredDriver } from '@/components/DriverEnrollment';
import { QrImage } from '@/components/QrImage';
import { apiRequest, ApiError } from '@/api/client';
import { startShift, endShift } from '@/api/shifts';
import { fetchDriverNotifications, type DriverNotification } from '@/api/drivers';
import { useMock } from '@/mocks/MockProvider';
import { enqueueOutbox } from '@/offline/queue';
import { triggerSync } from '@/api/sync';
import { useAuth } from '@/auth/AuthProvider';
import { colors } from '@/constants/theme';
import { RewardsPanel } from '@/components/RewardsPanel';

type Account = {
  driver: RegisteredDriver | null;
  vehicle: { vehicle_code: string; qr_checksum: string } | null;
};
export default function DriverScreen() {
  const { session } = useAuth();
  return <DriverAccountScreen key={session?.user.id || 'signed-out'} />;
}

function DriverAccountScreen() {
  const { session, displayName } = useAuth();
  const { saveRide } = useMock();
  const [cashFare, setCashFare] = useState('');
  const [cashMessage, setCashMessage] = useState('');
  const [account, setAccount] = useState<Account | null>(null);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const userId = session?.user.id;
  const driver = account?.driver;
  const isPendingApproval = driver?.verification_status === 'pending';
  useEffect(() => {
    if (!userId) return;
    let active = true;
    let inFlight = false;
    const key = `talaride.driver-account:${userId}`;
    async function refresh() {
      if (inFlight || !active) return;
      inFlight = true;
      try {
        const value = await apiRequest<Account>('/auth/me');
        if (!active) return;
        setAccount(value);
        setOnline(true);
        setError('');
        await AsyncStorage.setItem(key, JSON.stringify(value));
        if (value.driver) {
          try {
            const result = await fetchDriverNotifications(value.driver.driver_code);
            if (active) setNotifications(result.notifications);
          } catch {
            /* Keep the freshly loaded account when notifications are unavailable. */
          }
        }
      } catch (failure) {
        if (!active) return;
        setOnline(false);
        if (failure instanceof ApiError && (failure.status === 401 || failure.status === 403)) {
          setAccount(null);
          await AsyncStorage.removeItem(key);
          return;
        }
        const cached = await AsyncStorage.getItem(key);
        if (active && cached) {
          try {
            setAccount(JSON.parse(cached));
          } catch {}
        }
        if (active)
          setError('Could not refresh driver details. Saved information may be out of date.');
      } finally {
        inFlight = false;
      }
    }
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    void triggerSync().catch(() => {});
    void refresh();
    const timer = isPendingApproval ? setInterval(() => void refresh(), 5000) : undefined;
    return () => {
      active = false;
      if (timer) clearInterval(timer);
      appState.remove();
    };
  }, [userId, isPendingApproval]);
  const vehicle = account?.vehicle;
  async function shift() {
    if (!driver || !vehicle || busy) return;
    setBusy(true);
    setError('');
    try {
      if (driver.shift_status === 'active') await endShift(driver.driver_code);
      else await startShift(driver.driver_code, vehicle.vehicle_code, `shift-${Date.now()}`);
      setAccount(await apiRequest<Account>('/auth/me'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update shift.');
    } finally {
      setBusy(false);
    }
  }
  async function recordCash() {
    if (!driver || !vehicle || driver.verification_status !== 'verified' || busy) return;
    const pesos = Number(cashFare);
    if (!Number.isFinite(pesos) || pesos < 1 || pesos > 500) {
      setError('Enter a cash fare from 1 to 500 pesos.');
      return;
    }
    setBusy(true);
    setError('');
    setCashMessage('');
    try {
      const rideId = await saveRide(vehicle.vehicle_code, 'Body #');
      const operation = `cash-${rideId}`;
      await enqueueOutbox(operation, 'cash_ride', {
        account_id: userId,
        client_operation_id: operation,
        local_ride_id: rideId,
        driver_code: driver.driver_code,
        vehicle_code: vehicle.vehicle_code,
        amount_centavos: Math.round(pesos * 100),
      });
      setCashMessage('Cash ride saved on this phone. It will sync when connected.');
      void triggerSync().catch(() => {});
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save cash ride.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen>
      {!account ? (
        <Card>
          <Copy>{error || 'Loading your driver account...'}</Copy>
        </Card>
      ) : !driver ? (
        <DriverEnrollment
          name={displayName}
          online={online}
          onRegistered={(registered) => {
            const saved = { ...account, driver: registered };
            setAccount(saved);
            if (userId)
              void AsyncStorage.setItem(
                `talaride.driver-account:${userId}`,
                JSON.stringify(saved),
              ).catch(() => {});
          }}
        />
      ) : driver.verification_status !== 'verified' ? (
        <>
          <Card style={{ marginTop: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Icon
                name={driver.verification_status === 'suspended' ? 'alert-circle-outline' : 'time-outline'}
                size={32}
                color={driver.verification_status === 'suspended' ? colors.red : colors.green}
              />
              <View style={{ flex: 1 }}>
                <Title>
                  {driver.verification_status === 'suspended'
                    ? 'Account suspended'
                    : 'Verification pending'}
                </Title>
                <Copy>
                  {driver.verification_status === 'suspended'
                    ? 'Ask an administrator to review your account.'
                    : 'Your dashboard opens automatically after approval.'}
                </Copy>
              </View>
            </View>
          </Card>
          <Detail icon="person-outline" label="Driver" value={driver.full_name} />
          <Detail icon="card-outline" label="Driver code" value={driver.driver_code} />
          <Detail
            icon="people-outline"
            label="TODA group"
            value={driver.toda_group_id ? driver.toda_operator || 'Assigned' : 'Not assigned yet'}
          />
          {!online && (
            <Copy style={{ marginTop: 12 }}>
              Offline · showing saved status. Reconnect to check for approval.
            </Copy>
          )}
        </>
      ) : (
        <>
          <Title>{driver.full_name}</Title>
          <Copy>
            {driver.driver_code} ·{' '}
            {driver.verification_status === 'verified' ? 'Verified driver' : 'Verification pending'}
          </Copy>
          <Card style={{ marginTop: 16 }}>
            <Copy bold>TODA group</Copy>
            <Copy>
              {driver.toda_group_id
                ? driver.toda_operator
                : 'Not yet added to a TODA group. Share your driver code with your TODA operator.'}
            </Copy>
          </Card>
          <Card style={{ marginTop: 16 }}>
            {vehicle ? (
              <QrImage
                code={vehicle.vehicle_code}
                value={`https://talaride-web-frontend.vercel.app/v/${vehicle.vehicle_code}?c=${encodeURIComponent(vehicle.qr_checksum)}`}
              />
            ) : (
              <Copy>Your vehicle QR appears after your TODA assigns a registered vehicle.</Copy>
            )}
            {!online && <Copy>Saved QR · offline</Copy>}
          </Card>
          {!!vehicle && driver.verification_status === 'verified' && (
            <View style={{ marginTop: 16 }}>
              <Button
                label={driver.shift_status === 'active' ? 'End shift' : 'Start shift'}
                disabled={busy || !online}
                onPress={() => void shift()}
              />
            </View>
          )}
          {!!vehicle && driver.verification_status === 'verified' && (
            <Card style={{ marginTop: 16 }}>
              <Copy bold>Record a cash ride</Copy>
              <TextInput
                accessibilityLabel="Cash fare in pesos"
                keyboardType="decimal-pad"
                value={cashFare}
                onChangeText={setCashFare}
                placeholder="Fare in pesos"
                placeholderTextColor={colors.muted}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: colors.field,
                  color: colors.ink,
                  borderRadius: 12,
                  padding: 14,
                  marginVertical: 12,
                }}
              />
              <Button label="Save cash ride" disabled={busy} onPress={() => void recordCash()} />
              {!!cashMessage && <Copy>{cashMessage}</Copy>}
            </Card>
          )}
          <View style={{ marginTop: 16 }}>
            <RewardsPanel audience="driver" />
          </View>
          <Card style={{ marginTop: 16 }}>
            <Copy bold>Payment and lost-item notifications</Copy>
            {notifications.length ? (
              notifications.map((item) => <Copy key={item.id}>{item.message}</Copy>)
            ) : (
              <Copy>No notifications yet.</Copy>
            )}
          </Card>
        </>
      )}
      {!!error && <Copy style={{ marginTop: 12, color: colors.red }}>{error}</Copy>}
    </Screen>
  );
}
