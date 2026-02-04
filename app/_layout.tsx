import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'react-native'; // Usiamo quello nativo per controllo colore sfondo
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from '../components/SplashScreen'; // Assicurati che il percorso sia corretto

export default function RootLayout() {
  const [isShowSplash, setIsShowSplash] = useState(true);

  // 1. FASE SPLASH SCREEN
  if (isShowSplash) {
    return (
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <SplashScreen onFinish={() => setIsShowSplash(false)} />
      </SafeAreaProvider>
    );
  }

  // 2. FASE APP (Navigazione)
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#000" />
      
      <Stack 
        screenOptions={{ 
          headerShown: false,
          contentStyle: { backgroundColor: '#000' } 
        }}
      >
        {/* 1. NAVIGAZIONE PRINCIPALE */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        
        {/* 2. PROFILO (Metabolic Mixer) */}
        <Stack.Screen 
          name="profile" 
          options={{ 
            presentation: 'modal', 
            headerShown: true, 
            headerTitle: 'IMPOSTAZIONI BIO',
            headerStyle: { backgroundColor: '#111' }, 
            headerTintColor: '#00cec9', 
            headerShadowVisible: false,
          }} 
        />

        {/* 3. DETTAGLIO RICETTA */}
        <Stack.Screen 
          name="recipe-detail" 
          options={{ 
            presentation: 'card',
            headerShown: false 
          }} 
        />
      </Stack>
    </SafeAreaProvider>
  );
}