import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MockProvider, useMock } from '@/mocks/MockProvider';
import { useFonts } from 'expo-font';
import { Roboto_400Regular } from '@expo-google-fonts/roboto/400Regular';
import { Roboto_500Medium } from '@expo-google-fonts/roboto/500Medium';
import { Roboto_700Bold } from '@expo-google-fonts/roboto/700Bold';
import { useEffect } from 'react';
import { prepareScanCache } from '@/scan/draft';
import { AuthProvider } from '@/auth/AuthProvider';
import { ActivityIndicator, AppState, View } from 'react-native';
import { NotificationProvider } from '@/notifications/NotificationProvider';
import { triggerSync } from '@/api/sync';

function AppStack() {
  const { ready, onboardingComplete, signedIn } = useMock();
  // Protected routes are removed from the navigator, not just redirected after rendering.
  if (!ready)
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator accessibilityLabel="Restoring your session" />
      </View>
    );
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 450 }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth-callback" />
      <Stack.Screen name="v/[vehicle]" />
      <Stack.Screen name="ride-confirm" />
      <Stack.Screen name="payment-status" />
      <Stack.Protected guard={!onboardingComplete}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={onboardingComplete && !signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={onboardingComplete && signedIn}>
        {[
          'home',
          'scan',
          'scan-ride',
          'driver',
          'confirm',
          'rewards',
          'receipt',
          'rides',
          'ride/[id]',
          'activity',
          'profile',
          'report-lost-item',
        ].map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void prepareScanCache().catch(() => {});
    void triggerSync().catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void triggerSync().catch(() => {});
    });
    return () => sub.remove();
  }, []);
  // Render immediately with the platform font while the optional Roboto assets load.
  // This keeps every route available if a font asset is temporarily unavailable.
  useFonts({ Roboto_400Regular, Roboto_500Medium, Roboto_700Bold });
  return (
    <AuthProvider>
      <MockProvider>
        <NotificationProvider>
          <StatusBar style="dark" />
          <AppStack />
        </NotificationProvider>
      </MockProvider>
    </AuthProvider>
  );
}
