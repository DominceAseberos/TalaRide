import { useEffect, useState } from 'react';
import { AppState, Image, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Screen } from '@/components/Screen';
import { Button, Card, Copy, Detail, Field, Icon, IconButton, Title } from '@/components/ui';
import { PortalShell } from '@/components/PortalShell';
import { DriverFarePicker } from '@/components/DriverFarePicker';
import type { PortalTab } from '@/components/BottomNav';
import { DriverEnrollment, type RegisteredDriver } from '@/components/DriverEnrollment';
import { QrImage } from '@/components/QrImage';
import { apiRequest, ApiError } from '@/api/client';
import { startShift, endShift } from '@/api/shifts';
import {
  fetchDriverNotifications,
  fetchDriverSummary,
  registerDriverVehicle,
  updateDriverPhoto,
  type DriverNotification,
  type DriverSummary,
  type DriverVehicle,
} from '@/api/drivers';
import { fetchFares } from '@/api/fares';
import { useMock } from '@/mocks/MockProvider';
import { enqueueOutbox } from '@/offline/queue';
import { triggerSync } from '@/api/sync';
import { useAuth } from '@/auth/AuthProvider';
import { uploadProfileImage } from '@/auth/profiles';
import { colors } from '@/constants/theme';
import { RewardsPanel } from '@/components/RewardsPanel';

type Account = {
  driver: RegisteredDriver | null;
  vehicle: DriverVehicle | null;
};

type PortalSection = 'overview' | 'history' | 'fares' | 'notifications' | 'profile';

