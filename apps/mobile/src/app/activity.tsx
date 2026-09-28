import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { BottomNav } from '@/components/BottomNav';
import { ActivityCard } from '@/components/ActivityCard';
import { Notice } from '@/components/Notice';
import { Button, Copy, go, s } from '@/components/ui';
import { useMock } from '@/mocks/MockProvider';
import { useNotifications } from '@/notifications/NotificationProvider';
import { formatDate } from '@/mocks/data';
import { colors } from '@/constants/theme';
import type { Notification, RelayRequestStatus, RelayResponse } from '@/types/models';
import { useAuth } from '@/auth/AuthProvider';

function relayAvailability(notification: {
  kind?: Notification['kind'];
  matchId?: string;
  matchResponse?: RelayResponse | null;
  requestStatus?: RelayRequestStatus;
  expiresAt?: string;
}) {
  if (notification.kind !== 'relay_prompt' || !notification.matchId) return 'unavailable';
  if (notification.matchResponse === 'offered') return 'offered';
  if (notification.matchResponse === 'dismissed') return 'dismissed';
  if (notification.requestStatus === 'resolved') return 'resolved';
  if (
    notification.requestStatus === 'expired' ||
    !notification.expiresAt ||
    new Date(notification.expiresAt) <= new Date()
  )
    return 'expired';
  return notification.requestStatus === 'active' ? 'available' : 'unavailable';
}

