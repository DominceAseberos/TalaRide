import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { BottomNav } from '@/components/BottomNav';
import { Notice } from '@/components/Notice';
import { ActionRow, Button, Copy, Field, Icon, go, s, type IconName } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useAuth } from '@/auth/AuthProvider';
import { useNotifications } from '@/notifications/NotificationProvider';
import { useMock } from '@/mocks/MockProvider';
import {
  applyUpdate,
  checkForUpdates,
  getCurrentAppVersion,
  type AvailableUpdate,
} from '@/updates/updateManager';

const settings: { label: string; icon: IconName; message: string }[] = [
  {
    label: 'Account Settings',
    icon: 'settings-outline',
    message:
      'Update your display name or permanently delete your TalaRide account and its cloud relay data.',
  },
  {
    label: 'Notifications',
    icon: 'notifications-outline',
    message:
      'Choose whether TalaRide may register this device for privacy-safe lost-item relay alerts.',
  },
  {
    label: 'Privacy & Data',
    icon: 'shield-checkmark-outline',
    message:
      'Your rides are saved locally on this device, including the vehicle number, date/time, and optional note/location. Ride history is not uploaded. Notification previews contain no item, vehicle, or contact details.',
  },
  {
    label: 'Help & Support',
    icon: 'help-circle-outline',
    message:
      'Scan a vehicle, confirm its number, and find your receipt in My Rides. If you left something behind, open the ride and choose Report Lost Item.',
  },
  {
    label: 'App Updates',
    icon: 'cloud-download-outline',
    message:
      'Check for TalaRide updates. Small app updates can install instantly and restart the app. Native Android updates download from the official TalaRide GitHub release and open the Android installer.',
  },
  {
    label: 'About TalaRide',
    icon: 'information-circle-outline',
    message:
      'TalaRide\nRemember every ride.\nPrivacy First · Community Driven · Safety Oriented\nBuilt for Tagum.',
  },
];
export default function ProfileScreen() {
  const { signOut, session, displayName, profileError, updateProfile, refreshProfile } = useAuth();
  const notificationState = useNotifications();
  const { rides, clearRideHistory, deleteAccount } = useMock();
  const [name, setName] = useState(displayName);
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<(typeof settings)[number] | null>(null);
  const [confirmation, setConfirmation] = useState<'history' | 'account' | null>(null);
  const [availableUpdate, setAvailableUpdate] = useState<AvailableUpdate | null>(null);
  const [updateMessage, setUpdateMessage] = useState('');
  return (
    <Screen footer={<BottomNav active="Account" />}>
      <View
        style={[
          s.row,
          {
            paddingVertical: 24,
            borderBottomWidth: 1,
            borderColor: colors.border,
            marginBottom: 4,
          },
        ]}
      >
        <View
          style={{
            width: 68,
            height: 68,
            borderRadius: 34,
            backgroundColor: colors.field,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="person-circle" size={66} color={colors.disabled} />
        </View>
        <View style={{ flex: 1 }}>
          <Copy bold style={{ fontSize: 18 }}>
            {displayName}
          </Copy>
          <Copy style={{ fontSize: 13, color: colors.muted, marginTop: 4 }}>
            {session?.user.email}
          </Copy>
        </View>
      </View>
      {!!profileError && (
        <>
          <Copy accessibilityRole="alert">{profileError}</Copy>
          <Button label="Retry profile" variant="subtle" onPress={() => void refreshProfile()} />
        </>
      )}
      {!!error && (
        <Copy accessibilityRole="alert" style={{ color: colors.red }}>
          {error}
        </Copy>
      )}
      {settings.map((setting) => (
        <ActionRow
          key={setting.label}
          icon={setting.icon}
          label={setting.label}
          onPress={() => {
            if (!busy) {
              setName(displayName);
              setError('');
              setSelected(setting);
            }
          }}
        />
      ))}
      <View style={{ marginTop: 4 }}>
        <ActionRow icon="car-outline" label="Driver mode" onPress={() => go('/driver')} />
        <ActionRow icon="gift-outline" label="Rewards" onPress={() => go('/rewards')} />
      </View>
      <View style={{ marginTop: 12 }}>
        <ActionRow
          icon="trash-outline"
          label={busy ? 'Please wait…' : 'Sign Out'}
          danger
          onPress={() => {
            if (locked.current) return;
            locked.current = true;
            setBusy(true);
            setError('');
            void signOut()
              .catch((failure) => setError(failure.message))
              .finally(() => {
                locked.current = false;
                setBusy(false);
              });
          }}
        />
      </View>
      {selected && (
        <Notice
          title={selected.label}
          message={selected.message}
          onClose={() => {
            if (!busy) setSelected(null);
          }}
        >
          {selected.label === 'Account Settings' && (
            <>
              <Copy>{session?.user.email}</Copy>
              <Field
                label="Display name"
                value={name}
                onChangeText={setName}
                maxLength={80}
                editable={!busy}
              />
              {!!error && (
                <Copy accessibilityRole="alert" style={{ color: colors.red }}>
                  {error}
                </Copy>
              )}
              <Button
                label={busy ? 'Saving…' : 'Save Profile'}
                disabled={busy}
                onPress={() => {
                  if (locked.current) return;
                  locked.current = true;
                  setBusy(true);
                  setError('');
                  void updateProfile(name)
                    .then(() => setSelected(null))
                    .catch((failure) => setError(failure.message))
                    .finally(() => {
                      locked.current = false;
                      setBusy(false);
                    });
                }}
              />
              <Button
                label="Delete Account"
                variant="subtle"
                disabled={busy}
                onPress={() => {
                  setSelected(null);
                  setConfirmation('account');
                }}
              />
            </>
          )}
          {selected.label === 'Notifications' && (
            <>
              <Copy>
                Push alerts:{' '}
                {notificationState.enabled && notificationState.permission === 'granted'
                  ? 'Enabled'
                  : 'Disabled'}
              </Copy>
              <Copy style={{ color: colors.muted }}>
                Permission: {notificationState.permission}
              </Copy>
              {!!error && (
                <Copy accessibilityRole="alert" style={{ color: colors.red }}>
                  {error}
                </Copy>
              )}
              <Button
                label={
                  busy
                    ? 'Please wait…'
                    : notificationState.enabled && notificationState.permission === 'granted'
                      ? 'Disable Push Alerts'
                      : 'Enable Push Alerts'
                }
                disabled={busy}
                onPress={() => {
                  if (locked.current) return;
                  locked.current = true;
                  setBusy(true);
                  setError('');
                  const action =
                    notificationState.enabled && notificationState.permission === 'granted'
                      ? notificationState.disable
                      : notificationState.enable;
                  void action()
                    .catch((failure) =>
                      setError(
                        failure instanceof Error
                          ? failure.message
                          : 'Notification settings could not be changed.',
                      ),
                    )
                    .finally(() => {
                      locked.current = false;
                      setBusy(false);
                    });
                }}
              />
            </>
          )}
          {selected.label === 'App Updates' && (
            <>
              <Copy>
                Current version: <Copy bold>{getCurrentAppVersion()}</Copy>
              </Copy>
              <Copy style={{ color: colors.muted }}>
                OTA updates apply without reinstalling the APK. Native Android updates download
                inside TalaRide, then Android asks you to approve the package update.
              </Copy>
              {!!updateMessage && (
                <Copy style={{ color: colors.muted }}>{updateMessage}</Copy>
              )}
              {!!error && (
                <Copy accessibilityRole="alert" style={{ color: colors.red }}>
                  {error}
                </Copy>
              )}
              <Button
                label={busy ? 'Checking…' : 'Check for Updates'}
                disabled={busy}
                icon="refresh-outline"
                onPress={() => {
                  if (locked.current) return;
                  locked.current = true;
                  setBusy(true);
                  setError('');
                  setAvailableUpdate(null);
                  setUpdateMessage('Checking TalaRide releases and OTA updates…');
                  void checkForUpdates()
                    .then((result) => {
                      setAvailableUpdate(result);
                      if (result.kind === 'none') {
                        setUpdateMessage('You already have the latest available update.');
                      } else if (result.kind === 'ota') {
                        setUpdateMessage(
                          'A lightweight TalaRide update is ready. It can install without a new APK.',
                        );
                      } else {
                        setUpdateMessage(
                          'TalaRide v' +
                            result.versionLabel +
                            ' is ready. Tap Install Update to download it inside the app.',
                        );
                      }
                    })
                    .catch((failure) =>
                      setError(
                        failure instanceof Error
                          ? failure.message
                          : 'TalaRide could not check for updates.',
                      ),
                    )
                    .finally(() => {
                      locked.current = false;
                      setBusy(false);
                    });
                }}
              />
              {availableUpdate && availableUpdate.kind !== 'none' && (
                <Button
                  label={
                    busy
                      ? 'Preparing Update…'
                      : availableUpdate.kind === 'ota'
                        ? 'Install Update & Restart'
                        : 'Install v' + availableUpdate.versionLabel
                  }
                  disabled={busy}
                  icon="cloud-download-outline"
                  onPress={() => {
                    if (locked.current) return;
                    locked.current = true;
                    setBusy(true);
                    setError('');
                    setUpdateMessage(
                      availableUpdate.kind === 'ota'
                        ? 'Downloading the update…'
                        : 'Downloading the APK. Android will ask you to approve the update.',
                    );
                    void applyUpdate(availableUpdate)
                      .catch((failure) =>
                        setError(
                          failure instanceof Error
                            ? failure.message
                            : 'TalaRide could not install the update.',
                        ),
                      )
                      .finally(() => {
                        locked.current = false;
                        setBusy(false);
                      });
                  }}
                />
              )}
            </>
          )}
          {selected.label === 'Privacy & Data' && (
            <>
              <Copy>{rides.length} ride records are stored locally for this account.</Copy>
              <Copy style={{ color: colors.muted }}>
                Clearing history does not delete active cloud lost-item requests. Resolve those in
                Activity first, or delete your account to remove its cloud data.
              </Copy>
              <Button
                label="Clear Local Ride History"
                variant="subtle"
                disabled={busy || rides.length === 0}
                onPress={() => {
                  setSelected(null);
                  setConfirmation('history');
                }}
              />
            </>
          )}
        </Notice>
      )}
      {confirmation && (
        <Notice
          title={confirmation === 'account' ? 'Delete Account?' : 'Clear Ride History?'}
          message={
            confirmation === 'account'
              ? 'This permanently deletes your account, profile, relay requests, responses, notifications, and registered push tokens. This account’s local rides will also be erased. This cannot be undone.'
              : `This permanently removes all ${rides.length} local ride records for this account from this device. This cannot be undone.`
          }
          onClose={() => {
            if (!busy) setConfirmation(null);
          }}
        >
          {!!error && (
            <Copy accessibilityRole="alert" style={{ color: colors.red }}>
              {error}
            </Copy>
          )}
          <Button
            label={
              busy
                ? 'Please wait…'
                : confirmation === 'account'
                  ? 'Permanently Delete Account'
                  : 'Permanently Clear History'
            }
            disabled={busy}
            onPress={() => {
              if (locked.current) return;
              locked.current = true;
              setBusy(true);
              setError('');
              const action = confirmation === 'account' ? deleteAccount() : clearRideHistory();
              void action
                .then(() => setConfirmation(null))
                .catch((failure) =>
                  setError(failure instanceof Error ? failure.message : 'The request failed.'),
                )
                .finally(() => {
                  locked.current = false;
                  setBusy(false);
                });
            }}
          />
          <Button
            label="Cancel"
            variant="subtle"
            disabled={busy}
            onPress={() => setConfirmation(null)}
          />
        </Notice>
      )}
    </Screen>
  );
}
