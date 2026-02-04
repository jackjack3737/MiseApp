import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, StatusBar, TextInput, ActivityIndicator, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { Zap, Beef, Leaf, Activity, ArrowRight, Edit2 } from 'lucide-react-native';

const PROTOCOLS = [
  { id: 'Keto', name: 'KETO', icon: <Zap size={20} color="#FFD700" />, color: '#FFD700' },
  { id: 'Carnivore', name: 'CARNIVORE', icon: <Beef size={20} color="#e17055" />, color: '#e17055' },
  { id: 'Paleo', name: 'PALEO', icon: <Leaf size={20} color="#00b894" />, color: '#00b894' },
  { id: 'LowCarb', name: 'LOW CARB', icon: <Activity size={20} color="#0984e3" />, color: '#0984e3' },
];

export default function IndexScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const insets = useSafeAreaInsets();
  
  const [selectedProtocol, setSelectedProtocol] = useState('Keto');
  const [kcal, setKcal] = useState(2000);
  const [carbs, setCarbs] = useState(25);   
  const [protein, setProtein] = useState(125); 
  const [fat, setFat] = useState(155);
  const isInternalUpdate = useRef(false);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const profile = await AsyncStorage.getItem('@user_profile');
        if (profile) {
            router.replace('/(tabs)/explore');
        } else {
            setIsLoading(false);
            applyProtocolDefaults('Keto');
        }
      } catch (e) { setIsLoading(false); }
    };
    checkUser();
  }, []);

  const applyProtocolDefaults = (protoId: string) => {
    setSelectedProtocol(protoId);
    isInternalUpdate.current = true;
    let newC = 20, newP = 150;
    
    switch(protoId) {
        case 'Keto': newC = 25; newP = Math.round((kcal * 0.25) / 4); break;
        case 'Carnivore': newC = 0; newP = Math.round((kcal * 0.40) / 4); break;
        case 'Paleo': newC = 60; newP = Math.round((kcal * 0.30) / 4); break;
        case 'LowCarb': newC = 100; newP = Math.round((kcal * 0.35) / 4); break;
    }
    const newF = Math.max(0, Math.floor((kcal - (newP * 4) - (newC * 4)) / 9));
    setCarbs(newC); setProtein(newP); setFat(newF);
    setTimeout(() => { isInternalUpdate.current = false; }, 50);
  };

  useEffect(() => {
    if (!isInternalUpdate.current && !isLoading) applyProtocolDefaults(selectedProtocol);
  }, [kcal]);

  const handleKcalChange = (text: string) => {
    const val = parseInt(text.replace(/[^0-9]/g, '')) || 0;
    setKcal(val);
  };

  const handleMacroChange = (type: string, newValueStr: string) => {
    isInternalUpdate.current = true;
    let newVal = parseInt(newValueStr.replace(/[^0-9]/g, '')) || 0;
    
    if (type === 'c') {
        setCarbs(newVal);
        setFat(Math.max(0, Math.floor((kcal - (newVal * 4) - (protein * 4)) / 9)));
    } else if (type === 'p') {
        setProtein(newVal);
        setFat(Math.max(0, Math.floor((kcal - (carbs * 4) - (newVal * 4)) / 9)));
    } else if (type === 'f') {
        setFat(newVal);
        setKcal((carbs * 4) + (protein * 4) + (newVal * 9));
    }
    setTimeout(() => { isInternalUpdate.current = false; }, 50);
  };

  const handleSave = async () => {
    try {
      const settings = {
        targetCalories: kcal, protocol: selectedProtocol,
        carbs, protein, fat,
        targetCarbs: carbs, targetProtein: protein, targetFat: fat,
        updatedAt: new Date().toISOString()
      };
      await AsyncStorage.setItem('@user_profile', JSON.stringify(settings));
      await AsyncStorage.setItem('@show_tutorial', 'true');
      router.replace('/(tabs)/explore');
    } catch (e) { Alert.alert("Errore", "Impossibile salvare configurazione."); }
  };

  if (isLoading) return <View style={styles.center}><ActivityIndicator size="large" color="#00cec9"/></View>;

  const carbsPct = Math.round(((carbs * 4) / Math.max(1, (carbs * 4) + (protein * 4) + (fat * 9))) * 100);
  const proteinPct = Math.round(((protein * 4) / Math.max(1, (carbs * 4) + (protein * 4) + (fat * 9))) * 100);
  const fatPct = Math.round(((fat * 9) / Math.max(1, (carbs * 4) + (protein * 4) + (fat * 9))) * 100);

  const MacroRow = ({ label, val, type, color }: any) => (
    <View style={styles.macroRow}>
        <View style={styles.macroInfo}>
            <Text style={[styles.macroLabel, { color: color }]}>{label}</Text>
            <View style={styles.inputContainer}>
                <TextInput style={styles.inputSmall} value={val.toString()} onChangeText={(t) => handleMacroChange(type, t)} keyboardType="numeric" maxLength={3} />
                <Text style={styles.unit}>g</Text>
            </View>
        </View>
        <View style={styles.barContainer}>
            <View style={[styles.barFill, { width: `${Math.min((val / 200) * 100, 100)}%`, backgroundColor: color }]} />
        </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.brand}>KetoLab by SINELICA DIGITAL</Text>
        <Text style={styles.title}>CONFIGURAZIONE BIO</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.sectionLabel}>SELEZIONA PROTOCOLLO</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.protocolContainer}>
                {PROTOCOLS.map((p) => {
                    const isActive = selectedProtocol === p.id;
                    return (
                        <TouchableOpacity key={p.id} style={[styles.protocolChip, isActive && { backgroundColor: p.color, borderColor: p.color }]} onPress={() => applyProtocolDefaults(p.id)}>
                            {React.cloneElement(p.icon as React.ReactElement, { size: 16, color: isActive ? '#000' : p.color })}
                            <Text style={[styles.protocolText, isActive && { color: '#000' }]}>{p.name}</Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <View style={styles.card}>
                <View style={styles.cardHeader}><Text style={styles.cardTitle}>BUDGET CALORICO</Text><Edit2 size={14} color="#636e72" /></View>
                <TextInput style={styles.kcalInput} value={kcal.toString()} onChangeText={handleKcalChange} keyboardType="numeric" maxLength={4} />
                <Text style={styles.kcalUnit}>KCAL / GIORNO</Text>
            </View>

            <View style={styles.card}>
                <Text style={styles.cardTitle}>RIPARTIZIONE MACROS</Text>
                <View style={styles.chartContainer}>
                    <View style={styles.chartItem}><Text style={[styles.chartVal, {color:'#fdcb6e'}]}>{carbsPct}%</Text><Text style={styles.chartLabel}>C</Text></View>
                    <View style={styles.divider} />
                    <View style={styles.chartItem}><Text style={[styles.chartVal, {color:'#74b9ff'}]}>{proteinPct}%</Text><Text style={styles.chartLabel}>P</Text></View>
                    <View style={styles.divider} />
                    <View style={styles.chartItem}><Text style={[styles.chartVal, {color:'#ff7675'}]}>{fatPct}%</Text><Text style={styles.chartLabel}>F</Text></View>
                </View>
                <View style={{marginTop: 15}}>
                    <MacroRow label="CARBOIDRATI" val={carbs} type="c" color="#fdcb6e" />
                    <MacroRow label="PROTEINE" val={protein} type="p" color="#74b9ff" />
                    <MacroRow label="GRASSI" val={fat} type="f" color="#ff7675" />
                </View>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* FOOTER FIXATO E ALZATO */}
      <View style={[styles.footerContainer, { paddingBottom: insets.bottom + 30 }]}>
        <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>SALVA & INIZIA</Text>
            <ArrowRight size={20} color="#000" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  header: { paddingHorizontal: 25, paddingTop: 20, paddingBottom: 20 },
  brand: { color: '#00cec9', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 8, textTransform: 'uppercase' },
  title: { color: '#fff', fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  
  // Aumentato padding bottom per lo scroll
  scrollContent: { paddingBottom: 180 }, 
  
  sectionLabel: { color: '#636e72', fontSize: 10, fontWeight: '800', marginLeft: 25, marginBottom: 10, letterSpacing: 1 },
  protocolContainer: { paddingHorizontal: 25, gap: 10, marginBottom: 30 },
  protocolChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, backgroundColor: '#111', borderWidth: 1, borderColor: '#333' },
  protocolText: { color: '#bdc3c7', fontSize: 12, fontWeight: '800' },
  card: { marginHorizontal: 25, backgroundColor: '#0a0a0a', borderRadius: 20, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: '#1a1a1a' },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { color: '#636e72', fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  kcalInput: { color: '#fff', fontSize: 42, fontWeight: '900', textAlign: 'center', paddingVertical: 10 },
  kcalUnit: { color: '#636e72', fontSize: 10, fontWeight: '700', textAlign: 'center', letterSpacing: 2 },
  chartContainer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 15, backgroundColor: '#000', borderRadius: 12, padding: 10 },
  chartItem: { alignItems: 'center', width: 60 },
  chartVal: { fontSize: 18, fontWeight: '900' },
  chartLabel: { color: '#444', fontSize: 10, fontWeight: '900', marginTop: 2 },
  divider: { width: 1, height: 20, backgroundColor: '#222' },
  macroRow: { marginBottom: 15 },
  macroInfo: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  macroLabel: { fontSize: 11, fontWeight: '800' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  inputSmall: { color: '#fff', fontSize: 16, fontWeight: '700', textAlign: 'right', minWidth: 40, padding: 0 },
  unit: { color: '#444', fontSize: 10, fontWeight: '600' },
  barContainer: { height: 6, backgroundColor: '#1a1a1a', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },

  footerContainer: { 
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 25, 
    paddingTop: 15,
    backgroundColor: 'rgba(0,0,0,0.95)', // Leggera trasparenza per l'effetto glass
    borderTopWidth: 1,
    borderTopColor: '#111',
    zIndex: 100
  },
  saveBtn: { 
    backgroundColor: '#00cec9', 
    height: 55, 
    borderRadius: 16, 
    flexDirection: 'row', 
    justifyContent: 'center', 
    alignItems: 'center', 
    gap: 10, 
    shadowColor: '#00cec9', 
    shadowOpacity: 0.3, 
    shadowRadius: 10 
  },
  saveBtnText: { color: '#000', fontSize: 14, fontWeight: '900', letterSpacing: 1 },
});