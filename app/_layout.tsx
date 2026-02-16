import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from '../components/SplashScreen';
import AppGate from '../components/AppGate';
import { BioProvider } from '../context/BioContext';
import { BG, CARD_BG, ACCENT_BTN, RING_TRACK } from '../constants/theme';

export default function RootLayout() {
  const [isShowSplash, setIsShowSplash] = useState(true);

  return (
    <SafeAreaProvider>
      <BioProvider>
        {isShowSplash ? (
          <>
            <StatusBar barStyle="light-content" backgroundColor="#000" />
            <SplashScreen onFinish={() => setIsShowSplash(false)} />
          </>
        ) : (
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
                  headerStyle: {
                    backgroundColor: CARD_BG,
                    borderBottomWidth: 1,
                    borderBottomColor: RING_TRACK,
                  },
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
        )}
      </BioProvider>
    </SafeAreaProvider>
  );
}
