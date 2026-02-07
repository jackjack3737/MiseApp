import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, ScrollView, TextInput, KeyboardAvoidingView, Platform, LayoutAnimation, UIManager, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Save, Plus, Minus, Flame, Droplet, Wheat, User, Target, Zap, Trash2, ShieldAlert, ArrowLeft, Activity, CheckCircle2, Calendar, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react-native';

// --- HOOK REALE ---
import { useHealthConnect } from '../hooks/useHealthConnect'; 

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const STORAGE_KEY = '@user_profile';
const PROTOCOLS = ['Keto', 'Carnivore', 'Paleo', 'LowCarb'];

const ACTIVITY_LEVELS = [
    { label: 'Sedentario (Ufficio)', value: 1.2 },
    { label: 'Leggero (1-2 allenamenti/sett)', value: 1.375 },
    { label: 'Moderato (3-4 allenamenti/sett)', value: 1.55 },
    { label: 'Molto Attivo (5+ allenamenti/sett)', value: 1.725 }
];

const GENDER_OPTIONS = [
    { label: 'Uomo', value: 'male' },
    { label: 'Donna', value: 'female' }
];

const calculateTDEE = (weight: number, height: number, age: number, gender: string, activityMult: number) => {
    let bmr = (10 * weight) + (6.25 * height) - (5 * age);
    bmr += gender === 'male' ? 5 : -161;
    return Math.round(bmr * activityMult);
};

