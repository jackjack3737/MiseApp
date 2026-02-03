import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Gestisce il gruppo delle 4 icone in basso */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      
      {/* Gestisce la pagina della ricetta che si apre SOPRA le tab */}
      <Stack.Screen 
        name="recipe-detail" 
        options={{ 
          presentation: 'card', 
          headerShown: false 
        }} 
      />
    </Stack>
  );
}