const portalSections: PortalTab[] = [
  { id: 'overview', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { id: 'history', label: 'History', icon: 'calendar-outline', activeIcon: 'calendar' },
  { id: 'fares', label: 'Fares', icon: 'cash-outline', activeIcon: 'cash' },
  {
    id: 'notifications',
    label: 'Alerts',
    icon: 'notifications-outline',
    activeIcon: 'notifications',
  },
  { id: 'profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

function pesos(centavos: number) {
  return `₱${(centavos / 100).toFixed(centavos % 100 === 0 ? 0 : 2)}`;
}

function readableDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function DriverScreen() {
  const { session } = useAuth();
  return <DriverAccountScreen key={session?.user.id || 'signed-out'} />;
}

function DriverAccountScreen() {
  const { session, displayName, profile, updateProfile, signOut } = useAuth();
  const { saveRide } = useMock();
  const [section, setSection] = useState<PortalSection>('overview');
  const [cashFare, setCashFare] = useState('');
  const [selectedFareCentavos, setSelectedFareCentavos] = useState<number | null>(null);
  const [cashMessage, setCashMessage] = useState('');
  const [plateBodyNumber, setPlateBodyNumber] = useState('');
  const [account, setAccount] = useState<Account | null>(null);
  const [summary, setSummary] = useState<DriverSummary | null>(null);
  const [fares, setFares] = useState<Awaited<ReturnType<typeof fetchFares>>>([]);
  const [online, setOnline] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notifications, setNotifications] = useState<DriverNotification[]>([]);
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarMime, setAvatarMime] = useState('image/jpeg');
  const [avatarDirty, setAvatarDirty] = useState(false);
  const userId = session?.user.id;
  const driver = account?.driver;
  const vehicle = account?.vehicle;
  const isPendingApproval = driver?.verification_status === 'pending';
  const accountKey = userId ? `talaride.driver-account:${userId}` : '';

  async function saveAccount(value: Account) {
    setAccount(value);
    if (accountKey) await AsyncStorage.setItem(accountKey, JSON.stringify(value));
  }

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let inFlight = false;
    async function refresh() {
      if (inFlight || !active) return;
      inFlight = true;
      try {
        const value = await apiRequest<Account>('/auth/me');
        if (!active) return;
        setAccount(value);
        setOnline(true);
        setError('');
        await AsyncStorage.setItem(`talaride.driver-account:${userId}`, JSON.stringify(value));
        if (value.driver?.verification_status === 'verified') {
          const [notificationsResult, summaryResult, faresResult] = await Promise.allSettled([
            fetchDriverNotifications(value.driver.driver_code),
            fetchDriverSummary(value.driver.driver_code),
            fetchFares(),
          ]);
          if (!active) return;
          if (notificationsResult.status === 'fulfilled') {
            setNotifications(notificationsResult.value.notifications);
          }
          if (summaryResult.status === 'fulfilled') {
            setSummary(summaryResult.value);
            await AsyncStorage.setItem(
              `talaride.driver-summary:${userId}`,
              JSON.stringify(summaryResult.value),
            );
          } else {
            const savedSummary = await AsyncStorage.getItem(`talaride.driver-summary:${userId}`);
            if (savedSummary) {
              try {
                setSummary(JSON.parse(savedSummary));
              } catch {}
            }
          }
          if (faresResult.status === 'fulfilled') {
            const availableFares = faresResult.value;
            setFares(availableFares);
            setSelectedFareCentavos((selected) => {
              if (
                selected != null &&
                availableFares.some((fare) => fare.amountCentavos === selected)
              ) {
                return selected;
              }
              return (
                availableFares.find((fare) => fare.amountCentavos === 3000)?.amountCentavos ??
                availableFares[0]?.amountCentavos ??
                null
              );
            });
          }
        }
      } catch (failure) {
        if (!active) return;
        setOnline(false);
        if (failure instanceof ApiError && (failure.status === 401 || failure.status === 403)) {
          setAccount(null);
          await AsyncStorage.removeItem(`talaride.driver-account:${userId}`);
          return;
        }
        const [cached, savedSummary] = await Promise.all([
          AsyncStorage.getItem(`talaride.driver-account:${userId}`),
          AsyncStorage.getItem(`talaride.driver-summary:${userId}`),
        ]);
        if (active && cached) {
          try {
            setAccount(JSON.parse(cached));
          } catch {}
        }
        if (active && savedSummary) {
          try {
            setSummary(JSON.parse(savedSummary));
          } catch {}
        }
        if (active) {
          setError('Could not refresh driver details. Saved information may be out of date.');
        }
      } finally {
        inFlight = false;
      }
    }
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    void triggerSync().catch(() => {});
    void refresh();
    const timer = setInterval(() => void refresh(), isPendingApproval ? 5000 : 30000);
    return () => {
      active = false;
      clearInterval(timer);
      appState.remove();
    };
  }, [userId, isPendingApproval]);

  async function shift() {
    if (!driver || !vehicle || busy) return;
    setBusy(true);
    setError('');
    try {
      if (driver.shift_status === 'active') await endShift(driver.driver_code);
      else await startShift(driver.driver_code, vehicle.vehicle_code, `shift-${Date.now()}`);
      await saveAccount(await apiRequest<Account>('/auth/me'));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not update shift.');
    } finally {
      setBusy(false);
    }
  }

  async function createVehicle() {
    if (!driver || busy) return;
    if (plateBodyNumber.trim().length < 2) {
      setError('Enter your tricycle plate or body number.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await registerDriverVehicle(plateBodyNumber.trim());
      await saveAccount({ driver: result.driver as RegisteredDriver, vehicle: result.vehicle });
      setPlateBodyNumber('');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not register your tricycle.');
    } finally {
      setBusy(false);
    }
  }

  async function recordCash() {
    if (!driver || !vehicle || driver.verification_status !== 'verified' || busy) return;
    const value = cashFare.trim() ? Number(cashFare) : (selectedFareCentavos ?? 0) / 100;
    if (!Number.isFinite(value) || value < 1 || value > 500) {
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
        amount_centavos: Math.round(value * 100),
      });
      setCashFare('');
      setCashMessage('Cash ride saved on this phone. It will sync when connected.');
      void triggerSync().catch(() => {});
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save cash ride.');
    } finally {
      setBusy(false);
    }
  }

  async function chooseAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError('Allow photo access to choose a profile image.');
      return;
    }
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    const asset = picked.canceled ? undefined : picked.assets[0];
    if (!asset?.uri) return;
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      setError('Choose an image smaller than 5 MB.');
      return;
    }
    setAvatarUrl(asset.uri);
    setAvatarMime(asset.mimeType ?? 'image/jpeg');
    setAvatarDirty(true);
    setError('');
  }

  async function saveAvatar() {
    if (!driver || !userId || !avatarUrl || busy) return;
    setBusy(true);
    setError('');
    try {
      const savedUrl = avatarUrl.startsWith('http')
        ? avatarUrl
        : await uploadProfileImage(userId, avatarUrl, avatarMime);
      await Promise.all([updateProfile(driver.full_name, savedUrl), updateDriverPhoto(savedUrl)]);
      await saveAccount({ ...account!, driver: { ...driver, photo_url: savedUrl } });
      setAvatarUrl(savedUrl);
      setAvatarDirty(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could not save your profile image.');
    } finally {
      setBusy(false);
    }
  }

  if (!account) {
    return (
      <Screen>
        <Card>
          <Copy>{error || 'Loading your driver account…'}</Copy>
        </Card>
      </Screen>
    );
  }

  if (!driver) {
    return (
      <Screen>
        <DriverEnrollment
          name={displayName}
          online={online}
          onRegistered={(registered) => void saveAccount({ ...account, driver: registered })}
        />
        {!!error && <Copy style={{ marginTop: 12, color: colors.red }}>{error}</Copy>}
      </Screen>
    );
  }

  if (driver.verification_status !== 'verified') {
    return (
      <Screen>
        <Card style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Icon
              name={
                driver.verification_status === 'suspended' ? 'alert-circle-outline' : 'time-outline'
              }
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
        {!!(driver.toda_group_id && driver.toda_operator) && (
          <Detail icon="people-outline" label="TODA group" value={driver.toda_operator} />
        )}
        {!online && (
          <Copy style={{ marginTop: 12 }}>
            Offline · showing saved status. Reconnect to check for approval.
          </Copy>
        )}
        {!!error && <Copy style={{ marginTop: 12, color: colors.red }}>{error}</Copy>}
      </Screen>
    );
  }

  const displayedAvatar = avatarUrl || driver.photo_url || profile?.avatar_url || '';
  const rides = [...(summary?.rides ?? [])].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
  );
  const completedRides = rides.filter((item) => item.status === 'completed');
  const totalFare = completedRides.reduce((total, item) => total + item.fare_amount_centavos, 0);

  return (
    <PortalShell
      activeTab={section}
      tabs={portalSections}
      onTabSelect={(tab) => {
        setSection(tab.id as PortalSection);
        setError('');
      }}
      headerAction={
        <IconButton
          name="notifications-outline"
          label="Open driver alerts"
          onPress={() => setSection('notifications')}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View
          style={{
            width: 54,
            height: 54,
            borderRadius: 27,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.paleGreen,
          }}
        >
          {displayedAvatar ? (
            <Image source={{ uri: displayedAvatar }} style={{ width: 54, height: 54 }} />
          ) : (
            <Icon name="person" size={30} color={colors.darkGreen} />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Title>{driver.full_name}</Title>
          <Copy style={{ color: colors.muted }}>{driver.driver_code} · Verified driver</Copy>
        </View>
        <Icon name={online ? 'cloud-done-outline' : 'cloud-offline-outline'} color={colors.green} />
      </View>

      {section === 'overview' && (
        <View style={{ gap: 14, marginTop: 18 }}>
          {!!(driver.toda_group_id && driver.toda_operator) && (
            <Card>
              <Detail icon="people-outline" label="TODA group" value={driver.toda_operator} />
            </Card>
          )}
          {vehicle ? (
            <>
              <Card>
                <Detail
                  icon="car-outline"
                  label="Tricycle number"
                  value={vehicle.plate_body_number || vehicle.vehicle_code}
                />
                <Detail icon="keypad-outline" label="Vehicle code" value={vehicle.vehicle_code} />
                <QrImage
                  code={vehicle.vehicle_code}
                  value={`https://talaride-web-frontend.vercel.app/v/${vehicle.vehicle_code}?c=${encodeURIComponent(vehicle.qr_checksum)}`}
                />
                {!online && <Copy>Saved QR · offline</Copy>}
              </Card>
              <Button
                label={driver.shift_status === 'active' ? 'End shift' : 'Start shift'}
                icon={
                  driver.shift_status === 'active' ? 'stop-circle-outline' : 'play-circle-outline'
                }
                disabled={busy || !online}
                onPress={() => void shift()}
              />
              <Card>
                <Copy bold>Record a cash ride</Copy>
                <Copy style={{ color: colors.muted, marginTop: 4 }}>
                  Selected fare:{' '}
                  {selectedFareCentavos == null ? 'Choose a fare' : pesos(selectedFareCentavos)}.
                  {' '}Save it now; TalaRide syncs when you reconnect.
                </Copy>
                <Button
                  label="Choose fare"
                  icon="cash-outline"
                  variant="outline"
                  onPress={() => setSection('fares')}
                  style={{ marginTop: 12 }}
                />
                <TextInput
                  accessibilityLabel="Cash fare in pesos"
                  keyboardType="decimal-pad"
                  value={cashFare}
                  onChangeText={(value) => {
                    setCashFare(value);
                    const amount = Number(value);
                    const matchingFare = fares.find((fare) => fare.amountCentavos === Math.round(amount * 100));
                    setSelectedFareCentavos(value.trim() && matchingFare ? matchingFare.amountCentavos : null);
                  }}
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
                {!!cashMessage && <Copy style={{ marginTop: 10 }}>{cashMessage}</Copy>}
              </Card>
            </>
          ) : (
            <Card>
              <Title>Set up your tricycle</Title>
              <Copy style={{ marginTop: 6, color: colors.muted }}>
                Enter its plate or body number to create your permanent TalaRide code and
                downloadable QR.
              </Copy>
              <View style={{ gap: 12, marginTop: 14 }}>
                <Field
                  label="Tricycle plate or body number"
                  placeholder="Example: TAG-1234"
                  value={plateBodyNumber}
                  onChangeText={setPlateBodyNumber}
                  autoCapitalize="characters"
                  maxLength={50}
                  editable={!busy}
                />
                <Button
                  label={busy ? 'Creating QR…' : 'Register tricycle and create QR'}
                  icon="qr-code-outline"
                  disabled={busy || !online}
                  onPress={() => void createVehicle()}
                />
              </View>
            </Card>
          )}
          <RewardsPanel audience="driver" />
          <Card>
            <Copy bold>Recent notifications</Copy>
            <Copy style={{ marginTop: 6 }}>
              {notifications[0]?.message || 'Payment and lost-item alerts will appear here.'}
            </Copy>
            <Button
              label={`View alerts${notifications.length ? ` (${notifications.length})` : ''}`}
              variant="subtle"
              onPress={() => setSection('notifications')}
              style={{ marginTop: 12 }}
            />
          </Card>
        </View>
      )}

      {section === 'history' && (
        <View style={{ gap: 12, marginTop: 18 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Card style={{ flex: 1 }}>
              <Copy style={{ color: colors.muted }}>Completed rides</Copy>
              <Title>{completedRides.length}</Title>
            </Card>
            <Card style={{ flex: 1 }}>
              <Copy style={{ color: colors.muted }}>Recorded fares</Copy>
              <Title>{pesos(totalFare)}</Title>
            </Card>
          </View>
          {rides.length ? (
            rides.slice(0, 30).map((ride) => (
              <Card key={ride.ride_id}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Copy bold>{ride.vehicle_code}</Copy>
                    <Copy style={{ color: colors.muted }}>{readableDate(ride.timestamp)}</Copy>
                  </View>
                  <Copy bold>{pesos(ride.fare_amount_centavos)}</Copy>
                </View>
                <Copy style={{ marginTop: 8, textTransform: 'capitalize' }}>
                  {ride.payment_method} · {ride.status}
                </Copy>
              </Card>
            ))
          ) : (
            <Card>
              <Icon name="time-outline" size={30} color={colors.green} />
              <Copy style={{ marginTop: 8 }}>No completed rides yet.</Copy>
            </Card>
          )}
        </View>
      )}

      {section === 'fares' && (
        <View style={{ gap: 12, marginTop: 18 }}>
          <Card>
            <Title>Fare prices</Title>
            <Copy style={{ color: colors.muted, marginTop: 6 }}>
              Choose the fare to use for your next cash ride. Commuters choose their own fare after scanning your QR.
            </Copy>
          </Card>
          <DriverFarePicker
            fares={fares}
            selectedFareCentavos={selectedFareCentavos}
            onSelect={(amountCentavos) => {
              setSelectedFareCentavos(amountCentavos);
              setCashFare(
                (amountCentavos / 100).toFixed(amountCentavos % 100 === 0 ? 0 : 2),
              );
              setError('');
            }}
          />
          {!fares.length && (
            <Card>
              <Copy>Fare prices will appear when TalaRide finishes loading them.</Copy>
            </Card>
          )}
        </View>
      )}

      {section === 'notifications' && (
        <View style={{ gap: 12, marginTop: 18 }}>
          <Card>
            <Title>Notifications</Title>
            <Copy style={{ color: colors.muted, marginTop: 6 }}>
              Confirmed payments and passenger lost-item reports appear here.
            </Copy>
          </Card>
          {notifications.length ? (
            notifications.map((item) => (
              <Card key={item.id}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                  <Icon
                    name={
                      item.kind === 'payment_confirmed'
                        ? 'checkmark-circle-outline'
                        : 'bag-handle-outline'
                    }
                    color={colors.green}
                  />
                  <View style={{ flex: 1 }}>
                    <Copy bold>{item.title}</Copy>
                    <Copy>{item.message}</Copy>
                    <Copy style={{ color: colors.muted, fontSize: 12, marginTop: 5 }}>
                      {readableDate(item.created_at)}
                    </Copy>
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <Card>
              <Copy>No notifications yet.</Copy>
            </Card>
          )}
        </View>
      )}

      {section === 'profile' && (
        <View style={{ gap: 12, marginTop: 18 }}>
          <Card>
            <View style={{ alignItems: 'center', gap: 10 }}>
              <View
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 46,
                  overflow: 'hidden',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: colors.paleGreen,
                }}
              >
                {displayedAvatar ? (
                  <Image source={{ uri: displayedAvatar }} style={{ width: 92, height: 92 }} />
                ) : (
                  <Icon name="person" size={50} color={colors.darkGreen} />
                )}
              </View>
              <Button
                label="Choose profile image"
                variant="outline"
                onPress={() => void chooseAvatar()}
              />
              {avatarDirty && (
                <Button
                  label={busy ? 'Saving…' : 'Save profile image'}
                  disabled={busy}
                  onPress={() => void saveAvatar()}
                />
              )}
            </View>
          </Card>
          <Card>
            <Detail icon="person-outline" label="Full name" value={driver.full_name} />
            <Detail
              icon="mail-outline"
              label="Email"
              value={session?.user.email || 'Not provided'}
            />
            {!!driver.mobile_number && (
              <Detail icon="call-outline" label="Mobile number" value={driver.mobile_number} />
            )}
            <Detail icon="card-outline" label="Driver code" value={driver.driver_code} />
            {!!driver.license_number && (
              <Detail
                icon="document-text-outline"
                label="License number"
                value={driver.license_number}
              />
            )}
            <Detail icon="shield-checkmark-outline" label="Verification" value="Verified" />
            {!!(driver.toda_group_id && driver.toda_operator) && (
              <Detail icon="people-outline" label="TODA group" value={driver.toda_operator} />
            )}
            {!!vehicle && (
              <Detail
                icon="car-outline"
                label="Tricycle"
                value={vehicle.plate_body_number || vehicle.vehicle_code}
              />
            )}
          </Card>
          <Button label="Sign out" variant="outline" onPress={() => void signOut()} />
        </View>
      )}

      {!!error && <Copy style={{ marginTop: 12, color: colors.red }}>{error}</Copy>}
    </PortalShell>
  );
}
