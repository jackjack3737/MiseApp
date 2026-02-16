import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Image, StyleSheet, Text, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }).start(() => onFinish());
    }, 2500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.centerContent}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
          <Image
            source={require('../assets/images/splash.png')}
            style={styles.splashImage}
            resizeMode="contain"
          />
        </Animated.View>

        <Text style={styles.title}>KETOLAB</Text>
        <Text style={styles.subtitle}>BIO-HACKING PROTOCOLS</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.poweredBy}>powered by</Text>
        <Text style={styles.companyName}>SINELICA DIGITAL</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width,
    height: height,
    backgroundColor: '#FFFFFF',
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashImage: {
    width: 160,
    height: 160,
    marginBottom: 30,
  },
  title: {
    color: '#1A1A1A',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 5,
  },
  subtitle: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 60,
    alignItems: 'center',
  },
  poweredBy: {
    color: '#6B7280',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  companyName: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  },
});