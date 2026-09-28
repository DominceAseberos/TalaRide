import { Animated, Easing, Pressable, useWindowDimensions, View } from 'react-native';
import { useEffect, useState } from 'react';
import { Screen } from '@/components/Screen';
import { TalaIllustration, type IllustrationName } from '@/components/TalaIllustration';
import { Button, Copy, Title, replace, s } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useMock } from '@/mocks/MockProvider';

const pages = [
  {
    art: 'scan' as IllustrationName,
    title: 'Scan and Remember',
    body: 'Scan a tricycle or pedicab’s MTOP, body, or plate number and keep a private record of your ride.',
  },
  {
    art: 'privacy' as IllustrationName,
    title: 'Your Privacy Matters',
    body: 'Your ride records stay on your device. We only use the minimum data needed for lost-item assistance.',
  },
  {
    art: 'community' as IllustrationName,
    title: 'A Stronger Community',
    body: 'If you lose an item, other passengers can help when they scan the same vehicle later.',
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
    contentX.setValue(18);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentX, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentX, page]);
  return (
    <Screen style={{ paddingTop: 32 }}>
      <Animated.View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: Math.min(height * 0.57, 440),
          gap: 24,
          opacity: contentOpacity,
          transform: [{ translateX: contentX }],
        }}
      >
        <TalaIllustration
          name={current.art}
          width={Math.min(width - 80, 285)}
          style={{ borderRadius: 26 }}
        />
        <Title style={{ textAlign: 'center', fontSize: 23 }}>{current.title}</Title>
        <Copy style={{ textAlign: 'center', lineHeight: 24, maxWidth: 340 }}>{current.body}</Copy>
      </Animated.View>
      <View style={[s.row, { justifyContent: 'center', gap: 10, paddingVertical: 30 }]}>
        {pages.map((item, index) => (
          <Pressable
            key={item.title}
            accessibilityRole="button"
            accessibilityLabel={`Page ${index + 1}${index === page ? ', current' : ''}`}
            onPress={() => setPage(index)}
            hitSlop={12}
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: index === page ? colors.darkGreen : '#C3C9CC',
            }}
          />
        ))}
      </View>
      <View style={[s.row, { marginBottom: 20 }]}>
        {page < 2 && <Button label="Skip" variant="subtle" onPress={finish} style={{ flex: 1 }} />}
        <Button
          label={page === 2 ? 'Get Started' : 'Next'}
          onPress={() => (page < 2 ? setPage(page + 1) : finish())}
          style={{ flex: 1 }}
        />
      </View>
    </Screen>
  );
}
