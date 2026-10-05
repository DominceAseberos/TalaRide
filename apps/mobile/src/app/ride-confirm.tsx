import { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, TextInput, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button, Card, Copy, Detail, Header, Title, replace } from '@/components/ui';
import { colors } from '@/constants/theme';
import {
  formatCentavos,
  isDynamicQrExpired,
  parseDynamicQr,
  parsePesoToCentavos,
  type DynamicQr,
} from '@talaride/shared';
import { getPaymentMode } from '@/api/client';
import {
  claimPayment,
  confirmServerPayment,
  createPaymentIntent,
  fetchPaymentStatus,
  type PaymentMethod,
} from '@/api/payments';
import { fetchFares } from '@/api/fares';
import { fetchPublicVehicle, type PublicVehicle } from '@/api/vehicles';
import { confirmMockIntent, verifyMockPayload } from '@/payments/mock';
import { enqueueOutbox } from '@/offline/queue';
import { triggerSync } from '@/api/sync';
import { useMock } from '@/mocks/MockProvider';

const PAYMENT_OPTIONS: { id: PaymentMethod; label: string; subtitle: string }[] = [
  { id: 'gcash', label: 'GCash', subtitle: 'E-wallet' },
  { id: 'maya', label: 'Maya', subtitle: 'E-wallet' },
  { id: 'card', label: 'Card', subtitle: 'Visa / Mastercard' },
  { id: 'qrph', label: 'QR Ph', subtitle: 'Bank / wallet' },
];

