import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { View } from 'react-native';
import { Screen } from '@/components/Screen';
import { Button, Copy, Field, Header, Icon, Title, replace, s } from '@/components/ui';
import { MissingRide } from '@/components/MissingRide';
import { useMock } from '@/mocks/MockProvider';
import { colors } from '@/constants/theme';

export default function ReportLostItemScreen() {
  const { id = '1234' } = useLocalSearchParams<{ id?: string }>();
  const { rides, createRequest } = useMock();
  const ride = rides.find((item) => item.id === id);
  const [description, setDescription] = useState('');
  const [details, setDetails] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const submitted = useRef(false);
  if (!ride) return <MissingRide />;
  async function submit() {
    if (!description.trim()) {
      setError('Describe the item you lost.');
      return;
    }
    if (submitted.current) return;
    submitted.current = true;
    setSaving(true);
    setError('');
    try {
      await createRequest(ride!, description.trim(), details.trim());
      replace('/activity');
    } catch (cause) {
      submitted.current = false;
      setSaving(false);
      setError(cause instanceof Error ? cause.message : 'The request could not be created.');
    }
  }
  return (
    <Screen>
      <Header />
      <View style={{ alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <Icon name="bag-handle" size={60} color={colors.yellow} />
        <Title style={{ fontSize: 22 }}>What did you lose?</Title>
        <Copy style={{ textAlign: 'center', maxWidth: 310 }}>
          Create a request to help another passenger find your item.
        </Copy>
      </View>
      <View style={{ gap: 12 }}>
        <View>
          <Copy style={{ marginBottom: 6 }}>Item Description</Copy>
          <Field
            label="Item Description"
            placeholder="(e.g., bag, phone, wallet)"
            value={description}
            onChangeText={setDescription}
            maxLength={150}
            multiline
          />
        </View>
        <View>
          <Copy style={{ marginBottom: 6 }}>Additional Details (optional)</Copy>
          <Field
            label="Additional Details"
            placeholder="Color, brand, or other details"
            value={details}
            onChangeText={setDetails}
            maxLength={500}
            multiline
          />
        </View>
      </View>
      {!!error && (
        <Copy accessibilityRole="alert" style={{ color: colors.red, marginTop: 12 }}>
          {error}
        </Copy>
      )}
      <View style={[s.row, { alignItems: 'flex-start', marginTop: 32 }]}>
        <Icon name="information-circle-outline" />
        <Copy style={{ flex: 1, fontSize: 13, color: colors.muted }}>
          This request will be active for 7 days and only notify passengers who scan this vehicle
          after now.
        </Copy>
      </View>
      <View style={{ flex: 1, minHeight: 30 }} />
      <Button
        label={saving ? 'Creating Request…' : 'Create Request'}
        disabled={saving}
        onPress={submit}
      />
    </Screen>
  );
}
