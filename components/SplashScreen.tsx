import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Dimensions, Animated } from 'react-native';
import { Zap, BrainCircuit } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

export default function SplashScreen({ onFinish }: { onFinish: () => void }) {
  const fadeAnim = useRef(new Animated.Value(1)).current; // Opacità iniziale 1
  const scaleAnim = useRef(new Animated.Value(0.9)).current; // Scala iniziale 0.9

  useEffect(() => {
    // 1. Animazione di Entrata (Scale Up)
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 5,
      useNativeDriver: true,
    }).start();

    // 2. Attesa e Dissolvenza (Fade Out)
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 800, // Durata dissolvenza
        useNativeDriver: true,
      }).start(() => {
        // 3. Callback quando finito
        onFinish();
      });
    }, 2500); // Rimane visibile per 2.5 secondi

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.centerContent}>
        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
            <View style={styles.iconContainer}>
                <BrainCircuit size={80} color="#00cec9" />
                <View style={styles.zapBadge}>
                    <Zap size={24} color="#000" fill="#000" />
                </View>
            </View>
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
    backgroundColor: '#000000',
    zIndex: 9999, // Assicura che sia sopra tutto
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#111',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#333',
    elevation: 20,
    shadowColor: '#00cec9',
    shadowOpacity: 0.3,
    shadowRadius: 20,
  },
  zapBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#00cec9',
    borderRadius: 15,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#000'
  },
  title: {
    color: '#fff',
    fontSize: 42,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 5,
  },
  subtitle: {
    color: '#636e72',
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
    color: '#444',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 4,
    fontStyle: 'italic'
  },
  companyName: {
    color: '#00cec9',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
  }
});