export default function RideConfirmScreen() {
  const { payload, vehicle_code, c } = useLocalSearchParams<{
    payload?: string;
    vehicle_code?: string;
    c?: string;
  }>();
  const { saveRide } = useMock();
  const mode = getPaymentMode();

  const [dynamic, setDynamic] = useState<DynamicQr | null>(null);
  const [vehicle, setVehicle] = useState<PublicVehicle | null>(null);
  const [fares, setFares] = useState<{ id: string; label: string; amountCentavos: number }[]>(
    [],
  );
  const [presetFare, setPresetFare] = useState<number | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customFare, setCustomFare] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [verifying, setVerifying] = useState(Boolean(!payload && vehicle_code && c));
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!payload) return;
    (async () => {
      try {
        const raw = typeof payload === 'string' ? JSON.parse(payload) : (payload as unknown);
        const text = typeof raw === 'string' ? raw : JSON.stringify(raw);
        const parsed = parseDynamicQr(text.startsWith('{') ? text : JSON.stringify(raw));
        if (parsed.v !== 1 || !parsed.payment_id || !parsed.sig) {
          throw new Error('Unsupported payment QR. Scan the permanent vehicle sticker instead.');
        }
        if (isDynamicQrExpired(parsed)) {
          setError('This old payment QR expired. Scan the permanent vehicle sticker instead.');
          return;
        }
        if (mode === 'mock-local') await verifyMockPayload(JSON.stringify(parsed));
        setDynamic(parsed);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Invalid QR.');
      }
    })();
  }, [payload, mode]);

  useEffect(() => {
    if (payload) return;
    const code = String(vehicle_code ?? '').trim().toUpperCase();
    if (!code) return;

    if (!c) return;

    let live = true;

    fetchPublicVehicle(code, String(c))
      .then((verifiedVehicle) => {
        if (!live) return;
        setVehicle(verifiedVehicle);
        setError('');
      })
      .catch((e) => {
        if (!live) return;
        setError(e instanceof Error ? e.message : 'Could not verify this TalaRide vehicle.');
      })
      .finally(() => {
        if (live) setVerifying(false);
      });

    fetchFares()
      .then((fareButtons) => {
        if (live) setFares(fareButtons);
      })
      .catch(() => {
        // Fare loading must not block vehicle verification.
      });

    return () => {
      live = false;
    };
  }, [payload, vehicle_code, c]);

  const amountCentavos = useMemo(() => {
    if (!customMode) return presetFare ?? 0;
    if (!customFare.trim()) return 0;
    try {
      return parsePesoToCentavos(customFare);
    } catch {
      return 0;
    }
  }, [customFare, customMode, presetFare]);

  const staticError =
    !payload && vehicle_code && !c
      ? 'For digital payment, scan the verified TalaRide vehicle QR sticker.'
      : error;

  const canProceed =
    !!vehicle?.driver_code &&
    vehicle.status === 'Active' &&
    vehicle.shift_status === 'Active' &&
    amountCentavos >= 100 &&
    !!paymentMethod &&
    !busy;

  function chooseFare(amount: number) {
    setPresetFare(amount);
    setCustomMode(false);
    setCustomFare('');
    setPaymentMethod(null);
    setError('');
  }

  function chooseCustom() {
    setPresetFare(null);
    setCustomMode(true);
    setPaymentMethod(null);
    setError('');
  }

  async function proceedStaticPayment() {
    if (!vehicle?.driver_code || !paymentMethod || !canProceed) return;
    setBusy(true);
    setError('');
    try {
      const intent = await createPaymentIntent({
        driver_code: vehicle.driver_code,
        vehicle_code: vehicle.vehicle_code,
        amount_centavos: amountCentavos,
        payment_method: paymentMethod,
      });
      if (!intent.checkout_url) {
        throw new Error('The payment provider did not return an authorization link.');
      }

      replace('/payment-status?payment_id=' + encodeURIComponent(intent.payment_id));
      await Linking.openURL(intent.checkout_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start payment.');
      setBusy(false);
    }
  }

  async function saveConfirmedRide() {
    if (!dynamic) return;
    const rideId = await saveRide(dynamic.vehicle_code, 'Body #');
    const op = 'pay-' + dynamic.payment_id;
    await enqueueOutbox(op, 'payment_confirm', {
      client_operation_id: op,
      payment_id: dynamic.payment_id,
      ride_id: dynamic.ride_id,
      local_ride_id: rideId,
      amount_centavos: dynamic.amount_centavos,
    });
    await triggerSync().catch(() => {});
    setDone('✓ RIDE PAID ' + formatCentavos(dynamic.amount_centavos) + ' — saved.');
  }

  async function confirmLegacyDigital() {
    if (!dynamic || busy) return;
    setBusy(true);
    setError('');
    try {
      if (mode === 'live') {
        await claimPayment(JSON.stringify(dynamic));
        const status = await fetchPaymentStatus(dynamic.payment_id);
        if (!status.checkout_url) {
          throw new Error('Payment authorization is unavailable. Scan the permanent vehicle QR.');
        }
        replace('/payment-status?payment_id=' + encodeURIComponent(dynamic.payment_id));
        await Linking.openURL(status.checkout_url);
        return;
      }
      if (mode === 'mock-local') await confirmMockIntent(dynamic.payment_id);
      else await confirmServerPayment(dynamic.payment_id);
      await saveConfirmedRide();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Payment failed. Pay cash instead.');
    } finally {
      setBusy(false);
    }
  }

  async function saveCheckin() {
    if (busy) return;
    setBusy(true);
    try {
      const code = String(vehicle_code ?? dynamic?.vehicle_code ?? '').toUpperCase();
      const rideId = await saveRide(code || 'TR-01842', 'Body #');
      const op = 'checkin-' + rideId;
      await enqueueOutbox(op, 'checkin', {
        client_operation_id: op,
        local_ride_id: rideId,
        vehicle_code: code,
      });
      await triggerSync().catch(() => {});
      replace('/receipt?id=' + encodeURIComponent(rideId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  if (dynamic) {
    return (
      <Screen>
        <Header title="Legacy payment QR" />
        <Title style={{ fontSize: 22 }}>Fare {formatCentavos(dynamic.amount_centavos)}</Title>
        <Copy style={{ marginTop: 6, color: colors.muted }}>
          Older expiring payment QR. New rides should use the permanent vehicle sticker.
        </Copy>
        <Card style={{ marginTop: 12 }}>
          <Detail icon="bus-outline" label="Vehicle" value={dynamic.vehicle_code} />
          <Detail icon="calendar-outline" label="Expires" value={dynamic.expires_at} />
          <Detail icon="document-text-outline" label="Payment ID" value={dynamic.payment_id} />
        </Card>
        {!!error && <Copy style={{ color: colors.red, marginTop: 8 }}>{error}</Copy>}
        {!!done && <Copy style={{ color: colors.green, marginTop: 8 }}>{done}</Copy>}
        <View style={{ gap: 10, marginTop: 16 }}>
          <Button
            label={busy ? 'Opening…' : 'Continue payment'}
            disabled={busy}
            onPress={confirmLegacyDigital}
          />
          <Button
            label="Save ride without payment"
            variant="outline"
            disabled={busy}
            onPress={saveCheckin}
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <Header title="Pay fare" />
      <Title style={{ fontSize: 22 }}>Scan • Choose fare • Pay</Title>
      <Copy style={{ marginTop: 5, color: colors.muted }}>
        No payment is created until you choose a fare, choose a payment method, and tap Proceed.
      </Copy>

      {verifying && (
        <Card style={{ marginTop: 14 }}>
          <Copy>Verifying TalaRide vehicle…</Copy>
        </Card>
      )}

      {vehicle && (
        <>
          <Card style={{ marginTop: 14 }}>
            <Copy bold style={{ color: colors.green }}>
              ✓ Verified driver
            </Copy>
            <Detail icon="person-outline" label="Driver" value={vehicle.driver_name} />
            <Detail
              icon="bus-outline"
              label="Vehicle"
              value={vehicle.vehicle_code + ' • Body ' + vehicle.plate_body_number}
            />
            <Detail icon="location-outline" label="TODA" value={vehicle.toda} />
            <Detail icon="radio-button-on-outline" label="Shift" value={vehicle.shift_status} />
          </Card>

          <Card style={{ marginTop: 12 }}>
            <Copy bold>1. Choose fare</Copy>
            <Copy style={{ marginTop: 3, fontSize: 12, color: colors.muted }}>
              Select a fare or enter the exact amount.
            </Copy>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {fares.slice(0, 5).map((fare) => {
                const selected = !customMode && presetFare === fare.amountCentavos;
                return (
                  <Pressable
                    key={fare.id}
                    accessibilityRole="button"
                    accessibilityLabel={'Fare ' + fare.label}
                    onPress={() => chooseFare(fare.amountCentavos)}
                    style={{
                      minWidth: 56,
                      alignItems: 'center',
                      paddingVertical: 11,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: selected ? colors.green : colors.border,
                      backgroundColor: selected ? colors.green : colors.field,
                    }}
                  >
                    <Copy bold style={{ color: selected ? colors.white : colors.ink }}>
                      {fare.label}
                    </Copy>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Enter other fare"
                onPress={chooseCustom}
                style={{
                  justifyContent: 'center',
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: customMode ? colors.green : colors.border,
                }}
              >
                <Copy bold style={{ color: customMode ? colors.green : colors.ink }}>
                  Other
                </Copy>
              </Pressable>
              {customMode && (
                <TextInput
                  autoFocus
                  accessibilityLabel="Custom fare"
                  value={customFare}
                  onChangeText={(value) => {
                    setCustomFare(value.replace(/[^0-9.]/g, ''));
                    setPaymentMethod(null);
                  }}
                  keyboardType="decimal-pad"
                  placeholder="Enter ₱ amount"
                  style={{
                    flex: 1,
                    minHeight: 48,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: 10,
                    paddingHorizontal: 12,
                    color: colors.ink,
                  }}
                />
              )}
            </View>
            {customMode && customFare.length > 0 && amountCentavos === 0 && (
              <Copy style={{ marginTop: 8, color: colors.red, fontSize: 12 }}>
                Enter a valid fare of at least ₱1.
              </Copy>
            )}
          </Card>

          <Card style={{ marginTop: 12, opacity: amountCentavos >= 100 ? 1 : 0.55 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <Copy bold>2. Select payment</Copy>
              {amountCentavos >= 100 && (
                <Copy bold style={{ color: colors.green }}>
                  {formatCentavos(amountCentavos)}
                </Copy>
              )}
            </View>
            {amountCentavos < 100 ? (
              <Copy style={{ marginTop: 8, color: colors.muted }}>Choose or enter the fare first.</Copy>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                {PAYMENT_OPTIONS.map((option) => {
                  const selected = paymentMethod === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityLabel={option.label}
                      onPress={() => setPaymentMethod(option.id)}
                      style={{
                        width: '48%',
                        minHeight: 58,
                        justifyContent: 'center',
                        padding: 11,
                        borderWidth: 1,
                        borderColor: selected ? colors.green : colors.border,
                        borderRadius: 10,
                        backgroundColor: selected ? colors.paleGreen : colors.field,
                      }}
                    >
                      <Copy bold style={{ color: selected ? colors.green : colors.ink }}>
                        {option.label}
                      </Copy>
                      <Copy style={{ fontSize: 11, color: colors.muted }}>{option.subtitle}</Copy>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Card>

          {!!error && <Copy style={{ color: colors.red, marginTop: 10 }}>{error}</Copy>}

          <View style={{ gap: 10, marginTop: 14 }}>
            <Button
              label={
                busy
                  ? 'Starting payment…'
                  : amountCentavos < 100
                    ? '3. Choose fare first'
                    : !paymentMethod
                      ? '3. Select payment'
                      : '3. Proceed • ' +
                        formatCentavos(amountCentavos) +
                        ' • ' +
                        PAYMENT_OPTIONS.find((item) => item.id === paymentMethod)?.label
              }
              disabled={!canProceed}
              onPress={proceedStaticPayment}
            />
            <Button
              label="Save ride without payment"
              variant="outline"
              disabled={busy}
              onPress={saveCheckin}
            />
          </View>

          <Copy style={{ marginTop: 10, textAlign: 'center', fontSize: 11, color: colors.muted }}>
            Your fare and payment method are locked only after you tap Proceed. TalaRide marks the
            ride paid only after provider confirmation.
          </Copy>
        </>
      )}

      {!vehicle && !verifying && (
        <>
          {!!staticError && (
            <Copy style={{ color: colors.red, marginTop: 14 }}>{staticError}</Copy>
          )}
          <View style={{ gap: 10, marginTop: 16 }}>
            <Button
              label={busy ? 'Saving…' : 'Save ride without digital payment'}
              variant="outline"
              disabled={busy}
              onPress={saveCheckin}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
