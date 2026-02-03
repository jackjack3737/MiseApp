import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, ScrollView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Scale, Ruler, Target, Activity, Save } from 'lucide-react-native';

export default function ProfileScreen() {
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [goal, setGoal] = useState<'lose' | 'maintain' | 'gain'>('maintain');
  const [dailyExpenditure, setDailyExpenditure] = useState('');
  const [targetCalories, setTargetCalories] = useState(0);

  // Carica i dati all'avvio
  useEffect(() => {
    loadLocalData();
  }, []);

  // Calcola calorie e BMI ogni volta che cambiano i dati
  useEffect(() => {
    const tdee = parseFloat(dailyExpenditure) || 0;
    let target = tdee;
    if (goal === 'lose') target = tdee - 500;
    if (goal === 'gain') target = tdee + 300;
    setTargetCalories(Math.round(target));
  }, [dailyExpenditure, goal]);

  const loadLocalData = async () => {
    try {
      const savedData = await AsyncStorage.getItem('@user_profile');
      if (savedData !== null) {
        const parsed = JSON.parse(savedData);
        setWeight(parsed.weight || '');
        setHeight(parsed.height || '');
        setGoal(parsed.goal || 'maintain');
        setDailyExpenditure(parsed.dailyExpenditure || '');
      }
    } catch (e) {
      console.error("Errore caricamento locale", e);
    }
  };

  const saveLocally = async () => {
  try {
    const profileData = {
      weight,
      height,
      goal,
      dailyExpenditure,
      targetCalories // Questo è il valore 1500 del tuo screenshot
    };
    
    // Usiamo la chiave univoca '@user_profile'
    await AsyncStorage.setItem('@user_profile', JSON.stringify(profileData));
    
    Alert.alert("✅ Salvato", "Il tuo budget di " + targetCalories + " Kcal è stato impostato.");
  } catch (e) {
    Alert.alert("Errore", "Impossibile salvare.");
  }
};

  // Calcolo BMI volante
  const h = parseFloat(height) / 100;
  const bmi = (parseFloat(weight) > 0 && h > 0) ? (parseFloat(weight) / (h * h)).toFixed(1) : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>IL TUO PROFILO</Text>
      <Text style={styles.subtitle}>DATI SALVATI SOLO SUL TUO DISPOSITIVO</Text>

      {/* BIOMETRIA */}
      <View style={styles.section}>
        <View style={styles.inputRow}>
          <View style={styles.inputWrap}>
            <Scale size={20} color="#00cec9" />
            <TextInput style={styles.input} placeholder="Peso (kg)" placeholderTextColor="#444" keyboardType="numeric" value={weight} onChangeText={setWeight} />
          </View>
          <View style={styles.inputWrap}>
            <Ruler size={20} color="#00cec9" />
            <TextInput style={styles.input} placeholder="Altezza (cm)" placeholderTextColor="#444" keyboardType="numeric" value={height} onChangeText={setHeight} />
          </View>
        </View>
        {bmi && <Text style={styles.bmiText}>BMI: {bmi}</Text>}
      </View>

      {/* OBIETTIVO */}
      <View style={styles.goalRow}>
        {['lose', 'maintain', 'gain'].map((g) => (
          <TouchableOpacity key={g} style={[styles.goalBtn, goal === g && styles.activeBtn]} onPress={() => setGoal(g as any)}>
            <Text style={[styles.goalText, goal === g && styles.activeText]}>{g === 'lose' ? 'Perdi' : g === 'gain' ? 'Massa' : 'Mantieni'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* SMARTWATCH INPUT */}
      <View style={styles.inputWrapFull}>
        <Activity size={20} color="#00cec9" />
        <TextInput style={styles.input} placeholder="Consumo Smartwatch (Kcal)" placeholderTextColor="#444" keyboardType="numeric" value={dailyExpenditure} onChangeText={setDailyExpenditure} />
      </View>

      {targetCalories > 0 && (
        <View style={styles.targetCard}>
          <Target color="#00cec9" size={30} />
          <View>
            <Text style={styles.targetLabel}>TARGET GIORNALIERO</Text>
            <Text style={styles.targetVal}>{targetCalories} Kcal</Text>
          </View>
        </View>
      )}

      <TouchableOpacity style={styles.saveBtn} onPress={saveLocally}>
        <Save size={20} color="#000" />
        <Text style={styles.saveText}>SALVA SUL TELEFONO</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  content: { padding: 25, paddingTop: 60 },
  title: { color: '#fff', fontSize: 30, fontWeight: '900' },
  subtitle: { color: '#636e72', fontSize: 10, fontWeight: '800', marginBottom: 30 },
  section: { marginBottom: 20 },
  inputRow: { flexDirection: 'row', gap: 15 },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 15, padding: 15, gap: 10, borderWidth: 1, borderColor: '#222' },
  inputWrapFull: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 15, padding: 15, gap: 10, borderWidth: 1, borderColor: '#222', marginBottom: 20 },
  input: { flex: 1, color: '#fff', fontSize: 16, fontWeight: '700' },
  bmiText: { color: '#00cec9', marginTop: 10, fontWeight: '800', textAlign: 'center' },
  goalRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  goalBtn: { flex: 1, height: 50, backgroundColor: '#111', borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#222' },
  activeBtn: { backgroundColor: '#00cec9', borderColor: '#00cec9' },
  goalText: { color: '#636e72', fontWeight: '800', fontSize: 12 },
  activeText: { color: '#000' },
  targetCard: { backgroundColor: '#111', padding: 20, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 15, marginBottom: 30, borderWidth: 1, borderColor: '#333' },
  targetLabel: { color: '#636e72', fontSize: 10, fontWeight: '900' },
  targetVal: { color: '#fff', fontSize: 24, fontWeight: '900' },
  saveBtn: { backgroundColor: '#00cec9', height: 60, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10 },
  saveText: { color: '#000', fontWeight: '900' }
});