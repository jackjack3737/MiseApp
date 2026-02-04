import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      
      <Stack 
        screenOptions={{ 
          headerShown: false,
          contentStyle: { backgroundColor: '#000' } 
        }}
      >
        {/* 1. NAVIGAZIONE PRINCIPALE (Contiene Explore, Advisor, Tracker, Spesa) */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        
        {/* 2. PROFILO (Metabolic Mixer) - Apre un Modal sopra le Tabs */}
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

        {/* 3. DETTAGLIO RICETTA - Transizione a scheda (Card) */}
        <Stack.Screen 
          name="recipe-detail" 
          options={{ 
            presentation: 'card',
            headerShown: false 
          }} 
        />

        {/* NOTA: Il file 'medical' è gestito ora da (tabs)/_layout.tsx */}
      </Stack>
    </SafeAreaProvider>
  );
}