import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@user_profile';

// I Default "Bio-Hacker" allineati con il nuovo Profilo
const DEFAULT_PROFILE = {
  targetCalories: 2000,
  protocol: 'KETO',
  protein: 125,  // 25%
  carbs: 25,     // 5%
  fat: 155,      // 70%
  weight: 75,
  targetWeight: 70,
  gender: 'male',
  activityMult: 1.2,
  updatedAt: new Date().toISOString()
};

export default function IndexScreen() {
  const router = useRouter();

  useEffect(() => {
    const initApp = async () => {
      try {
        // 1. Controlla se esiste già un profilo
        const existingProfile = await AsyncStorage.getItem(STORAGE_KEY);
        
        // 2. Se NON esiste (o è corrotto), crealo silenziosamente
        if (!existingProfile) {
          console.log(">> SYSTEM INIT: Profilo non trovato. Creazione Default (2000 kcal)...");
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROFILE));
          
          // Imposta flag di sistema
          await AsyncStorage.setItem('@is_premium', 'false');
        } else {
           console.log(">> SYSTEM INIT: Profilo caricato.");
        }

        // 3. Reindirizza IMMEDIATAMENTE al Tracker
        // Nota: Se preferisci andare alla Home (Mixer), cambia in router.replace('/(tabs)');
        router.replace('/(tabs)/tracker'); 

      } catch (e) {
        console.error("CRITICAL ERROR INIT:", e);
        // Fallback di sicurezza: vai comunque al tracker per non bloccare l'app
        router.replace('/(tabs)/tracker');
      }
    };

    // Esegui subito
    initApp();
  }, []);

  // Spinner di caricamento (stile Bio-Lab)
  return (
    <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color="#00FF80" />
    </View>
  );
}