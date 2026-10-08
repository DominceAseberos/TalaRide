import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { Share, View } from 'react-native';
import { Screen } from '@/components/Screen';
import {
  ActionRow,
  Button,
  Card,
  Copy,
  Detail,
  Field,
  Header,
  IconButton,
  Title,
  go,
  replace,
  s,
} from '@/components/ui';
import { ReferenceArt } from '@/components/ReferenceArt';
import { Notice } from '@/components/Notice';
import { MissingRide } from '@/components/MissingRide';
import { useMock } from '@/mocks/MockProvider';
import { formatDate } from '@/mocks/data';
import { colors } from '@/constants/theme';

export default function RideDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { rides, updateRide, deleteRide } = useMock();
  const ride = rides.find((item) => item.id === id);
  const [dialog, setDialog] = useState<'edit' | 'shareError' | 'delete' | 'menu' | null>(null);
  const [note, setNote] = useState('');
  const [location, setLocation] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  async function mutate(action: 'edit' | 'delete') {
    if (!ride || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    try {
      if (action === 'edit') await updateRide(ride.id, note.trim(), location.trim());
      else await deleteRide(ride.id);
      setDialog(null);
      if (action === 'delete') replace('/rides');
    } catch {
      setError('Your changes could not be saved. Please try again.');
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!ride) return <MissingRide />;
  function openEdit() {
    setNote(ride!.note);
    setLocation(ride!.location);
    setDialog('edit');
  }
  async function shareRide() {
    setDialog(null);
    try {
      await Share.share({
        title: 'TalaRide ride summary',
        message: [
          'TalaRide ride summary',
          `Ride: TR-${ride!.number.replace(/^TR-/i, '')}`,
          `Date: ${formatDate(ride!.date)}`,
          `Identifier: ${ride!.identifier}`,
        ].join('\n'),
      });
    } catch {
      setDialog('shareError');
    }
  }
  return (
    <Screen>
      <Header
        right={
          <View style={{ marginLeft: 'auto' }}>
            <IconButton
              name="ellipsis-vertical"
              label="Ride options"
              onPress={() => setDialog('menu')}
            />
          </View>
        }
      />
      <Card style={{ backgroundColor: colors.field, borderWidth: 0 }}>
        <View style={s.row}>
          <ReferenceArt name="thumbnail" width={70} />
          <View>
            <Title>TR-{ride.number.replace(/^TR-/i, '')}</Title>
            <Copy
              style={{
                color: colors.darkGreen,
                backgroundColor: colors.paleGreen,
                borderRadius: 7,
                paddingHorizontal: 8,
                paddingVertical: 2,
                alignSelf: 'flex-start',
                fontSize: 13,
              }}
            >
              {ride.identifier}
            </Copy>
          </View>
        </View>
      </Card>
      <View style={{ padding: 8, marginVertical: 10 }}>
        <Detail icon="bus-outline" label="Vehicle" value={ride.number} />
        <Detail icon="calendar-outline" label="Date" value={formatDate(ride.date)} />
        <Detail
          icon="pricetag-outline"
          label="Payment"
          value="Ride record (MVP: amount on receipt)"
        />
        <Detail
          icon="checkmark-circle-outline"
          label="Status"
          value="Completed · local + queued sync"
        />
        <Detail icon="document-text-outline" label="Note" value={ride.note || 'None'} />
        <Detail
          icon="location-outline"
          label="Approximate pickup"
          value={ride.location || 'Not saved'}
        />
      </View>
      <ActionRow
        icon="notifications"
        label="Report lost item"
        danger
        onPress={() => go(`/report-lost-item?id=${ride.id}`)}
      />
      <ActionRow
        icon="alert-circle-outline"
        label="Report ride issue"
        onPress={() => go(`/report-lost-item?id=${ride.id}`)}
      />
      <ActionRow icon="pencil-outline" label="Edit Note / Location" onPress={openEdit} />
      <ActionRow
        icon="share-social-outline"
        label="Share Ride"
        onPress={() => void shareRide()}
      />
      <View style={{ height: 12 }} />
      <ActionRow
        icon="trash-outline"
        label="Delete Ride"
        danger
        onPress={() => setDialog('delete')}
      />
      {dialog === 'edit' && (
        <Notice
          title="Edit Note / Location"
          message="Add optional details to this ride."
          onClose={() => setDialog(null)}
        >
          <Field
            label="Ride note"
            placeholder="Note (optional)"
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
          />
          <Field
            label="Ride location"
            placeholder="Location (optional)"
            value={location}
            onChangeText={setLocation}
            maxLength={150}
          />
          <Button label="Save Changes" disabled={busy} onPress={() => void mutate('edit')} />
          {!!error && <Copy accessibilityRole="alert">{error}</Copy>}
        </Notice>
      )}
      {dialog === 'shareError' && (
        <Notice
          title="Unable to share ride"
          message="The share sheet could not be opened. Please try again."
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'delete' && (
        <Notice
          title="Delete Ride?"
          message="Remove this ride and its linked local requests from My Rides?"
          onClose={() => setDialog(null)}
        >
          <Button label="Delete Ride" disabled={busy} onPress={() => void mutate('delete')} />
          {!!error && <Copy accessibilityRole="alert">{error}</Copy>}
        </Notice>
      )}
      {dialog === 'menu' && (
        <Notice
          title="Ride options"
          message={`Vehicle #${ride.number}`}
          onClose={() => setDialog(null)}
        >
          <ActionRow icon="pencil-outline" label="Edit Note / Location" onPress={openEdit} />
          <ActionRow
            icon="share-social-outline"
            label="Share Ride"
            onPress={() => void shareRide()}
          />
          <ActionRow
            icon="trash-outline"
            label="Delete Ride"
            danger
            onPress={() => setDialog('delete')}
          />
        </Notice>
      )}
    </Screen>
  );
}
