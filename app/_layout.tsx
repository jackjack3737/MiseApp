import { useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar, Platform } from 'react-native'; 
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SplashScreen from '../components/SplashScreen'; 

const TECH_GREEN = '#39FF14'; // Il tuo verde tecnico
const BORDER_DARK = '#1b3517'; // Verde scurissimo per i bordi

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
      {/* StatusBar coordinata col tema nero/verde */}
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
        
        {/* 2. PROFILO (Configurazione Biometrica) */}
        <Stack.Screen 
          name="profile" 
          options={{ 
            presentation: 'modal', 
            headerShown: true, 
            headerTitle: 'PARAMETRI_SISTEMA', // Stile più tecnico
            headerStyle: { 
              backgroundColor: '#000', // Nero assoluto come profilo
              borderBottomWidth: 1,
              borderBottomColor: BORDER_DARK,
            }, 
            headerTintColor: TECH_GREEN, // FINALMENTE TUTTO VERDE
            headerTitleStyle: {
              fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
              fontSize: 14,
              fontWeight: '900',
            },
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