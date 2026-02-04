import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      {/* Forza la barra di stato (batteria, orario) bianca su sfondo nero */}
      <StatusBar style="light" />
      
      <Stack 
        screenOptions={{ 
          headerShown: false,
          // Imposta sfondo nero di default per evitare flash bianchi durante le transizioni
          contentStyle: { backgroundColor: '#000' } 
        }}
      >
        {/* 1. SETUP / ONBOARDING (La prima schermata che vedi) */}
        <Stack.Screen 
          name="index" 
          options={{ headerShown: false }} 
        />

        {/* 2. MENU PRINCIPALE (Le 4 Tab in basso) */}
        <Stack.Screen 
          name="(tabs)" 
          options={{ headerShown: false }} 
        />
        
        {/* 3. IMPOSTAZIONI PROFILO (Si apre come una finestra sopra le tab) */}
        <Stack.Screen 
          name="profile" 
          options={{ 
            presentation: 'modal', // Effetto "foglio che sale dal basso"
            headerShown: true,     // Mostriamo l'header per avere il tasto "Chiudi" nativo
            headerTitle: 'SETTINGS', // Titolo in alto
            headerStyle: { backgroundColor: '#000' }, // Header nero
            headerTintColor: '#fff', // Testo e freccia bianchi
            headerShadowVisible: false, // Toglie la riga grigia brutta sotto l'header
          }} 
        />

        {/* 4. DETTAGLIO RICETTA (Si apre come una scheda classica) */}
        <Stack.Screen 
          name="recipe-detail" 
          options={{ 
            presentation: 'card', 
            headerShown: false 
          }} 
        />
      </Stack>
    </>
  );
}