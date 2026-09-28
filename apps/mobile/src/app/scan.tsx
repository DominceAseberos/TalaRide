import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, Platform, Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Button, Copy, IconButton, go, s } from '@/components/ui';
import { colors } from '@/constants/theme';
import { CaptureFrame } from '@/components/CaptureFrame';
import {
  clearDraft,
  discardCapture,
  prepareScanCache,
  publishDraft,
  retainScanPhoto,
} from '@/scan/draft';
import { recognizeVehicle } from '@/scan/ocr';

export default function ScanScreen() {
  const [permission, requestPermission, getPermission] = useCameraPermissions();
  const [flash, setFlash] = useState(false);
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const camera = useRef<CameraView>(null);
  const lock = useRef(false);
  const alive = useRef(true);
  const [focused, setFocused] = useState(true);
  const active = useRef(focused);
  useFocusEffect(
    useCallback(() => {
      active.current = true;
      lock.current = false;
      setBusy(false);
      setFocused(true);
      setReady(false);
      return () => {
        active.current = false;
        setFocused(false);
        setFlash(false);
      };
    }, []),
  );
  useEffect(() => {
    alive.current = true;
    void prepareScanCache().catch(() =>
      setError('Image storage is unavailable. You can enter a number manually.'),
    );
    const subscription = AppState.addEventListener('change', (state) => {
      setForeground(state === 'active');
      setReady(false);
      if (state === 'active') void getPermission().catch(() => {});
      else setFlash(false);
    });
    return () => {
      alive.current = false;
      subscription.remove();
    };
  }, [getPermission]);

  function manual() {
    if (lock.current) return;
    lock.current = true;
    clearDraft();
    go('/confirm');
  }
  async function scan(fromGallery: boolean) {
    if (lock.current || (!fromGallery && !ready)) return;
    lock.current = true;
    setBusy(true);
    setError('');
    let uri: string | undefined;
    let captureUri: string | undefined;
    let handedOff = false;
    try {
      if (fromGallery) {
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 1,
        });
        if (result.canceled) return;
        captureUri = result.assets[0]?.uri;
      } else {
        captureUri = (await camera.current?.takePictureAsync({ quality: 0.9, exif: false }))?.uri;
      }
      setFlash(false);
      if (!captureUri) throw new Error('No image was captured.');
      uri = await retainScanPhoto(captureUri);
      const recognition = await recognizeVehicle(uri);
      if (!alive.current || !active.current || AppState.currentState !== 'active') return;
      publishDraft({ uri, ...recognition });
      uri = undefined;
      handedOff = true;
      go('/confirm');
    } catch {
      if (alive.current)
        setError('The image could not be captured. Please retry or enter the number manually.');
    } finally {
      if (uri) void discardCapture(uri).catch(() => {});
      if (captureUri && (!handedOff || Platform.OS !== 'web'))
        void discardCapture(captureUri).catch(() => {});
      lock.current = handedOff;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#17241C' }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', padding: 20 }}>
        <View style={[s.row, { justifyContent: 'space-between' }]}>
          <IconButton
            name="close"
            label="Close scanner"
            color={colors.white}
            onPress={() => {
              active.current = false;
              clearDraft();
              router.dismissTo('/home');
            }}
          />
          <IconButton
            name={flash ? 'flash' : 'flash-outline'}
            label={flash ? 'Turn flashlight off' : 'Turn flashlight on'}
            color={flash ? colors.yellow : colors.white}
            onPress={() => {
              if (!busy && facing === 'back') setFlash(!flash);
            }}
          />
        </View>
        <View
          style={{ backgroundColor: colors.green, borderRadius: 10, padding: 12, marginTop: 8 }}
        >
          <Copy bold style={{ color: colors.white, textAlign: 'center' }}>
            Scan the Vehicle
          </Copy>
        </View>
        <View
          style={{
            flex: 1,
            minHeight: 260,
            marginVertical: 16,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          {permission?.granted && focused && foreground ? (
            <CameraView
              ref={camera}
              style={{ flex: 1 }}
              facing={facing}
              enableTorch={flash && facing === 'back'}
              mode="picture"
              onCameraReady={() => setReady(true)}
              onMountError={() => {
                setReady(false);
                setError('The camera could not start. Reopen the scanner or use manual entry.');
              }}
            />
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', gap: 16 }}>
              <Copy style={{ color: colors.white, textAlign: 'center' }}>
                {permission
                  ? 'Allow camera access to scan a vehicle.'
                  : 'Checking camera permission…'}
              </Copy>
              {permission && (
                <Button
                  label={permission.canAskAgain ? 'Allow Camera' : 'Open Settings'}
                  onPress={() => {
                    void (
                      permission.canAskAgain ? requestPermission() : Linking.openSettings()
                    ).catch(() =>
                      setError('Camera permission could not be updated. Use manual entry.'),
                    );
                  }}
                />
              )}
            </View>
          )}
          {permission?.granted && focused && foreground && <CaptureFrame />}
          {busy && (
            <View
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: '#00000088',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <ActivityIndicator color={colors.white} />
              <Copy style={{ color: colors.white }}>Reading vehicle number…</Copy>
            </View>
          )}
        </View>
        <Copy
          style={{
            textAlign: 'center',
            color: colors.white,
            backgroundColor: '#00000066',
            padding: 12,
            borderRadius: 10,
          }}
        >
          Position the MTOP, body, or plate number within the frame.
        </Copy>
        {!!error && (
          <Copy accessibilityRole="alert" style={{ color: colors.white, marginTop: 8 }}>
            {error}
          </Copy>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: busy }}
          disabled={busy}
          onPress={manual}
          style={{ alignItems: 'center', paddingTop: 12 }}
        >
          <Copy bold style={{ color: colors.white }}>
            Enter number manually
          </Copy>
        </Pressable>
        <View style={[s.row, { justifyContent: 'space-between', paddingVertical: 24 }]}>
          <IconButton
            name="image-outline"
            label="Choose vehicle image"
            color={colors.white}
            onPress={() => void scan(true)}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Capture vehicle"
            accessibilityState={{ disabled: busy || !ready || !permission?.granted }}
            disabled={busy || !ready || !permission?.granted}
            onPress={() => void scan(false)}
            style={{
              borderWidth: 3,
              borderColor: colors.white,
              borderRadius: 36,
              padding: 5,
              opacity: busy || !ready ? 0.45 : 1,
            }}
          >
            <View
              style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: colors.white }}
            />
          </Pressable>
          <IconButton
            name="camera-reverse-outline"
            label="Switch camera"
            color={colors.white}
            onPress={() => {
              if (!busy) {
                setReady(false);
                setFlash(false);
                setFacing(facing === 'back' ? 'front' : 'back');
              }
            }}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
