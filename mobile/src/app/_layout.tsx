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
import { Brand, Copy } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useAuth } from '@/auth/AuthProvider';

function AppStack() {
  const { ready, onboardingComplete, signedIn } = useMock();
  const { profile } = useAuth();
  // Protected routes are removed from the navigator, not just redirected after rendering.
  if (!ready)
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.white,
          gap: 20,
        }}
      >
        <Brand />
        <ActivityIndicator color={colors.green} accessibilityLabel="Restoring your session" />
        <Copy>Loading TalaRide�</Copy>
      </View>
    );
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'fade', animationDuration: 450 }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth-callback" />
      <Stack.Protected guard={!signedIn || profile?.role === 'passenger'}>
        <Stack.Screen name="v/[vehicle]" />
        <Stack.Screen name="ride-confirm" />
        <Stack.Screen name="payment-status" />
      </Stack.Protected>
      <Stack.Protected guard={!onboardingComplete}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={onboardingComplete && !signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
      <Stack.Protected guard={onboardingComplete && signedIn && profile?.role === 'passenger'}>
        {[
          'home', 'scan', 'scan-ride', 'confirm', 'rewards', 'receipt', 'rides',
          'ride/[id]', 'activity', 'profile', 'report-lost-item',
        ].map((name) => (
          <Stack.Screen key={name} name={name} />
        ))}
      </Stack.Protected>
      <Stack.Protected guard={onboardingComplete && signedIn && profile?.role === 'driver'}>
        <Stack.Screen name="driver-portal" />
        <Stack.Screen name="driver" />
      </Stack.Protected>
      <Stack.Protected guard={onboardingComplete && signedIn && ['admin', 'operator'].includes(profile?.role || '')}>
        <Stack.Screen name="staff-account" />
      </Stack.Protected>
      <Stack.Protected guard={onboardingComplete && signedIn && !profile}>
        <Stack.Screen name="role-access" />
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
