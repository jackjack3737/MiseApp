import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Save, Plus, Minus, Flame, Droplet, Wheat, User, Target, Zap, Trash2, ShieldAlert, ArrowLeft } from 'lucide-react-native';

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

  // --- PRESET MACRO ---
  const applyProtocolDefaults = (selected: string) => {
    setProtocol(selected);
    
    let newC = 20;
    let newP = 150;

    switch(selected) {
        case 'Keto': newC = 25; newP = Math.round((kcal * 0.25) / 4); break;
        case 'Carnivore': newC = 0; newP = Math.round((kcal * 0.40) / 4); break;
        case 'Paleo': newC = 60; newP = Math.round((kcal * 0.30) / 4); break;
        case 'LowCarb': newC = 100; newP = Math.round((kcal * 0.35) / 4); break;
    }
    const newF = Math.max(0, Math.floor((kcal - (newP * 4) - (newC * 4)) / 9));
    setCarbs(newC); setProtein(newP); setFat(newF);
  };

  const updateMetabolism = (type: string, newValue: number) => {
    let nK = kcal, nP = protein, nC = carbs, nF = fat;
    if (type === 'kcal') nK = Math.max(500, newValue);
    else if (type === 'p') nP = Math.max(0, newValue);
    else if (type === 'c') nC = Math.max(0, newValue);
    else if (type === 'f') nF = Math.max(0, newValue);

    if (type !== 'f') {
        nF = Math.max(0, Math.floor((nK - (nP * 4) - (nC * 4)) / 9));
    }
    setKcal(nK); setProtein(nP); setCarbs(nC); setFat(nF);
  };

  async function saveProfile() {
    try {
      const profileData = { 
        targetCalories: kcal, protocol, protein, carbs, fat, 
        updatedAt: new Date().toISOString() 
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profileData));
      Alert.alert('Salvato', 'Configurazione aggiornata.');
      
      if (router.canGoBack()) router.back();
      else router.replace('/(tabs)/explore');
    } catch (e) { Alert.alert('Errore', 'Salvataggio fallito.'); }
  }

  const handleFullReset = async () => {
    Alert.alert("Reset Completo", "Vuoi cancellare tutto e tornare al setup?", [
        { text: "Annulla", style: "cancel" },
        { text: "RESETTA", style: "destructive", onPress: async () => {
            await AsyncStorage.removeItem(STORAGE_KEY); 
            router.replace('/'); 
        }}
    ]);
  };

  const showDisclaimer = () => {
    Alert.alert(
        "ESONERO DI RESPONSABILITÀ",
        "KetoLab è un'applicazione a scopo puramente informativo e di tracciamento. \n\nNON È UN DISPOSITIVO MEDICO.\n\nTutte le informazioni, i calcoli dei macronutrienti e i suggerimenti (inclusi quelli dell'Advisor AI) non costituiscono parere medico, diagnosi o prescrizione.\n\nL'utente si assume la piena ed esclusiva responsabilità per l'uso delle informazioni fornite. Gli sviluppatori e Sinelica Digital declinano ogni responsabilità per eventuali effetti collaterali o danni derivanti dall'adozione dei protocolli alimentari suggeriti.\n\nConsulta sempre il tuo medico prima di iniziare qualsiasi dieta.",
        [{ text: "HO CAPITO E ACCETTO", style: "default" }]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        
        {/* HEADER RIORGANIZZATO */}
        <View style={styles.header}>
            <View style={{flexDirection:'row', alignItems:'center', gap: 10}}>
                <TouchableOpacity onPress={() => router.back()} style={{paddingRight:5}}>
                    <ArrowLeft size={24} color="#636e72" />
                </TouchableOpacity>
                <Target size={24} color="#00cec9" />
                <Text style={styles.title}>BIO-TARGETS</Text>
            </View>
            
            {/* TASTO SALVA NELL'HEADER */}
            <TouchableOpacity style={styles.headerSaveBtn} onPress={saveProfile}>
                <Save size={18} color="#000" />
                <Text style={styles.headerSaveText}>SALVA</Text>
            </TouchableOpacity>
        </View>

        <Text style={styles.subLabel}>REGIME ALIMENTARE ATTIVO</Text>
        <View style={styles.protocolRow}>
          {PROTOCOLS.map(p => (
            <TouchableOpacity key={p} onPress={() => applyProtocolDefaults(p)} 
              style={[styles.pill, protocol === p && styles.activePill]}>
              <Text style={[styles.pillText, protocol === p && {color: '#00cec9'}]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <ControlRow label="CALORIE TOTALI" value={kcal} type="kcal" icon={Flame} color="#fff" update={updateMetabolism} />
        
        <View style={styles.macroGrid}>
          <ControlRow label="PROTEINE (G)" value={protein} type="p" icon={User} color="#74b9ff" update={updateMetabolism} />
          <ControlRow label="CARBOIDRATI (G)" value={carbs} type="c" icon={Wheat} color="#fdcb6e" update={updateMetabolism} />
          <ControlRow label="GRASSI (G)" value={fat} type="f" icon={Droplet} color="#ff7675" update={updateMetabolism} />
        </View>

        <View style={styles.divider} />

        {/* TASTI DI SERVIZIO */}
        <View style={styles.footerActions}>
            <TouchableOpacity style={styles.disclaimerBtn} onPress={showDisclaimer}>
                <ShieldAlert size={18} color="#b2bec3" />
                <Text style={styles.disclaimerText}>DISCLAIMER LEGALE</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.resetBtn} onPress={handleFullReset}>
                <Trash2 size={18} color="#ff7675" />
                <Text style={styles.resetText}>RESET APP</Text>
            </TouchableOpacity>
        </View>

        <View style={styles.infoFooter}>
          <Text style={styles.privacyNote}>
              I dati bio-metrici sono criptati e salvati solo su questo dispositivo.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const ControlRow = ({ label, value, type, color, icon: Icon, update }: any) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.labelGroup}>
          <Icon size={14} color={color} />
          <Text style={[styles.label, { color }]}>{label}</Text>
        </View>
      </View>
      <View style={styles.inputRow}>
        <TouchableOpacity onPress={() => update(type, value - (type === 'kcal' ? 50 : 5))} style={styles.miniBtn}>
          <Minus size={18} color="#fff" />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          value={value.toString()}
          onChangeText={(txt) => update(type, parseInt(txt) || 0)}
        />
        <TouchableOpacity onPress={() => update(type, value + (type === 'kcal' ? 50 : 5))} style={styles.miniBtn}>
          <Plus size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  title: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  
  // STILE BOTTONE SALVA HEADER
  headerSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00cec9', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  headerSaveText: { color: '#000', fontWeight: '900', fontSize: 12 },

  subLabel: { color: '#333', fontSize: 10, fontWeight: '900', marginBottom: 12, letterSpacing: 1.5 },
  protocolRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 30 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#222' },
  activePill: { borderColor: '#00cec9', backgroundColor: '#00cec910' },
  pillText: { color: '#636e72', fontSize: 12, fontWeight: '800' },
  
  card: { backgroundColor: '#0a0a0a', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#111' },
  cardHeader: { marginBottom: 15 },
  labelGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  input: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'center', flex: 1 },
  miniBtn: { width: 45, height: 45, borderRadius: 14, backgroundColor: '#111', justifyContent: 'center', alignItems: 'center' },
  macroGrid: { marginTop: 5 },
  
  divider: { height: 1, backgroundColor: '#111', marginVertical: 20 },

  footerActions: { flexDirection: 'row', justifyContent: 'space-between', gap: 15 },
  disclaimerBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15, borderRadius: 15, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#222' },
  disclaimerText: { color: '#b2bec3', fontSize: 10, fontWeight: '900' },
  
  resetBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 15, borderRadius: 15, backgroundColor: '#2d0a0a', borderWidth: 1, borderColor: '#5c1010' },
  resetText: { color: '#ff7675', fontSize: 10, fontWeight: '900' },

  infoFooter: { marginTop: 30, alignItems: 'center' },
  privacyNote: { color: '#333', fontSize: 10, textAlign: 'center', fontWeight: '600' }
});