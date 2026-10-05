import { useCallback, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Button, Copy, Header, Title, go } from '@/components/ui';
import { parseDynamicQr, parseVehicleQr } from '@talaride/shared';
import { decodeQrImageUri } from '@/scan/decodeImage';

export default function ScanRideScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState('');
  const [manual, setManual] = useState('');
  const [locked, setLocked] = useState(false);
  const [decoding, setDecoding] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setLocked(false);
      setError('');
      return undefined;
    }, []),
  );

  function routeScanned(data: string) {
    // Permanent vehicle QR is the MVP path. Legacy dynamic payment QR remains supported.
    try {
      const v = parseVehicleQr(data);
      go('/ride-confirm?vehicle_code=' + encodeURIComponent(v.vehicle_code) + '&c=' + v.c);
      return;
    } catch {}
    try {
      const dyn = parseDynamicQr(data);
      go('/ride-confirm?payload=' + encodeURIComponent(JSON.stringify(dyn)));
      return;
    } catch {
      setError('QR not recognized. Enter TR-00000 manually or ask driver for a new QR.');
      setLocked(false);
    }
  }

  function submitManual() {
    const code = manual.trim().toUpperCase();
    if (!/^TR-\d{5}$/.test(code)) {
      setError('Enter vehicle code like TR-01842.');
      return;
    }
    go(`/ride-confirm?vehicle_code=${encodeURIComponent(code)}`);
  }

  async function uploadQrImage() {
    if (decoding) return;
    setDecoding(true);
    setError('');
    try {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (picked.canceled) return;
      const uri = picked.assets[0]?.uri;
      if (!uri) throw new Error('No image selected.');
      const data = await decodeQrImageUri(uri);
      routeScanned(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not decode this image.');
    } finally {
      setDecoding(false);
    }
  }

  return (
    <Screen>
      <Header title="Scan ride" />
      <Title style={{ fontSize: 20 }}>Scan vehicle QR</Title>
      <Copy style={{ marginTop: 6 }}>
        Scan the permanent TalaRide sticker. You will verify the driver, choose or enter the fare,
        then choose how to pay.
      </Copy>
      <View style={{ height: 280, borderRadius: 12, overflow: 'hidden', marginTop: 12 }}>
        {permission?.granted ? (
          <CameraView
            style={{ flex: 1 }}
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={(e) => {
              if (locked) return;
              setLocked(true);
              routeScanned(e.data);
            }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <Copy>Camera permission needed for QR scan.</Copy>
            <Button label="Allow camera" onPress={() => requestPermission()} />
          </View>
        )}
      </View>
      {!!error && <Copy style={{ color: '#B3261E', marginTop: 8 }}>{error}</Copy>}
      <View style={{ marginTop: 12 }}>
        <Button
          label={decoding ? 'Decoding image…' : 'Upload QR image instead'}
          variant="outline"
          disabled={decoding}
          onPress={uploadQrImage}
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
        <TextInput
          accessibilityLabel="Vehicle code manual"
          value={manual}
          onChangeText={(v) => setManual(v.toUpperCase())}
          placeholder="TR-01842"
          autoCapitalize="characters"
          maxLength={8}
          style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }}
        />
        <Button label="Use code" onPress={submitManual} />
      </View>
      <Pressable onPress={() => go('/scan')} style={{ marginTop: 12 }}>
        <Copy>Use OCR camera instead</Copy>
      </Pressable>
    </Screen>
  );
}
