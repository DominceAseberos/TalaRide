import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import { Image, Pressable, TextInput, useWindowDimensions, View } from 'react-native';
import { Screen } from '@/components/Screen';
import { clearDraft, useScanDraft } from '@/scan/draft';
import { Button, Copy, Header, Icon, Title, replace, s } from '@/components/ui';
import { colors, fonts } from '@/constants/theme';
import { useMock } from '@/mocks/MockProvider';
import type { IdentifierType } from '@/types/models';
import { NumpadInput } from '@/components/NumpadInput';

export default function ConfirmScreen() {
  const draft = useScanDraft();
  const mounted = useRef(false);
  const [number, setNumber] = useState(draft?.candidates[0] ?? '');
  useEffect(() => {
    mounted.current = true;
    const id = draft?.id;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (id && !mounted.current) clearDraft(id);
      });
    };
  }, [draft?.id]);
  const [identifier, setIdentifier] = useState<IdentifierType>('MTOP');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const input = useRef<TextInput>(null);
  const saveLock = useRef(false);
  const { saveRide } = useMock();
  const { width } = useWindowDimensions();
  async function confirm() {
    const value = number.trim().toUpperCase();
    if (!/^[A-Z0-9][A-Z0-9 -]{0,14}$/.test(value)) {
      setError('Enter a vehicle number using up to 15 letters, numbers, spaces, or hyphens.');
      return;
    }
    if (saveLock.current) return;
    saveLock.current = true;
    setSaved(true);
    try {
      const id = await saveRide(value, identifier);
      if (draft?.id) clearDraft(draft.id);
      if (mounted.current) replace(`/receipt?id=${id}`);
    } catch {
      saveLock.current = false;
      setSaved(false);
      setError('Your ride could not be saved locally. Please try again.');
    }
  }
  return (
    <Screen>
      <Header />
      <Title style={{ fontSize: 22, marginBottom: 16 }}>
        {draft ? 'Confirm Vehicle Number' : 'Enter Body Number'}
      </Title>
      {draft ? (
        <>
          {draft.uri && (
            <Image
              source={{ uri: draft.uri }}
              accessibilityLabel="Captured vehicle"
              style={{
                width: Math.min(width - 64, 400),
                height: 180,
                borderRadius: 10,
                alignSelf: 'center',
                marginBottom: 18,
              }}
              resizeMode="contain"
            />
          )}
          {!!draft.message && <Copy style={{ marginBottom: 12 }}>{draft.message}</Copy>}
          {draft.candidates.length > 1 && (
            <View style={[s.row, { flexWrap: 'wrap', marginBottom: 12 }]}>
              {draft.candidates.map((candidate) => (
                <Pressable
                  key={candidate}
                  accessibilityRole="button"
                  disabled={saved}
                  accessibilityLabel={`Use recognized number ${candidate}`}
                  onPress={() => setNumber(candidate)}
                  style={{ padding: 8, borderRadius: 8, backgroundColor: colors.paleGreen }}
                >
                  <Copy>{candidate}</Copy>
                </Pressable>
              ))}
            </View>
          )}
          <Copy bold style={{ color: colors.darkGreen, marginBottom: 6 }}>
            Recognized Number
          </Copy>
          <View
            style={[
              s.row,
              {
                backgroundColor: colors.paleGreen,
                borderWidth: 1,
                borderColor: colors.border,
                borderRadius: 10,
                paddingHorizontal: 12,
              },
            ]}
          >
            <TextInput
              ref={input}
              accessibilityLabel="Recognized vehicle number"
              value={number}
              editable={!saved}
              onChangeText={setNumber}
              maxLength={15}
              autoCapitalize="characters"
              style={{
                flex: 1,
                minWidth: 0,
                textAlign: 'center',
                paddingVertical: 12,
                fontFamily: fonts.bold,
                fontSize: 26,
                color: colors.ink,
              }}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Edit vehicle number"
              onPress={() => input.current?.focus()}
              style={s.iconButton}
            >
              <Icon name="pencil-outline" size={20} color={colors.darkGreen} />
            </Pressable>
          </View>
        </>
      ) : (
        <NumpadInput value={number} onChange={setNumber} disabled={saved} />
      )}
      <Copy bold style={{ marginTop: 18, marginBottom: 8, color: colors.darkGreen }}>
        Identifier Type
      </Copy>
      <View style={[s.row, { gap: 6 }]}>
        {(['MTOP', 'Body #', 'Plate #'] as const).map((type) => (
          <Pressable
            key={type}
            disabled={saved}
            accessibilityRole="radio"
            accessibilityState={{ checked: identifier === type }}
            onPress={() => setIdentifier(type)}
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
              backgroundColor: identifier === type ? colors.green : colors.paleGreen,
              borderRadius: 8,
            }}
          >
            <Copy
              style={{ fontSize: 13, color: identifier === type ? colors.white : colors.muted }}
            >
              {type}
            </Copy>
          </Pressable>
        ))}
      </View>
      {!!error && (
        <Copy accessibilityRole="alert" style={{ color: colors.red, marginTop: 12 }}>
          {error}
        </Copy>
      )}
      <View style={{ gap: 12, marginTop: 32 }}>
        <Button
          label={draft ? 'Confirm and Save' : 'Save Ride'}
          disabled={saved}
          onPress={confirm}
        />
        {draft && (
          <Button
            label="Retake Scan"
            disabled={saved}
            icon="refresh-outline"
            variant="subtle"
            onPress={() => router.dismissTo('/scan')}
          />
        )}
      </View>
    </Screen>
  );
}