export default function ProfileScreen() {
  const router = useRouter();
  
  // LOGICA SENSORI REALE
  const { isLinked, connect, data: healthData, syncData } = useHealthConnect();
  
  const [weight, setWeight] = useState(75);
  const [targetWeight, setTargetWeight] = useState(70);
  const [height, setHeight] = useState(175); 
  const [age, setAge] = useState(30);
  const [gender, setGender] = useState('male');
  const [activityMult, setActivityMult] = useState(1.2);
  const [showActivityMenu, setShowActivityMenu] = useState(false);
  const [showGenderMenu, setShowGenderMenu] = useState(false);

  const [tDay, setTDay] = useState('');
  const [tMonth, setTMonth] = useState('');
  const [tYear, setTYear] = useState('');

  const [protocol, setProtocol] = useState('Keto');
  const [kcal, setKcal] = useState(2000);
  const [protein, setProtein] = useState(150);
  const [carbs, setCarbs] = useState(20);
  const [fat, setFat] = useState(150);

  useEffect(() => { 
      loadProfile(); 
  }, []);

  // --- AUTO-UPDATE PESO DA HARDWARE ---
  useEffect(() => {
    if (healthData.weight > 0 && healthData.weight !== weight) {
        Alert.alert(
            "Bilancia Rilevata",
            `Il tuo peso aggiornato è ${healthData.weight} kg. Vuoi applicarlo al profilo?`,
            [
                { text: "Mantieni attuale", style: "cancel" },
                { 
                  text: "Aggiorna", 
                  onPress: () => {
                    setWeight(healthData.weight);
                    Alert.alert("Peso sincronizzato", "Ricordati di ricalcolare il piano se necessario.");
                  } 
                }
            ]
        );
    }
  }, [healthData.weight]);

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
        setWeight(p.weight || 75);
        setTargetWeight(p.targetWeight || 70);
        setGender(p.gender || 'male');
        setActivityMult(p.activityMult || 1.2);
        setHeight(p.height || 175);
        setAge(p.age || 30);
        
        if (p.targetDateIso) {
            const d = new Date(p.targetDateIso);
            setTDay(d.getDate().toString());
            setTMonth((d.getMonth() + 1).toString());
            setTYear(d.getFullYear().toString());
        }
      }
    } catch(e) { console.log(e); }
  }

  const getDynamicSummary = () => {
      const weightDiff = (weight - targetWeight).toFixed(1);
      const isLoss = Number(weightDiff) > 0;
      const targetDateObj = new Date(Number(tYear), Number(tMonth) - 1, Number(tDay));
      const now = new Date();
      const diffDays = Math.ceil((targetDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (!tDay || !tMonth || !tYear || isNaN(diffDays)) return null;
      if (diffDays <= 0) return <Text style={styles.summaryTextError}>La data deve essere nel futuro</Text>;
      if (parseFloat(weightDiff) === 0) return <Text style={styles.summaryText}>Mantenimento peso attuale</Text>;

      return (
        <Text style={styles.summaryText}>
            Vuoi {isLoss ? 'perdere' : 'prendere'} <Text style={{color: '#00cec9'}}>{Math.abs(Number(weightDiff))} kg</Text> in <Text style={{color: '#00cec9'}}>{diffDays} giorni</Text>
        </Text>
      );
  };

  const generateSmartPlan = () => {
    const tdee = calculateTDEE(weight, height, age, gender, activityMult);
    const weightDiff = weight - targetWeight;
    const targetDateObj = new Date(Number(tYear), Number(tMonth) - 1, Number(tDay));
    const now = new Date();
    const diffDays = Math.ceil((targetDateObj.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
        Alert.alert("Errore", "Imposta una data valida nel futuro.");
        return;
    }

    let targetCal = tdee;
    if (weightDiff > 0) {
        const totalDeficitNeeded = weightDiff * 7700;
        const dailyDeficit = Math.round(totalDeficitNeeded / diffDays);
        targetCal = tdee - dailyDeficit;
    } else if (weightDiff < 0) {
        targetCal = tdee + 300; // Surplus moderato per massa
    }

    if (targetCal < 1200) Alert.alert("Attenzione", "Le calorie calcolate sono molto basse. Valuta tempi più lunghi.");
    
    updateMetabolism('kcal', Math.max(1000, targetCal));
    setTimeout(() => applyProtocolDefaults(protocol, Math.max(1000, targetCal)), 100);
  };

  const applyProtocolDefaults = (selected: string, calorieBase: number = kcal) => {
    setProtocol(selected);
    let newC = 20, newP = 150;
    switch(selected) {
        case 'Keto': newC = 25; newP = Math.round((calorieBase * 0.25) / 4); break;
        case 'Carnivore': newC = 0; newP = Math.round((calorieBase * 0.40) / 4); break;
        case 'Paleo': newC = 60; newP = Math.round((calorieBase * 0.30) / 4); break;
        case 'LowCarb': newC = 100; newP = Math.round((calorieBase * 0.35) / 4); break;
    }
    const newF = Math.max(0, Math.round((calorieBase - (newP * 4) - (newC * 4)) / 9));
    setCarbs(newC); setProtein(newP); setFat(newF); setKcal(calorieBase);
  };

  const updateMetabolism = (type: string, newValue: number) => {
    let nK = kcal, nP = protein, nC = carbs, nF = fat;
    if (type === 'kcal') nK = Math.max(0, newValue);
    else if (type === 'p') nP = Math.max(0, newValue);
    else if (type === 'c') nC = Math.max(0, newValue);
    else if (type === 'f') nF = Math.max(0, newValue);
    if (type !== 'f') nF = Math.max(0, Math.round((nK - (nP * 4) - (nC * 4)) / 9));
    setKcal(nK); setProtein(nP); setCarbs(nC); setFat(nF);
  };

  async function saveProfile() {
    try {
      const targetDateIso = new Date(Number(tYear), Number(tMonth) - 1, Number(tDay)).toISOString();
      const profileData = { 
        targetCalories: kcal, protocol, protein, carbs, fat, 
        weight, targetWeight, height, age, targetDateIso, gender, activityMult,
        updatedAt: new Date().toISOString() 
      };
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(profileData));
      Alert.alert('Salvato', 'Profilo aggiornato con successo.');
      if (router.canGoBack()) router.back();
    } catch (e) { Alert.alert('Errore', 'Salvataggio fallito.'); }
  }

  const CustomDropdown = ({ label, value, options, isOpen, onToggle, onSelect }: any) => {
    const selectedLabel = options.find((o: any) => o.value === value)?.label || "Seleziona";
    return (
        <View style={{ marginBottom: 15, zIndex: isOpen ? 100 : 1 }}>
            <Text style={styles.plannerLabel}>{label}</Text>
            <TouchableOpacity style={styles.dropdownBtn} onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                onToggle();
            }}>
                <Text style={styles.dropdownText}>{selectedLabel}</Text>
                {isOpen ? <ChevronUp size={20} color="#636e72" /> : <ChevronDown size={20} color="#636e72" />}
            </TouchableOpacity>
            {isOpen && (
                <View style={styles.dropdownList}>
                    {options.map((opt: any) => (
                        <TouchableOpacity key={opt.label} style={styles.dropdownItem} onPress={() => {
                            onSelect(opt.value);
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            onToggle();
                        }}>
                            <Text style={[styles.dropdownItemText, opt.value === value && {color: '#00cec9'}]}>{opt.label}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}
        </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex:1}}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 50 }}>
        
        <View style={styles.header}>
            <View style={{flexDirection:'row', alignItems:'center', gap: 10}}>
                <TouchableOpacity onPress={() => router.back()} style={{paddingRight:5}}>
                    <ArrowLeft size={24} color="#636e72" />
                </TouchableOpacity>
                <Target size={24} color="#00cec9" />
                <Text style={styles.title}>BIO-TARGETS</Text>
            </View>
            <TouchableOpacity style={styles.headerSaveBtn} onPress={saveProfile}>
                <Save size={18} color="#000" />
                <Text style={styles.headerSaveText}>SALVA</Text>
            </TouchableOpacity>
        </View>

        {/* STATUS HARDWARE REALE */}
        <View style={[styles.sensorBadge, isLinked ? styles.sensorActive : styles.sensorInactive]}>
            <Activity size={14} color={isLinked ? "#00cec9" : "#636e72"} />
            <Text style={[styles.sensorText, {color: isLinked ? "#00cec9" : "#636e72"}]}>
                {isLinked ? "HARDWARE COLLEGATO" : "SENSORI NON ATTIVI"}
            </Text>
            <TouchableOpacity onPress={isLinked ? syncData : connect} style={styles.sensorConnectBtn}>
                <Text style={styles.sensorConnectText}>{isLinked ? "REFRESH" : "CONNETTI"}</Text>
            </TouchableOpacity>
        </View>

        <Text style={styles.subLabel}>PARAMETRI FISICI</Text>
        <View style={styles.plannerCard}>
            <CustomDropdown label="SESSO BIOLOGICO" value={gender} options={GENDER_OPTIONS} isOpen={showGenderMenu} onToggle={() => { setShowGenderMenu(!showGenderMenu); setShowActivityMenu(false); }} onSelect={setGender} />
            <CustomDropdown label="LIVELLO DI ATTIVITÀ" value={activityMult} options={ACTIVITY_LEVELS} isOpen={showActivityMenu} onToggle={() => { setShowActivityMenu(!showActivityMenu); setShowGenderMenu(false); }} onSelect={setActivityMult} />
            <View style={{flexDirection:'row', justifyContent:'space-between', gap:10, marginBottom: 15}}>
                 <View style={styles.plannerInputBox}><Text style={styles.plannerLabel}>ETÀ</Text><TextInput style={styles.plannerInput} keyboardType="numeric" value={age.toString()} onChangeText={(t) => setAge(Number(t))}/></View>
                 <View style={styles.plannerInputBox}><Text style={styles.plannerLabel}>ALTEZZA (CM)</Text><TextInput style={styles.plannerInput} keyboardType="numeric" value={height.toString()} onChangeText={(t) => setHeight(Number(t))}/></View>
            </View>
        </View>

        <Text style={styles.subLabel}>OBIETTIVO PESO & TEMPO</Text>
        <View style={styles.plannerCard}>
            <View style={styles.plannerRow}>
                <View style={styles.plannerInputBox}><Text style={styles.plannerLabel}>PESO ORA (KG)</Text><TextInput style={styles.plannerInput} keyboardType="numeric" value={weight.toString()} onChangeText={(t) => setWeight(Number(t))}/></View>
                <ArrowLeft size={20} color="#666" style={{transform: [{rotate: '180deg'}], marginTop: 20}} />
                <View style={styles.plannerInputBox}><Text style={styles.plannerLabel}>OBIETTIVO (KG)</Text><TextInput style={[styles.plannerInput, {color: '#00cec9', borderColor: '#00cec9'}]} keyboardType="numeric" value={targetWeight.toString()} onChangeText={(t) => setTargetWeight(Number(t))}/></View>
            </View>
            <View style={styles.plannerRow}>
                 <View style={{flex:1}}>
                    <View style={{flexDirection:'row', alignItems:'center', gap:5, marginBottom:5}}><Calendar size={12} color="#636e72" /><Text style={styles.plannerLabel}>DATA OBIETTIVO</Text></View>
                    <View style={styles.dateRow}>
                        <View style={{flex:1}}><TextInput style={styles.dateInput} placeholder="GG" placeholderTextColor="#444" keyboardType="numeric" maxLength={2} value={tDay} onChangeText={setTDay} /><Text style={styles.dateSubLabel}>Giorno</Text></View>
                        <Text style={styles.dateSlash}>/</Text>
                        <View style={{flex:1}}><TextInput style={styles.dateInput} placeholder="MM" placeholderTextColor="#444" keyboardType="numeric" maxLength={2} value={tMonth} onChangeText={setTMonth} /><Text style={styles.dateSubLabel}>Mese</Text></View>
                        <Text style={styles.dateSlash}>/</Text>
                        <View style={{flex:1.5}}><TextInput style={styles.dateInput} placeholder="AAAA" placeholderTextColor="#444" keyboardType="numeric" maxLength={4} value={tYear} onChangeText={setTYear} /><Text style={styles.dateSubLabel}>Anno</Text></View>
                    </View>
                 </View>
            </View>
            <View style={styles.dynamicSummaryContainer}>{getDynamicSummary()}</View>
            <TouchableOpacity style={styles.generateBtn} onPress={generateSmartPlan}><Zap size={18} color="#000" fill="#000" /><Text style={styles.generateBtnText}>CALCOLA PIANO</Text></TouchableOpacity>
        </View>

        <Text style={styles.subLabel}>REGIME ALIMENTARE</Text>
        <View style={styles.protocolRow}>
          {PROTOCOLS.map(p => (
            <TouchableOpacity key={p} onPress={() => applyProtocolDefaults(p)} style={[styles.pill, protocol === p && styles.activePill]}><Text style={[styles.pillText, protocol === p && {color: '#00cec9'}]}>{p}</Text></TouchableOpacity>
          ))}
        </View>

        <ControlRow label="CALORIE TOTALI" value={kcal} type="kcal" icon={Flame} color="#fff" update={updateMetabolism} />
        <View style={styles.macroGrid}>
          <ControlRow label="PROTEINE (G)" value={protein} type="p" icon={User} color="#74b9ff" update={updateMetabolism} />
          <ControlRow label="CARBOIDRATI (G)" value={carbs} type="c" icon={Wheat} color="#fdcb6e" update={updateMetabolism} />
          <ControlRow label="GRASSI (G)" value={fat} type="f" icon={Droplet} color="#ff7675" update={updateMetabolism} />
        </View>

        <View style={styles.divider} />
        <View style={styles.footerActions}>
            <TouchableOpacity style={styles.disclaimerBtn} onPress={() => Alert.alert("Info", "I tuoi dati non lasciano mai questo telefono.")}><ShieldAlert size={18} color="#b2bec3" /><Text style={styles.disclaimerText}>PRIVACY</Text></TouchableOpacity>
            <TouchableOpacity style={styles.resetBtn} onPress={() => Alert.alert("Reset", "Cancellare tutto?", [{text: 'Annulla'}, {text: 'Reset', onPress: () => AsyncStorage.clear()}])}><Trash2 size={18} color="#ff7675" /><Text style={styles.resetText}>RESET APP</Text></TouchableOpacity>
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ControlRow = ({ label, value, type, color, icon: Icon, update }: any) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}><View style={styles.labelGroup}><Icon size={14} color={color} /><Text style={[styles.label, { color }]}>{label}</Text></View></View>
      <View style={styles.inputRow}>
        <TouchableOpacity onPress={() => update(type, value - (type === 'kcal' ? 50 : 5))} style={styles.miniBtn}><Minus size={18} color="#fff" /></TouchableOpacity>
        <TextInput style={styles.input} keyboardType="numeric" value={value.toString()} onChangeText={(txt) => update(type, parseInt(txt) || 0)}/>
        <TouchableOpacity onPress={() => update(type, value + (type === 'kcal' ? 50 : 5))} style={styles.miniBtn}><Plus size={18} color="#fff" /></TouchableOpacity>
      </View>
    </View>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  title: { color: '#fff', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  headerSaveBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#00cec9', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 20 },
  headerSaveText: { color: '#000', fontWeight: '900', fontSize: 12 },
  sensorBadge: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 15, marginBottom: 25, borderWidth: 1 },
  sensorActive: { backgroundColor: '#00cec910', borderColor: '#00cec930' },
  sensorInactive: { backgroundColor: '#111', borderColor: '#222' },
  sensorText: { fontSize: 10, fontWeight: '900', marginLeft: 8, flex: 1 },
  sensorConnectBtn: { backgroundColor: '#222', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  sensorConnectText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  dropdownBtn: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#000', borderWidth: 1, borderColor: '#333', borderRadius: 12, padding: 15, height: 50 },
  dropdownText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  dropdownList: { marginTop: 5, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#333', borderRadius: 12, overflow: 'hidden' },
  dropdownItem: { padding: 15, borderBottomWidth: 1, borderBottomColor: '#1a1a1a' },
  dropdownItemText: { color: '#b2bec3', fontSize: 14 },
  dynamicSummaryContainer: { alignItems: 'center', marginVertical: 10, minHeight: 20 },
  summaryText: { color: '#b2bec3', fontSize: 11, fontStyle: 'italic', fontWeight: '500' },
  summaryTextError: { color: '#ff7675', fontSize: 11, fontStyle: 'italic' },
  plannerCard: { backgroundColor: '#111', borderRadius: 20, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: '#222' },
  plannerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 15, marginBottom: 20 },
  plannerInputBox: { flex: 1, alignItems: 'center' },
  plannerLabel: { color: '#636e72', fontSize: 9, fontWeight: '900', marginBottom: 5, textTransform: 'uppercase' },
  plannerInput: { backgroundColor: '#000', width: '100%', height: 50, borderRadius: 12, color: '#fff', textAlign: 'center', fontSize: 20, fontWeight: '900', borderWidth: 1, borderColor: '#333' },
  dateRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  dateInput: { backgroundColor: '#000', width: '100%', height: 50, borderRadius: 12, color: '#fff', textAlign: 'center', fontSize: 18, fontWeight: '900', borderWidth: 1, borderColor: '#333' },
  dateSubLabel: { color: '#444', fontSize: 9, textAlign: 'center', marginTop: 4, fontWeight: '700' },
  dateSlash: { color: '#333', fontSize: 24, fontWeight: '900', marginTop: 10 },
  generateBtn: { backgroundColor: '#00cec9', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12, marginTop: 5 },
  generateBtnText: { color: '#000', fontWeight: '900', fontSize: 12 },
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
  resetText: { color: '#ff7675', fontSize: 10, fontWeight: '900' }
});