import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button, Card, Copy, Header, Icon, Title, replace } from '@/components/ui';
import { colors } from '@/constants/theme';
import { formatCentavos } from '@talaride/shared';
import {
  confirmServerPayment,
  fetchPaymentStatus,
  statusToLabel,
  type PaymentMethod,
} from '@/api/payments';

export default function PaymentStatusScreen() {
  const { payment_id, simulate, method } = useLocalSearchParams<{
    payment_id?: string;
    simulate?: string;
    method?: string;
  }>();
  const id = String(payment_id ?? '');
  const simulationRequested = String(simulate ?? '') === '1';
  const selectedMethod = (['gcash', 'maya', 'card', 'qrph'].includes(String(method))
    ? String(method)
    : 'gcash') as PaymentMethod;
  const methodLabel =
    selectedMethod === 'gcash'
      ? 'GCash'
      : selectedMethod === 'maya'
        ? 'Maya'
        : selectedMethod === 'card'
          ? 'Card'
          : 'QR Ph';
  const [status, setStatus] = useState(id ? 'loading' : 'missing');
  const [amountCentavos, setAmountCentavos] = useState(0);
  const [error, setError] = useState('');
  const [testPayment, setTestPayment] = useState(false);
  const [simulated, setSimulated] = useState(simulationRequested);
  const [confirming, setConfirming] = useState(false);

  async function refresh() {
    if (!id) return;
    setError('');
    try {
      const result = await fetchPaymentStatus(id);
      setStatus(result.status);
      setTestPayment(result.payment_environment === 'test');
      setSimulated(result.payment_mode === 'mock');
      setAmountCentavos(result.amount_centavos);
    } catch (e) {
      setStatus('unknown');
      setError(e instanceof Error ? e.message : 'Could not check payment status.');
    }
  }

  useEffect(() => {
    if (!id) return;
    let live = true;
    let settled = false;
    const poll = async () => {
      if (settled) return;
      try {
        const result = await fetchPaymentStatus(id);
        if (!live) return;
        setStatus(result.status);
        setTestPayment(result.payment_environment === 'test');
        setSimulated(result.payment_mode === 'mock');
        setAmountCentavos(result.amount_centavos);
        settled = ['confirmed', 'failed', 'expired', 'cancelled', 'refunded', 'reversed'].includes(result.status);
      } catch {
        if (live) setError('Could not refresh payment status. Check again when connected.');
      }
    };
    void poll();
    const timer = setInterval(() => void poll(), 2000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [id]);

  async function confirmSimulation() {
    if (!id || confirming) return;
    setConfirming(true);
    setError('');
    try {
      await confirmServerPayment(id, selectedMethod);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not confirm simulated payment.');
    } finally {
      setConfirming(false);
    }
  }

  const confirmed = status === 'confirmed';
  const simulationCheckout =
    simulationRequested &&
    simulated &&
    !confirmed &&
    !['failed', 'expired', 'cancelled', 'refunded', 'reversed'].includes(status);

  return (
    <Screen>
      <Header title="Payment status" />
      {simulated ? (
        <Card><Copy bold>Simulated payment — no real money was charged.</Copy></Card>
      ) : testPayment ? (
        <Card><Copy bold>PayMongo test payment — no real money was charged.</Copy></Card>
      ) : null}

      {simulationCheckout ? (
        <>
          <Title style={{ fontSize: 24 }}>{methodLabel} — TalaRide Payment Simulation</Title>
          <Copy style={{ marginTop: 8, color: colors.muted }}>
            This is a TalaRide demo checkout. It does not connect to the real {methodLabel} app and
            will never ask for a real PIN, OTP, password, card number, or wallet credential.
          </Copy>

          <Card style={{ marginTop: 16 }}>
            <DetailRow label="Payment method" value={methodLabel + ' (simulated)'} />
            <DetailRow
              label="Amount"
              value={amountCentavos > 0 ? formatCentavos(amountCentavos) : 'Loading…'}
            />
            <DetailRow label="Payment ID" value={id} />
          </Card>

          <Card style={{ marginTop: 12, backgroundColor: colors.paleGreen }}>
            <Copy bold style={{ color: colors.darkGreen }}>SIMULATION — NO REAL MONEY</Copy>
            <Copy style={{ marginTop: 4, color: colors.muted }}>
              Confirming below runs the real TalaRide backend workflow: payment confirmation, ride
              completion, driver shift totals, rewards, receipt, TODA activity, and history.
            </Copy>
          </Card>

          {!!error && <Copy style={{ marginTop: 10, color: colors.red }}>{error}</Copy>}
          <View style={{ gap: 10, marginTop: 16 }}>
            <Button
              label={
                confirming
                  ? 'Processing simulation…'
                  : 'Pay ' +
                    (amountCentavos > 0 ? formatCentavos(amountCentavos) : '') +
                    ' — Simulation'
              }
              disabled={confirming || status === 'loading'}
              onPress={() => void confirmSimulation()}
            />
            <Button label="Cancel" variant="outline" disabled={confirming} onPress={() => replace('/home')} />
          </View>
        </>
      ) : confirmed ? (
        <>
          <View style={{ alignItems: 'center', marginTop: 18, gap: 10 }}>
            <View
              style={{
                width: 68,
                height: 68,
                borderRadius: 34,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: colors.green,
              }}
            >
              <Icon name="checkmark" size={46} color={colors.white} />
            </View>
            <Title style={{ fontSize: 24 }}>{simulated ? 'Simulated payment successful' : testPayment ? 'Test payment successful' : 'Payment successful'}</Title>
            {amountCentavos > 0 && (
              <Title style={{ color: colors.green }}>{formatCentavos(amountCentavos)}</Title>
            )}
            <Copy style={{ textAlign: 'center', color: colors.muted }}>
              {simulated ? 'TalaRide saved this simulation. No real money was charged.' : testPayment ? 'Test confirmation received from PayMongo.' : 'Provider confirmation received. This ride is paid.'}
            </Copy>
          </View>

          <Card style={{ marginTop: 18 }}>
            <Copy style={{ fontSize: 12, color: colors.muted }}>Payment ID</Copy>
            <Copy bold style={{ marginTop: 4 }}>{id}</Copy>
          </Card>

          <Card style={{ marginTop: 12, backgroundColor: colors.paleGreen }}>
            <Copy bold style={{ color: colors.darkGreen }}>Rewards & vouchers</Copy>
            <Copy style={{ marginTop: 4, color: colors.muted }}>Eligible completed rides are added to your backend reward balance. Open Rewards to see your current progress.</Copy>
          </Card>

          <View style={{ gap: 10, marginTop: 16 }}>
            <Button label="Done" onPress={() => replace('/home')} />
          </View>
        </>
      ) : (
        <>
          <Title style={{ fontSize: 22 }}>
            {status === 'loading' ? 'Checking…' : statusToLabel(status)}
          </Title>
          <Copy style={{ marginTop: 8 }}>
            Payment {id || '(missing id)'}. TalaRide only marks this paid after server/provider
            confirmation.
          </Copy>
          {!!error && <Copy style={{ marginTop: 8, color: colors.red }}>{error}</Copy>}
          <Card style={{ marginTop: 14 }}>
            <Copy style={{ color: colors.muted }}>
              {simulated
                ? 'This simulated payment is waiting for confirmation in TalaRide.'
                : 'If your payment provider is still open, finish authorization there, then return to TalaRide. This screen checks automatically.'}
            </Copy>
          </Card>
          <View style={{ marginTop: 14 }}>
            <Button label="Check again" onPress={() => refresh()} />
          </View>
        </>
      )}
    </Screen>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
      <Copy style={{ fontSize: 11, color: colors.muted }}>{label}</Copy>
      <Copy bold style={{ marginTop: 3 }}>{value}</Copy>
    </View>
  );
}
