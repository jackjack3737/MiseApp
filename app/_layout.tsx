import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar, StyleSheet } from 'react-native';
import * as SplashScreenNative from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AppGate from '../components/AppGate';
import { BioProvider } from '../context/BioContext';
import { BG, CARD_BG, ACCENT_BTN, RING_TRACK } from '../constants/theme';

SplashScreenNative.preventAutoHideAsync?.();

export default function RootLayout() {
  useEffect(() => {
    SplashScreenNative.hideAsync?.();
  }, []);

  return (
    <SafeAreaProvider>
      <BioProvider>
        <AppGate>
          <StatusBar barStyle="dark-content" backgroundColor={BG} />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: BG },
            }}
          >
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen
              name="profile"
              options={{
                presentation: 'modal',
                headerShown: true,
                headerTitle: 'Parametri',
                headerStyle: StyleSheet.flatten([
                  { backgroundColor: CARD_BG },
                  { borderBottomWidth: 1, borderBottomColor: RING_TRACK },
                ]),
                headerTintColor: ACCENT_BTN,
                headerTitleStyle: {
                  fontSize: 16,
                  fontWeight: '600',
                  color: '#1C1C1E',
                },
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="recipe-detail"
              options={{
                presentation: 'card',
                headerShown: false,
              }}
            />
          </Stack>
        </AppGate>
      </BioProvider>
    </SafeAreaProvider>
  );
}
