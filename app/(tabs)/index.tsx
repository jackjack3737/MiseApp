import React, { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DS } from '../../constants/designSystem';

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
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PROFILE));
          await AsyncStorage.setItem('@is_premium', 'false');
        }

        // 3. Reindirizza alla pagina Oggi (Home)
        router.replace('/(tabs)/home'); 

      } catch (_) {
        router.replace('/(tabs)/home');
      }
    };

    // Esegui subito
    initApp();
  }, []);

  // Spinner di caricamento (stile Bio-Lab)
  return (
    <View style={{ flex: 1, backgroundColor: DS.bg, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator size="large" color={DS.accent} />
    </View>
  );
}