import Animated from 'react-native-reanimated';

export function HelloWave() {
  return (
    <Animated.Text
      style={[
        {
          fontSize: 28,
          lineHeight: 32,
          marginTop: -6,
        },
        // Stile animazione (compatibile con Reanimated / web)
        { animationIterationCount: 4, animationDuration: '300ms' } as Record<string, unknown>,
      ]}>
      👋
    </Animated.Text>
  );
}
