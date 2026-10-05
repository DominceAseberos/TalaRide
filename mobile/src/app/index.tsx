import { Animated, Easing, Text, useWindowDimensions, View } from 'react-native';
import { TalaIllustration } from '@/components/TalaIllustration';
import { Screen } from '@/components/Screen';
import { useEffect, useState } from 'react';
import { replace } from '@/components/ui';
import { useMock } from '@/mocks/MockProvider';
import { colors } from '@/constants/theme';

export default function SplashScreen() {
  const { ready, onboardingComplete, signedIn } = useMock();
  const [fade] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(18));
  const [animationDone, setAnimationDone] = useState(false);
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
    const timer = setTimeout(() => {
      setAnimationDone(true);
    }, 2400);
    return () => clearTimeout(timer);
  }, [fade, rise]);

  useEffect(() => {
    if (animationDone && ready) {
      replace(!onboardingComplete ? '/onboarding' : signedIn ? '/home' : '/sign-in');
    }
  }, [animationDone, ready, onboardingComplete, signedIn]);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 480);
  return (
    <Screen scroll={false} style={{ padding: 0 }}>
      <Animated.View
        accessibilityLabel="TalaRide. Remember every ride."
        accessible
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: fade,
          transform: [{ translateY: rise }],
        }}
      >
        <TalaIllustration name="mark" width={92} />
        <View style={{ alignItems: 'center', marginTop: 14 }}>
          <Text style={{ fontSize: 42, fontWeight: '800', color: colors.darkGreen, letterSpacing: -1.5 }}>
            TalaRide
          </Text>
          <Text style={{ fontSize: 16, fontStyle: 'italic', color: colors.green }}>
            Remember every ride.
          </Text>
        </View>
      </Animated.View>
      <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
        <TalaIllustration name="splash" width={contentWidth} />
      </Animated.View>
    </Screen>
  );
}
