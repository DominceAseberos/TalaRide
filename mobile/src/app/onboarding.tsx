import { Animated, Easing, Pressable, useWindowDimensions, View } from 'react-native';
import { useEffect, useState } from 'react';
import { Screen } from '@/components/Screen';
import { TalaIllustration, type IllustrationName } from '@/components/TalaIllustration';
import { Brand, Button, Copy, Title, replace } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useMock } from '@/mocks/MockProvider';

const pages = [
  {
    art: 'scan' as IllustrationName,
    eyebrow: 'FAST & VERIFIED',
    title: 'Scan the TalaRide QR',
    body: 'Scan the permanent vehicle sticker. TalaRide verifies the vehicle and active driver before you continue.',
  },
  {
    art: 'privacy' as IllustrationName,
    eyebrow: 'YOU STAY IN CONTROL',
    title: 'Choose fare, then pay',
    body: 'Pick the exact fare and payment method first. Nothing is created or charged until you tap Proceed.',
  },
  {
    art: 'community' as IllustrationName,
    eyebrow: 'RIDE HISTORY & REWARDS',
    title: 'Ride, earn, and keep track',
    body: 'Earn TalaPoints on eligible digital rides, then claim available vouchers in Rewards. Test vouchers are for preview only and cannot be spent. Your trip history also helps with lost-item follow-up.',
  },
] as const;

export default function OnboardingScreen() {
  const { completeOnboarding } = useMock();
  const [page, setPage] = useState(0);
  const [contentOpacity] = useState(() => new Animated.Value(1));
  const [contentX] = useState(() => new Animated.Value(0));
  const { width, height } = useWindowDimensions();
  const current = pages[page];

  function finish() {
    void completeOnboarding().finally(() => replace('/sign-in'));
  }

  useEffect(() => {
    contentOpacity.setValue(0);
    contentX.setValue(20);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentX, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentX, page]);

  const illustrationWidth = Math.min(width - 72, 300);
  const illustrationHeight = Math.min(Math.max(height * 0.31, 220), 310);

  return (
    <Screen
      scroll={false}
      style={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 }}
      footer={
        <View
          style={{
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: 18,
            backgroundColor: colors.background,
            borderTopWidth: 1,
            borderTopColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {page > 0 && (
              <Button
                label="Back"
                variant="outline"
                onPress={() => setPage((value) => Math.max(0, value - 1))}
                style={{ flex: 1 }}
              />
            )}
            <Button
              label={page === pages.length - 1 ? 'Continue to TalaRide' : 'Next'}
              onPress={() => (page < pages.length - 1 ? setPage(page + 1) : finish())}
              style={{ flex: page > 0 ? 1.65 : 1 }}
            />
          </View>
        </View>
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Brand />
        {page < pages.length - 1 && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip onboarding"
            onPress={finish}
            hitSlop={10}
            style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 6 }}
          >
            <Copy bold style={{ color: colors.green, fontSize: 13 }}>
              Skip
            </Copy>
          </Pressable>
        )}
      </View>

      <View style={{ marginTop: 22 }}>
        <View
          accessibilityLabel={'Step ' + (page + 1) + ' of ' + pages.length}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
        >
          <Copy bold style={{ fontSize: 12, color: colors.muted, minWidth: 42 }}>
            {page + 1} of {pages.length}
          </Copy>
          <View style={{ flex: 1, flexDirection: 'row', gap: 6 }}>
            {pages.map((item, index) => (
              <Pressable
                key={item.title}
                accessibilityRole="button"
                accessibilityLabel={'Go to onboarding page ' + (index + 1)}
                onPress={() => setPage(index)}
                hitSlop={8}
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 999,
                  backgroundColor: index <= page ? colors.green : colors.border,
                }}
              />
            ))}
          </View>
        </View>
      </View>

      <Animated.View
        style={{
          flex: 1,
          opacity: contentOpacity,
          transform: [{ translateX: contentX }],
          paddingTop: 18,
        }}
      >
        <View
          style={{
            minHeight: illustrationHeight,
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 28,
            backgroundColor: colors.paleGreen,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
          }}
        >
          <TalaIllustration name={current.art} width={illustrationWidth} />
        </View>

        <View style={{ marginTop: 24 }}>
          <Copy
            bold
            style={{
              fontSize: 11,
              lineHeight: 16,
              letterSpacing: 1.4,
              color: colors.green,
            }}
          >
            {current.eyebrow}
          </Copy>
          <Title style={{ marginTop: 8, fontSize: 28, lineHeight: 34, color: colors.darkGreen }}>
            {current.title}
          </Title>
          <Copy style={{ marginTop: 10, fontSize: 16, lineHeight: 24, color: colors.muted }}>
            {current.body}
          </Copy>
        </View>
      </Animated.View>
    </Screen>
  );
}
