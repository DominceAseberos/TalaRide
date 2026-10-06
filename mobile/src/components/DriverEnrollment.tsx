import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Card, Copy, Field, Title } from './ui';
import { colors } from '@/constants/theme';
import { apiRequest } from '@/api/client';

export type RegisteredDriver = {
  driver_code: string;
  full_name: string;
  verification_status: string;
  shift_status: string;
  toda_operator?: string;
  toda_group_id?: string | null;
};

export function DriverEnrollment({
  name,
  online,
  onRegistered,
}: {
  name: string;
  online: boolean;
  onRegistered: (driver: RegisteredDriver) => void;
}) {
  const [fullName, setFullName] = useState(name);
  const [phone, setPhone] = useState('');
  const [toda, setToda] = useState('');
  const [license, setLicense] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const locked = useRef(false);

  async function submit() {
    if (locked.current || !online) return;
    const details = {
      full_name: fullName.trim(),
      mobile_number: phone.trim(),
      toda_operator: toda.trim(),
      license_number: license.trim(),
    };
    if (
      details.full_name.length < 2 ||
      details.mobile_number.length < 10 ||
      details.toda_operator.length < 2 ||
      details.license_number.length < 3
    ) {
      setError('Complete your full name, mobile number, TODA group, and license number.');
      return;
    }
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      const result = await apiRequest<{ driver: RegisteredDriver }>('/drivers/enroll', {
        method: 'POST',
        body: JSON.stringify(details),
      });
      onRegistered(result.driver);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Could not save your registration. Please retry.',
      );
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  return (
    <Card>
      <Title>Register as a driver</Title>
      <Copy style={{ marginTop: 8, color: colors.muted }}>
        Use your existing TalaRide account. Submit your details here for verification by the
        TalaRide admin.
      </Copy>
      <View style={{ gap: 12, marginTop: 18 }}>
        <Field
          label="Full name"
          placeholder="Full name"
          value={fullName}
          onChangeText={setFullName}
          maxLength={100}
          editable={!busy}
          autoCapitalize="words"
        />
        <Field
          label="Mobile number"
          placeholder="Mobile number"
          value={phone}
          onChangeText={setPhone}
          maxLength={20}
          editable={!busy}
          keyboardType="phone-pad"
        />
        <Field
          label="TODA group"
          placeholder="TODA group"
          value={toda}
          onChangeText={setToda}
          maxLength={100}
          editable={!busy}
          autoCapitalize="words"
        />
        <Field
          label="License number"
          placeholder="License number"
          value={license}
          onChangeText={setLicense}
          maxLength={50}
          editable={!busy}
          autoCapitalize="characters"
        />
        {!!error && (
          <Copy accessibilityRole="alert" style={{ color: colors.red }}>
            {error}
          </Copy>
        )}
        {!online && <Copy>Connect to the internet to submit your registration.</Copy>}
        <Button
          label={busy ? 'Submitting…' : 'Submit for verification'}
          disabled={busy || !online}
          onPress={() => void submit()}
        />
        <Copy style={{ color: colors.muted, fontSize: 12 }}>
          The TalaRide admin approves your registration. Your TODA operator adds you to their group
          separately. Your QR appears after a registered vehicle is assigned.
        </Copy>
      </View>
    </Card>
  );
}
