import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Save, Plus, Minus, Flame, Droplet, Wheat, User, Stethoscope, ChevronRight, Settings } from 'lucide-react-native';

const STORAGE_KEY = '@user_profile';
const PROTOCOLS = ['Keto', 'Carnivore', 'Paleo', 'LowCarb'];

export default function ProfileScreen() {
  const router = useRouter();
  const [protocol, setProtocol] = useState('Keto');
  const [kcal, setKcal] = useState(2000);
  const [protein, setProtein] = useState(150);
  const [carbs, setCarbs] = useState(20);
  const [fat, setFat] = useState(150);

  useEffect(() => { loadProfile(); }, []);

  async function loadProfile() {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        setProtocol(p.protocol || 'Keto');
        setKcal(p.targetCalories || 2000);
        setProtein(p.protein || 150);
        setCarbs(p.carbs || 20);
        setFat(p.fat || 150);
      }
    } catch(e) { console.log(e); }
  }

  const getPercentage = (grams: number, multiplier: number) => {
    if (kcal === 0) return 0;
    return Math.round(((grams * multiplier) / kcal) * 100);
  };

  const updateMetabolism = (type: string, newValue: number) => {
    let nK = kcal, nP = protein, nC = carbs, nF = fat;

    if (type === 'kcal') {
      nK = Math.max(500, newValue);
      nF = Math.max(0, Math.floor((nK - (nP * 4) - (nC * 4)) / 9));
    } else if (type === 'p') {
      nP = Math.max(0, newValue);
      nF = Math.max(0, Math.floor((nK - (nP * 4) - (nC * 4)) / 9));
    } else if (type === 'c') {
      nC = Math.max(0, newValue);
      nF = Math.max(0, Math.floor((nK - (nP * 4) - (nC * 4)) / 9));
    } else if (type === 'f') {
      nF = Math.max(0, newValue);
      nC = Math.max(0, Math.floor((nK - (nP * 4) - (nF * 9)) / 4));
    }

    setKcal(nK); setProtein(nP); setCarbs(nC); setFat(nF);
  };

  async function saveProfile() {
    try {
      const profileData = { targetCalories: kcal, protocol, protein, carbs, fat };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profileData));
      Alert.alert('Bio-Data Salvati', 'Il profilo è sincronizzato con il Tracker.');
      router.back();
    } catch (e) { Alert.alert('Errore', 'Salvataggio fallito.'); }
  }

  const ControlRow = ({ label, value, type, color, icon: Icon, perc }: any) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.labelGroup}>
          <Icon size={16} color={color} />
          <Text style={[styles.label, { color }]}>{label}</Text>
        </View>
        {perc !== undefined && <Text style={styles.percText}>{perc}%</Text>}
      </View>
      
      <View style={styles.inputRow}>
        <TouchableOpacity onPress={() => updateMetabolism(type, value - (type === 'kcal' ? 50 : 5))} style={styles.miniBtn}>
          <Minus size={18} color="#fff" />
        </TouchableOpacity>
        
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={value.toString()}
          onChangeText={(txt) => updateMetabolism(type, parseInt(txt) || 0)}
        />
        
        <TouchableOpacity onPress={() => updateMetabolism(type, value + (type === 'kcal' ? 50 : 5))} style={styles.miniBtn}>
          <Plus size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={styles.title}>METABOLIC MIXER</Text>

        <View style={styles.protocolRow}>
          {PROTOCOLS.map(p => (
            <TouchableOpacity key={p} onPress={() => setProtocol(p)} 
              style={[styles.pill, protocol === p && styles.activePill]}>
              <Text style={[styles.pillText, protocol === p && {color: '#00cec9'}]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 1. COLLEGAMENTO AREA MEDICA */}
        <TouchableOpacity 
          style={styles.medicalLink} 
          onPress={() => router.push('/medical')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.medicalIconCircle}>
              <Stethoscope size={20} color="#00cec9" />
            </View>
            <View>
              <Text style={styles.medicalTitle}>AREA MEDICA</Text>
              <Text style={styles.medicalSubtitle}>Supervisione Gemini AI</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#636e72" />
        </TouchableOpacity>

        {/* 2. NUOVO: COLLEGAMENTO SETUP (INDEX) */}
        <TouchableOpacity 
          style={styles.setupLink} 
          onPress={() => router.push('/')}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View style={styles.setupIconCircle}>
              <Settings size={20} color="#636e72" />
            </View>
            <View>
              <Text style={styles.setupTitle}>CONFIGURAZIONE INIZIALE</Text>
              <Text style={styles.setupSubtitle}>Riavvia il processo di Setup</Text>
            </View>
          </View>
          <ChevronRight size={20} color="#636e72" />
        </TouchableOpacity>

        <ControlRow label="CALORIE TOTALI" value={kcal} type="kcal" icon={Flame} color="#fff" />
        <View style={styles.macroGrid}>
          <ControlRow label="PROTEINE (G)" value={protein} type="p" icon={User} color="#74b9ff" perc={getPercentage(protein, 4)} />
          <ControlRow label="CARBOIDRATI (G)" value={carbs} type="c" icon={Wheat} color="#fdcb6e" perc={getPercentage(carbs, 4)} />
          <ControlRow label="GRASSI (G)" value={fat} type="f" icon={Droplet} color="#ff7675" perc={getPercentage(fat, 9)} />
        </View>

        <TouchableOpacity style={styles.saveBtn} onPress={saveProfile}>
          <Save size={20} color="#000" />
          <Text style={styles.saveBtnText}>APPLICA CONFIGURAZIONE</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  title: { color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 20, letterSpacing: 1 },
  protocolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 25 },
  pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#111', borderWidth: 1, borderColor: '#222' },
  activePill: { borderColor: '#00cec9' },
  pillText: { color: '#636e72', fontSize: 11, fontWeight: '800' },
  medicalLink: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#111', 
    padding: 15, 
    borderRadius: 20, 
    marginBottom: 12, 
    borderWidth: 1, 
    borderColor: '#00cec940' 
  },
  medicalIconCircle: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#00cec910', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  medicalTitle: { color: '#fff', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  medicalSubtitle: { color: '#636e72', fontSize: 10, fontWeight: '600' },
  setupLink: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    backgroundColor: '#0a0a0a', 
    padding: 15, 
    borderRadius: 20, 
    marginBottom: 20, 
    borderWidth: 1, 
    borderColor: '#222' 
  },
  setupIconCircle: { 
    width: 40, 
    height: 40, 
    borderRadius: 20, 
    backgroundColor: '#222', 
    justifyContent: 'center', 
    alignItems: 'center' 
  },
  setupTitle: { color: '#636e72', fontSize: 14, fontWeight: '900', letterSpacing: 0.5 },
  setupSubtitle: { color: '#333', fontSize: 10, fontWeight: '600' },
  card: { backgroundColor: '#111', borderRadius: 20, padding: 15, marginBottom: 12, borderWidth: 1, borderColor: '#222' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  labelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  percText: { color: '#636e72', fontSize: 12, fontWeight: 'bold', backgroundColor: '#000', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { color: '#fff', fontSize: 24, fontWeight: '900', textAlign: 'center', flex: 1 },
  miniBtn: { width: 45, height: 45, borderRadius: 12, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  macroGrid: { marginTop: 5 },
  saveBtn: { backgroundColor: '#00cec9', height: 65, borderRadius: 20, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 12, marginTop: 20 },
  saveBtnText: { color: '#000', fontWeight: '900', fontSize: 16 }
});