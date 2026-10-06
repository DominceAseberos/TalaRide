import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button, Card, Copy, Header, Icon, Title, replace } from '@/components/ui';
import { colors } from '@/constants/theme';
import { formatCentavos } from '@talaride/shared';
import { fetchPaymentStatus, statusToLabel } from '@/api/payments';

export default function PaymentStatusScreen() {
  const { payment_id } = useLocalSearchParams<{ payment_id?: string }>();
  const id = String(payment_id ?? '');
  const [status, setStatus] = useState(id ? 'loading' : 'missing');
  const [amountCentavos, setAmountCentavos] = useState(0);
  const [error, setError] = useState('');
  const [testPayment, setTestPayment] = useState(false);

  async function refresh() {
    if (!id) return;
    setError('');
    try {
      const result = await fetchPaymentStatus(id);
      setStatus(result.status);
      setTestPayment(result.payment_environment === 'test');
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
        setAmountCentavos(result.amount_centavos);
        settled = ['confirmed', 'failed', 'refunded', 'reversed'].includes(result.status);
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

  const confirmed = status === 'confirmed';

  return (
    <Screen>
      <Header title="Payment status" />
      {testPayment && <Card><Copy bold>PayMongo test payment — no real money was charged.</Copy></Card>}

      {confirmed ? (
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
            <Title style={{ fontSize: 24 }}>{testPayment ? 'Test payment successful' : 'Payment successful'}</Title>
            {amountCentavos > 0 && (
              <Title style={{ color: colors.green }}>{formatCentavos(amountCentavos)}</Title>
            )}
            <Copy style={{ textAlign: 'center', color: colors.muted }}>
              {testPayment ? 'Test confirmation received from PayMongo.' : 'Provider confirmation received. This ride is paid.'}
            </Copy>
          </View>

          <Card style={{ marginTop: 18 }}>
            <Copy style={{ fontSize: 12, color: colors.muted }}>Payment ID</Copy>
            <Copy bold style={{ marginTop: 4 }}>{id}</Copy>
          </Card>

          <Card style={{ marginTop: 12, backgroundColor: colors.paleGreen }}>
            <Copy bold style={{ color: colors.darkGreen }}>Rewards & vouchers</Copy>
            <Copy style={{ marginTop: 4, color: colors.muted }}>Coming soon.</Copy>
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
              If GCash or PayMongo is still open, finish the authorization there, then return to
              TalaRide. This screen checks automatically.
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
