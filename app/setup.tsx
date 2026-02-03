import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, StatusBar, TextInput, Dimensions, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Import aggiunto
import { Zap, Beef, Leaf, ChevronRight, Edit2, Activity } from 'lucide-react-native';

const { width } = Dimensions.get('window');

const PROTOCOLS = [
  { id: 'Keto', name: 'KETO', desc: 'Metabolic Efficiency.', icon: <Zap size={24} color="#FFD700" />, color: '#FFD700', defaultSplit: { c: 5, p: 25, f: 70 } },
  { id: 'Carnivore', name: 'CARNIVORE', desc: 'Apex Predator.', icon: <Beef size={24} color="#e17055" />, color: '#e17055', defaultSplit: { c: 0, p: 40, f: 60 } },
  { id: 'Paleo', name: 'PALEO', desc: 'Ancestral Health.', icon: <Leaf size={24} color="#00b894" />, color: '#00b894', defaultSplit: { c: 20, p: 30, f: 50 } },
  { id: 'LowCarb', name: 'LOW CARB', desc: 'Sustainable Balance.', icon: <Activity size={24} color="#0984e3" />, color: '#0984e3', defaultSplit: { c: 25, p: 35, f: 40 } },
];

export default function SetupScreen() {
  const router = useRouter();
  const [selectedProtocol, setSelectedProtocol] = useState('Keto');
  const [kcal, setKcal] = useState(2000);
  const [carbs, setCarbs] = useState(25);   
  const [protein, setProtein] = useState(125); 
  const [fat, setFat] = useState(155);

  const isInternalUpdate = useRef(false);

  useEffect(() => {
    if (isInternalUpdate.current) { isInternalUpdate.current = false; return; }
    const proto = PROTOCOLS.find(p => p.id === selectedProtocol);
    if (!proto) return;
    const split = proto.defaultSplit;
    setCarbs(Math.round((kcal * (split.c / 100)) / 4));
    setProtein(Math.round((kcal * (split.p / 100)) / 4));
    setFat(Math.round((kcal * (split.f / 100)) / 9));
  }, [selectedProtocol, kcal]);

  // LOGICA DI SALVATAGGIO LOCALE AGGIUNTA QUI
  const handleGeneratePlan = async () => {
    try {
      const setupData = {
        targetCalories: kcal,
        targetCarbs: carbs,
        targetProtein: protein,
        targetFat: fat,
        protocol: selectedProtocol,
        updatedAt: new Date().toISOString()
      };
      
      // Salviamo nel telefono
      await AsyncStorage.setItem('@user_profile', JSON.stringify(setupData));
      
      // Navighiamo alla pagina Explore passando i parametri
      router.push({
        pathname: '/(tabs)/explore',
        params: setupData as any
      });
    } catch (e) {
      Alert.alert("Errore", "Impossibile salvare il profilo energetico.");
    }
  };

  const handleKcalChange = (text: string) => {
    const val = parseInt(text.replace(/[^0-9]/g, '')) || 0;
    setKcal(val);
  };

  const handleMacroChange = (type: string, newValueStr: string) => {
    isInternalUpdate.current = true;
    let newVal = parseInt(newValueStr.replace(/[^0-9]/g, '')) || 0;
    const costPerGram = type === 'f' ? 9 : 4;
    if (newVal * costPerGram > kcal) newVal = Math.floor(kcal / costPerGram);
    const remainingKcal = kcal - (newVal * costPerGram);

    if (type === 'c') {
        const totalOther = (protein * 4) + (fat * 9) || 1;
        const ratio = remainingKcal / totalOther;
        setCarbs(newVal);
        setProtein(Math.round((protein * 4 * ratio) / 4));
        setFat(Math.round((fat * 9 * ratio) / 9));
    } else if (type === 'p') {
        const totalOther = (carbs * 4) + (fat * 9) || 1;
        const ratio = remainingKcal / totalOther;
        setProtein(newVal);
        setCarbs(Math.round((carbs * 4 * ratio) / 4));
        setFat(Math.round((fat * 9 * ratio) / 9));
    } else if (type === 'f') {
        const totalOther = (carbs * 4) + (protein * 4) || 1;
        const ratio = remainingKcal / totalOther;
        setFat(newVal);
        setCarbs(Math.round((carbs * 4 * ratio) / 4));
        setProtein(Math.round((protein * 4 * ratio) / 4));
    }
  };

  const incrementMacro = (type: string, delta: number) => {
    let currentVal = type === 'c' ? carbs : (type === 'p' ? protein : fat);
    handleMacroChange(type, (currentVal + delta).toString());
  }

  const currentTotalKcal = (carbs * 4) + (protein * 4) + (fat * 9);
  const safeTotal = currentTotalKcal > 0 ? currentTotalKcal : 1;
  const carbsPct = Math.round(((carbs * 4) / safeTotal) * 100);
  const proteinPct = Math.round(((protein * 4) / safeTotal) * 100);
  const fatPct = Math.round(((fat * 9) / safeTotal) * 100);

  const MacroControl = ({ label, val, type, color, max }: any) => (
    <View style={styles.macroRow}>
      <View style={styles.macroHeader}>
        <Text style={[styles.macroLabel, { color: color }]}>{label}</Text>
        <View style={styles.inputWrapper}>
            <TextInput
                style={styles.numericInput}
                keyboardType="numeric"
                value={val.toString()}
                onChangeText={(text) => handleMacroChange(type, text)}
                maxLength={3}
                selectTextOnFocus
            />
            <Text style={styles.unitText}>g</Text>
            <Edit2 size={12} color="#636e72" style={{marginLeft: 6}} />
        </View>
      </View>
      <View style={styles.sliderControls}>
         <TouchableOpacity onPress={() => incrementMacro(type, -5)} style={styles.btnMini}><Text style={styles.btnText}>-</Text></TouchableOpacity>
         <View style={styles.barTrack}>
             <View style={[styles.barFill, { width: `${Math.min((val / max) * 100, 100)}%`, backgroundColor: color }]} />
         </View>
         <TouchableOpacity onPress={() => incrementMacro(type, 5)} style={styles.btnMini}><Text style={styles.btnText}>+</Text></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.superTitle}>BIO-HACKING SETUP</Text>
          <Text style={styles.title}>Configura il Motore</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.protocolList}>
          {PROTOCOLS.map((p) => {
            const isActive = selectedProtocol === p.id;
            return (
              <TouchableOpacity 
                key={p.id} 
                style={[styles.chip, isActive && { backgroundColor: p.color, borderColor: p.color }]}
                onPress={() => setSelectedProtocol(p.id)}
              >
                {React.cloneElement(p.icon as React.ReactElement, { size: 20, color: isActive ? '#000' : p.color })}
                <Text style={[styles.chipText, isActive && { color: '#000' }]}>{p.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View style={styles.divider} />

        <View style={styles.section}>
            <View style={styles.rowBetween}>
                <View>
                    <Text style={styles.sectionTitle}>BUDGET ENERGETICO</Text>
                    <Text style={styles.subTitle}>I macro si adatteranno a questo tetto.</Text>
                </View>
                <View style={styles.kcalInputWrapper}>
                    <TextInput
                        style={styles.bigValue}
                        keyboardType="numeric"
                        value={kcal.toString()}
                        onChangeText={handleKcalChange}
                        maxLength={4}
                        selectTextOnFocus
                    />
                    <Edit2 size={16} color="#00cec9" style={{marginLeft: 8}} />
                </View>
            </View>
            <View style={styles.mainSliderControls}>
                <TouchableOpacity onPress={() => setKcal(Math.max(100, kcal - 50))} style={styles.btnBig}><Text style={styles.btnText}>-</Text></TouchableOpacity>
                <View style={styles.barTrackBig}>
                    <View style={[styles.barFill, { width: `${Math.min((kcal / 4000) * 100, 100)}%`, backgroundColor: '#fff' }]} />
                </View>
                <TouchableOpacity onPress={() => setKcal(Math.min(5000, kcal + 50))} style={styles.btnBig}><Text style={styles.btnText}>+</Text></TouchableOpacity>
            </View>
        </View>

        <View style={styles.macroCard}>
            <Text style={styles.sectionTitle}>BILANCIAMENTO FINE</Text>
            <Text style={styles.subTitleCard}>Modifica i grammi o usa i tasti +/-</Text>
            <View style={styles.chartRow}>
                <View style={{alignItems:'center'}}><Text style={[styles.pctText, {color:'#fdcb6e'}]}>{carbsPct}%</Text><Text style={styles.pctLabel}>CARBS</Text></View>
                <View style={{alignItems:'center'}}><Text style={[styles.pctText, {color:'#74b9ff'}]}>{proteinPct}%</Text><Text style={styles.pctLabel}>PRO</Text></View>
                <View style={{alignItems:'center'}}><Text style={[styles.pctText, {color:'#ff7675'}]}>{fatPct}%</Text><Text style={styles.pctLabel}>FATS</Text></View>
            </View>
            <MacroControl label="CARBOIDRATI (4kcal/g)" val={carbs} type="c" color="#fdcb6e" max={200} />
            <MacroControl label="PROTEINE (4kcal/g)" val={protein} type="p" color="#74b9ff" max={350} />
            <MacroControl label="GRASSI (9kcal/g)" val={fat} type="f" color="#ff7675" max={250} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.mainButton} onPress={handleGeneratePlan}>
            <View>
                <Text style={styles.btnTitle}>GENERA PIANO</Text>
                <Text style={styles.btnSubtitle}>{kcal} kcal • {fat}g Grassi</Text>
            </View>
            <ChevronRight size={28} color="#000" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ... (stili invariati)
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { padding: 25, paddingTop: 50 },
  superTitle: { color: '#00cec9', fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 5 },
  title: { fontSize: 34, fontWeight: '900', color: '#fff' },
  protocolList: { paddingHorizontal: 25, gap: 10, marginBottom: 20 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 30, borderWidth: 1, borderColor: '#333', gap: 10, marginRight: 10 },
  chipText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: '#222', marginVertical: 20 },
  section: { paddingHorizontal: 25, marginBottom: 30 },
  sectionTitle: { color: '#636e72', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 5 },
  subTitle: { color: '#b2bec3', fontSize: 12, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  kcalInputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: '#333' },
  bigValue: { color: '#fff', fontSize: 28, fontWeight: '900', textAlign: 'right', minWidth: 70 },
  mainSliderControls: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  btnBig: { width: 50, height: 50, borderRadius: 16, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#333' },
  btnText: { color: '#fff', fontSize: 22, lineHeight: 24 },
  barTrackBig: { flex: 1, height: 12, backgroundColor: '#222', borderRadius: 6, overflow: 'hidden' },
  macroCard: { marginHorizontal: 20, backgroundColor: '#111', borderRadius: 25, padding: 25, borderWidth: 1, borderColor: '#333' },
  subTitleCard: { color: '#636e72', fontSize: 12, marginBottom: 20, fontStyle:'italic' },
  chartRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 30, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  pctText: { fontSize: 24, fontWeight: '900' },
  pctLabel: { color: '#636e72', fontSize: 10, fontWeight: '700', marginTop: 5 },
  macroRow: { marginBottom: 20 },
  macroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  macroLabel: { fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#222', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#333', minWidth: 80, justifyContent:'flex-end' },
  numericInput: { color: '#fff', fontSize: 18, fontWeight: '700', padding: 0, textAlign: 'right' },
  unitText: { color: '#636e72', fontSize: 12, marginLeft: 2, fontWeight:'600' },
  sliderControls: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  btnMini: { width: 35, height: 35, borderRadius: 10, backgroundColor: '#222', justifyContent: 'center', alignItems: 'center' },
  barTrack: { flex: 1, height: 6, backgroundColor: '#222', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  footer: { position: 'absolute', bottom: 30, left: 20, right: 20 },
  mainButton: { backgroundColor: '#00cec9', height: 75, borderRadius: 25, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 25, elevation: 10 },
  btnTitle: { color: '#000', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
  btnSubtitle: { color: '#2d3436', fontSize: 12, fontWeight: '600' },
});