export default function ActivityScreen() {
  const { session, recovery } = useAuth();
  const accountId = session && !recovery ? session.user.id : null;
  const account = useRef(accountId);
  useLayoutEffect(() => {
    account.current = accountId;
  }, [accountId]);
  const params = useLocalSearchParams<{ tab?: string }>();
  const tab = params.tab === 'notifications' ? 'Notifications' : 'Requests';
  const { requests, relayPrompts, respondToPrompt, resolveRequest, refreshRequests } = useMock();
  const notificationState = useNotifications();
  const [selectedState, setSelected] = useState<{
    accountId: string;
    title: string;
    message: string;
    rideId: string;
    requestId?: string;
    matchId?: string;
    kind?: Notification['kind'];
    matchResponse?: RelayResponse | null;
    requestStatus?: RelayRequestStatus;
    expiresAt?: string;
  } | null>(null);
  const selected = selectedState?.accountId === accountId ? selectedState : null;
  const [error, setError] = useState('');
  const [respondingAccount, setRespondingAccount] = useState<string | null>(null);
  const responding = respondingAccount === accountId;
  const responsePending = useRef<string | null>(null);
  const initialRefresh = useRef({
    requests: refreshRequests,
    notifications: notificationState.refresh,
  });
  useEffect(() => {
    void initialRefresh.current.requests().catch(() => {});
    void initialRefresh.current.notifications().catch(() => {});
  }, []);
  const currentRequest = selected
    ? requests.find(
        (item) =>
          item.id === selected.requestId &&
          (item.status === 'Active' || item.status === 'Helper responding'),
      )
    : undefined;
  return (
    <Screen
      style={{ paddingHorizontal: 12, paddingTop: 10 }}
      footer={<BottomNav active="Activity" />}
    >
      <View
        style={[
          s.row,
          { gap: 0, borderBottomWidth: 1, borderColor: colors.border, marginBottom: 16 },
        ]}
      >
        {['Requests', 'Notifications'].map((value) => (
          <Pressable
            key={value}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === value }}
            onPress={() => router.setParams({ tab: value.toLowerCase() })}
            style={{
              flex: 1,
              alignItems: 'center',
              paddingVertical: 14,
              borderBottomWidth: 2,
              borderBottomColor: tab === value ? colors.green : 'transparent',
            }}
          >
            <Copy bold={tab === value}>{value}</Copy>
          </Pressable>
        ))}
      </View>
      {tab === 'Requests' &&
        requests.map((request) => {
          const open = request.status === 'Active' || request.status === 'Helper responding';
          return (
            <ActivityCard
              key={request.id}
              title="Lost-item Request"
              icon={open ? 'notifications' : 'lock-closed'}
              tone={open ? 'active' : 'expired'}
              date={formatDate(request.date)}
              badge={request.status}
              onPress={() =>
                setSelected({
                  accountId: accountId!,
                  title: `Lost-item Request · ${request.status}`,
                  message: `${request.description}${request.details ? `\n${request.details}` : ''}\nExpires ${formatDate(request.expiresAt)}`,
                  rideId: request.rideId,
                  requestId: request.id,
                })
              }
            >
              <Copy style={{ fontSize: 14 }}>{request.description}</Copy>
            </ActivityCard>
          );
        })}
      {tab === 'Notifications' &&
        notificationState.notifications.map((notification) => {
          const request = requests.find((item) => item.id === notification.requestId);
          const prompt = relayPrompts.find((item) => item.requestId === notification.requestId);
          return (
            <ActivityCard
              key={notification.id}
              title={notification.title}
              icon="notifications"
              tone="found"
              unread={notification.unread}
              date={formatDate(notification.date)}
              onPress={() => {
                void notificationState.read(notification.id).catch(() => {});
                setSelected({
                  accountId: accountId!,
                  title: notification.title,
                  message:
                    notification.kind === 'relay_prompt' && notification.description
                      ? `${notification.description}${notification.details ? `\n${notification.details}` : ''}\nYour personal contact details remain private.`
                      : notification.message,
                  rideId: request?.rideId ?? prompt?.rideId ?? '',
                  requestId: notification.requestId,
                  matchId: notification.matchId,
                  kind: notification.kind,
                  matchResponse: notification.matchResponse,
                  requestStatus: notification.requestStatus,
                  expiresAt: notification.expiresAt,
                });
              }}
            >
              <Copy style={{ fontSize: 14, color: colors.muted }}>{notification.message}</Copy>
            </ActivityCard>
          );
        })}
      {tab === 'Notifications' && notificationState.error && (
        <Copy accessibilityRole="alert" style={{ color: colors.red }}>
          {notificationState.error}
        </Copy>
      )}
      {!(tab === 'Requests' ? requests.length : notificationState.notifications.length) && (
        <Copy style={{ textAlign: 'center', marginTop: 30, color: colors.muted }}>
          No {tab.toLowerCase()} yet.
        </Copy>
      )}
      {selected && (
        <Notice
          title={selected.title}
          message={selected.message}
          onClose={() => {
            if (responsePending.current === accountId) return;
            setSelected(null);
            setError('');
          }}
        >
          {!!error && (
            <Copy accessibilityRole="alert" style={{ color: colors.red }}>
              {error}
            </Copy>
          )}
          {!!selected.rideId && (
            <Button
              label="View Ride"
              onPress={() => {
                const id = selected.rideId;
                setSelected(null);
                go(`/ride/${id}`);
              }}
            />
          )}
          {currentRequest && (
            <Button
              label="Mark as Resolved"
              variant="subtle"
              onPress={async () => {
                try {
                  await resolveRequest(currentRequest.id);
                  setSelected(null);
                } catch (cause) {
                  setError(
                    cause instanceof Error ? cause.message : 'The request could not be resolved.',
                  );
                }
              }}
            />
          )}
          {relayAvailability(selected) === 'offered' && <Copy>You offered assistance.</Copy>}
          {relayAvailability(selected) === 'dismissed' && <Copy>You declined assistance.</Copy>}
          {relayAvailability(selected) === 'resolved' && <Copy>This request is closed.</Copy>}
          {relayAvailability(selected) === 'expired' && <Copy>This request has expired.</Copy>}
          {relayAvailability(selected) === 'unavailable' && selected.kind === 'relay_prompt' && (
            <Copy>This assistance prompt is no longer available.</Copy>
          )}
          {relayAvailability(selected) === 'available' && (
            <Button
              label={responding ? 'Sending…' : 'Offer Assistance'}
              disabled={responding}
              onPress={async () => {
                const actionAccount = accountId;
                if (!actionAccount || responsePending.current === actionAccount) return;
                responsePending.current = actionAccount;
                setRespondingAccount(actionAccount);
                setError('');
                try {
                  await respondToPrompt(selected.matchId!, 'offered');
                  if (account.current === actionAccount) {
                    setSelected(null);
                    void notificationState.refresh().catch(() => {});
                  }
                } catch (cause) {
                  if (account.current === actionAccount)
                    setError(
                      cause instanceof Error ? cause.message : 'Your response could not be sent.',
                    );
                } finally {
                  if (responsePending.current === actionAccount) responsePending.current = null;
                  if (account.current === actionAccount) setRespondingAccount(null);
                }
              }}
            />
          )}
        </Notice>
      )}
    </Screen>
  );
}
