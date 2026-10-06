import { useEffect, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Screen } from '@/components/Screen';
import { Button, Card, Copy, Header, Title } from '@/components/ui';
import { QrImage } from '@/components/QrImage';
import { PaymentDisclaimer } from '@/components/Disclaimers';
import { DEFAULT_FARES, formatCentavos } from '@talaride/shared';
import { getPaymentMode } from '@/api/client';
import { createPaymentIntent, fetchPaymentStatus, statusToLabel } from '@/api/payments';
import { startShift } from '@/api/shifts';
import { fetchFares } from '@/api/fares';
import { createMockIntent, expireMockIntent, getMockStatus } from '@/payments/mock';
import { enqueueOutbox } from '@/offline/queue';
import { triggerSync } from '@/api/sync';
import { fetchDriverNotifications, type DriverNotification } from '@/api/drivers';
import { useAuth } from '@/auth/AuthProvider';
import { useMock } from '@/mocks/MockProvider';
import { colors } from '@/constants/theme';

export default function DriverScreen() {
  const { displayName } = useAuth();
  const { saveRide } = useMock();
  const mode = getPaymentMode();
  const [driverCode, setDriverCode] = useState('DR-000481');
  const [vehicleCode, setVehicleCode] = useState('TR-01842');
  const [shiftId, setShiftId] = useState('');
  const [amount, setAmount] = useState(3000);
  const [custom, setCustom] = useState('');
  const [qr, setQr] = useState('');
  const [paymentId, setPaymentId] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [todayCentavos, setTodayCentavos] = useState(0);
  const [cashMsg, setCashMsg] = useState('');
  const [fares, setFares] = useState(DEFAULT_FARES);
  const [driverNotifications, setDriverNotifications] = useState<DriverNotification[]>([]);
  const [lastNotificationAt, setLastNotificationAt] = useState('');

  useEffect(() => {
    void fetchFares()
      .then(setFares)
      .catch(() => {});
    void triggerSync().catch(() => {});
  }, []);

  useEffect(() => {
    let active = true;
    const poll = async () => {
      try {
        const result = await fetchDriverNotifications(
          driverCode.trim().toUpperCase(),
          lastNotificationAt || undefined,
        );
        if (!active || !result.notifications.length) return;
        setDriverNotifications((items) => [...result.notifications, ...items].slice(0, 20));
        setLastNotificationAt(result.notifications[0].created_at);
        Alert.alert(result.notifications[0].title, result.notifications[0].message);
      } catch {
        // Offline driver mode keeps working; the next interval retries.
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 10000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [driverCode, lastNotificationAt]);

  useEffect(() => {
    if (!expiresAt) return;
    const tick = () => {
      const left = Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setSecondsLeft(left);
      if (left <= 0) setStatus((s) => (s === 'confirmed' ? s : 'expired'));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  useEffect(() => {
    if (!paymentId || status === 'confirmed') return;
    let live = true;
    const poll = async () => {
      try {
        const s =
          mode === 'mock-local'
            ? await getMockStatus(paymentId)
            : (await fetchPaymentStatus(paymentId)).status;
        if (live) {
          setStatus(s);
          if (s === 'confirmed') setTodayCentavos((t) => t + amount);
        }
      } catch {}
    };
    void poll();
    const id = setInterval(() => void poll(), 2000);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [paymentId, status, amount, mode]);

  async function ensureShift(): Promise<string> {
    if (shiftId) return shiftId;
    if (mode === 'mock-local') {
      const demo = `shift-demo-${driverCode}`;
      setShiftId(demo);
      return demo;
    }
    const s = await startShift(
      driverCode.trim().toUpperCase(),
      vehicleCode.trim().toUpperCase(),
      `shift-${randomUUID()}`,
    );
    setShiftId(s.shift_id);
    return s.shift_id;
  }

  async function generate(nextAmount = amount) {
    setError('');
    setStatus('');
    setCashMsg('');
    try {
      if (mode === 'mock-local') {
        const intent = await createMockIntent(vehicleCode, nextAmount);
        setQr(intent.qrPayload);
        setPaymentId(intent.payment_id);
        setExpiresAt(intent.expiresAt);
        setStatus('awaiting_confirmation');
        return;
      }
      await ensureShift();
      const intent = await createPaymentIntent({
        driver_code: driverCode.trim().toUpperCase(),
        vehicle_code: vehicleCode.trim().toUpperCase(),
        amount_centavos: nextAmount,
        client_operation_id: `intent-${randomUUID()}`,
      });
      // Render backend qr_payload verbatim. Never resign locally.
      setQr(intent.qr_payload);
      setPaymentId(intent.payment_id);
      setExpiresAt(intent.expires_at);
      setStatus('awaiting_confirmation');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate QR. Record cash instead.');
    }
  }

  function applyCustom() {
    const pesos = Number(custom.replace(/[₱, ]/g, ''));
    if (!Number.isFinite(pesos) || pesos < 1 || pesos > 999900) {
      setError('Custom fare must be ₱1–₱999,900. Confirm with passenger first.');
      return;
    }
    const centavos = Math.round(pesos * 100);
    setAmount(centavos);
    setError('');
  }

  async function recordCash() {
    setError('');
    setCashMsg('');
    try {
      const code = vehicleCode.trim().toUpperCase();
      const rideId = await saveRide(code, 'Body #');
      const op = `cash-${rideId}`;
      if (mode === 'mock-local') {
        await enqueueOutbox(op, 'cash_ride', {
          client_operation_id: op,
          local_ride_id: rideId,
          driver_code: driverCode.trim().toUpperCase(),
          shift_id: shiftId,
          vehicle_code: code,
          amount_centavos: amount,
        });
      } else {
        try {
          const sid = await ensureShift();
          await enqueueOutbox(op, 'cash_ride', {
            client_operation_id: op,
            local_ride_id: rideId,
            driver_code: driverCode.trim().toUpperCase(),
            shift_id: sid,
            vehicle_code: code,
            amount_centavos: amount,
          });
          await triggerSync().catch(() => {});
        } catch {
          await enqueueOutbox(op, 'cash_ride', {
            client_operation_id: op,
            local_ride_id: rideId,
            driver_code: driverCode.trim().toUpperCase(),
            shift_id: shiftId,
            vehicle_code: code,
            amount_centavos: amount,
          });
        }
      }
      setCashMsg(`Cash ${formatCentavos(amount)} recorded — syncs when online.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cash record failed.');
    }
  }

  return (
    <Screen>
      <Header title="Driver" />
      <TextInput
        accessibilityLabel="Driver code"
        value={driverCode}
        onChangeText={(v) => setDriverCode(v.toUpperCase())}
        autoCapitalize="characters"
        maxLength={9}
        style={{ borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8, fontSize: 16 }}
      />
      <Title style={{ fontSize: 34, marginTop: 8 }}>{vehicleCode}</Title>
      <Copy style={{ marginTop: 4 }}>
        Driver: {displayName} ·{' '}
        {mode === 'live' ? 'LIVE' : mode === 'mock-server' ? 'DEMO SERVER' : 'DEMO LOCAL'}
        {shiftId ? ` · Shift ${shiftId.slice(0, 8)}` : ' · No shift yet'}
      </Copy>
      {driverNotifications.length > 0 && (
        <Card style={{ marginTop: 12, backgroundColor: colors.paleGreen }}>
          <Copy bold style={{ color: colors.darkGreen }}>Driver notifications</Copy>
          <Copy style={{ marginTop: 4 }}>{driverNotifications[0].message}</Copy>
          <Copy style={{ marginTop: 2, color: colors.muted, fontSize: 12 }}>
            {driverNotifications.length} recent notification{driverNotifications.length === 1 ? '' : 's'}
          </Copy>
        </Card>
      )}
      <TextInput
        accessibilityLabel="Vehicle code"
        value={vehicleCode}
        onChangeText={(v) => setVehicleCode(v.toUpperCase())}
        autoCapitalize="characters"
        maxLength={8}
        style={{ borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8, fontSize: 22 }}
      />
      <Copy bold style={{ marginTop: 16 }}>
        CASH FARE / DRIVER RECORD
      </Copy>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {fares.map((f) => (
          <Pressable
            key={f.id}
            accessibilityRole="button"
            onPress={() => {
              setAmount(f.amountCentavos);
              setCustom('');
            }}
            style={{
              paddingVertical: 12,
              paddingHorizontal: 16,
              borderRadius: 10,
              backgroundColor: amount === f.amountCentavos ? colors.green : colors.paleGreen,
            }}
          >
            <Copy bold style={{ color: amount === f.amountCentavos ? colors.white : colors.darkGreen }}>
              {f.label}
            </Copy>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TextInput
          accessibilityLabel="Custom fare pesos"
          value={custom}
          onChangeText={setCustom}
          keyboardType="numeric"
          placeholder="Custom ₱ e.g. 120"
          style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }}
        />
        <Button label="Custom" onPress={applyCustom} />
      </View>
      {!!error && <Copy style={{ color: colors.red, marginTop: 8 }}>{error}</Copy>}
      {mode === 'live' ? (
        <Card style={{ marginTop: 16 }}>
          <Copy bold>PERMANENT VEHICLE QR</Copy>
          <Copy style={{ marginTop: 6 }}>
            Passengers scan the fixed TalaRide sticker on this vehicle. They choose or enter the
            fare and payment method on their own phone. Do not generate an expiring payment QR.
          </Copy>
          <View style={{ marginTop: 12 }}>
            <Button
              label={shiftId ? 'Shift active' : 'Start shift'}
              variant={shiftId ? 'subtle' : 'outline'}
              disabled={!!shiftId}
              onPress={() =>
                void ensureShift().catch((e) =>
                  setError(e instanceof Error ? e.message : 'Could not start shift.'),
                )
              }
            />
          </View>
        </Card>
      ) : (
        <>
          <Copy bold style={{ marginTop: 16 }}>
            DEMO PAYMENT QR
          </Copy>
          <View style={{ marginTop: 8, gap: 12 }}>
            <Button
              label={'Generate demo QR — ' + formatCentavos(amount)}
              onPress={() => generate()}
            />
            {!!qr && (
              <View style={{ alignItems: 'center', gap: 8 }}>
                <QrImage value={qr} />
                <Copy bold>
                  {status === 'confirmed'
                    ? '✓ PAID'
                    : statusToLabel(status) +
                      (status === 'awaiting_confirmation' || status === 'initiated'
                        ? ' ' + formatCentavos(amount) + ' · ' + secondsLeft + 's'
                        : '')}
                </Copy>
                <Copy style={{ fontSize: 12 }}>
                  DEMO only — no money moves. Single-use, 5-minute expiry.
                </Copy>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button label="New demo QR" variant="outline" onPress={() => generate()} />
                  {mode === 'mock-local' && (
                    <Button
                      label="Expire"
                      variant="subtle"
                      onPress={() =>
                        paymentId && expireMockIntent(paymentId).then(() => setStatus('expired'))
                      }
                    />
                  )}
                </View>
              </View>
            )}
          </View>
        </>
      )}
      <Copy bold style={{ marginTop: 16 }}>
        CASH
      </Copy>
      <View style={{ marginTop: 8, gap: 8 }}>
        <Button
          label={`Record cash ${formatCentavos(amount)}`}
          variant="outline"
          onPress={recordCash}
        />
        {!!cashMsg && <Copy style={{ color: colors.darkGreen }}>{cashMsg}</Copy>}
      </View>
      {mode !== 'live' && (
        <Copy bold style={{ marginTop: 16 }}>
          Demo digital total: {formatCentavos(todayCentavos)}
        </Copy>
      )}
      <View style={{ marginTop: 8 }}>
        <PaymentDisclaimer />
      </View>
    </Screen>
  );
}
