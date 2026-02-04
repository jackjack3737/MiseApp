import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Chiave segreta per salvare i dati nel telefono
const STORAGE_KEY_MACROS = '@user_macros'; 

export default function ProfileScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Default se l'utente non ha mai impostato nulla
  const [macros, setMacros] = useState({
    calories: '2000',
    protein: '150',
    carbs: '20',
    fat: '80',
  });

  useEffect(() => {
    loadLocalProfile();
  }, []);

  // CARICA DAL TELEFONO
  async function loadLocalProfile() {
    try {
      const jsonValue = await AsyncStorage.getItem(STORAGE_KEY_MACROS);
      if (jsonValue != null) {
        setMacros(JSON.parse(jsonValue));
      }
    } catch(e) {
      console.log('Errore caricamento locale:', e);
    }
  }

  // SALVA SUL TELEFONO
  async function saveProfile() {
    setLoading(true);
    try {
      const jsonValue = JSON.stringify(macros);
      await AsyncStorage.setItem(STORAGE_KEY_MACROS, jsonValue);
      
      Alert.alert('Salvato', 'I tuoi dati sono al sicuro sul dispositivo! 📱');
      router.back(); 
    } catch (e) {
      Alert.alert('Errore', 'Impossibile salvare sul telefono.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      {/* Intestazione della pagina */}
      <Stack.Screen options={{ title: 'I Tuoi Obiettivi', headerBackTitle: 'Indietro' }} />
      
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>Imposta i tuoi Macro</Text>
        <Text style={styles.subtitle}>
          🔒 Questi dati rimangono SOLO sul tuo telefono.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>🔥 Calorie Giornaliere (kcal)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={macros.calories}
            onChangeText={(t) => setMacros({ ...macros, calories: t })}
          />
        </View>

        <View style={styles.row}>
          <View style={[styles.inputGroup, { flex: 1, marginRight: 10 }]}>
            <Text style={styles.label}>🥩 Proteine (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={macros.protein}
              onChangeText={(t) => setMacros({ ...macros, protein: t })}
            />
          </View>
          <View style={[styles.inputGroup, { flex: 1, marginLeft: 10 }]}>
            <Text style={styles.label}>🥑 Grassi (g)</Text>
            <TextInput
              style={styles.input}
              keyboardType="numeric"
              value={macros.fat}
              onChangeText={(t) => setMacros({ ...macros, fat: t })}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>🍞 Carboidrati (g)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={macros.carbs}
            onChangeText={(t) => setMacros({ ...macros, carbs: t })}
          />
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={saveProfile}
        >
          <Text style={styles.buttonText}>Salva Obiettivi 💾</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 10, color: '#333' },
  subtitle: { fontSize: 14, color: '#666', marginBottom: 30, fontStyle: 'italic' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8, color: '#444' },
  input: { 
    backgroundColor: '#f5f5f5', 
    padding: 15, 
    borderRadius: 10, 
    fontSize: 18, 
    borderWidth: 1, 
    borderColor: '#e0e0e0' 
  },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  button: { 
    backgroundColor: '#000', 
    padding: 18, 
    borderRadius: 12, 
    alignItems: 'center', 
    marginTop: 20 
  },
  buttonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
});